// QueueStorm Investigator — production orchestrator

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { validateRequestBody, detectLanguage } = require('./security');
const { preFilter } = require('./preFilter');
const { matchTransactions } = require('./transactionMatcher');
const { buildEvidence } = require('./evidenceEngine');
const { applyRules } = require('./rules');
const { callLLM, maskApiKey, PRIORITY, getProviderStats } = require('./llmCaller');
const { geminiRotator, groqRotator, openrouterRotator } = require('./keyRotator');
const { buildSystemPrompt, buildUserPrompt } = require('./prompt');
const { parseJSON, validate } = require('./validator');
const { logTicket, hashComplaint } = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});
app.use(limiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers: PRIORITY,
    uptime_seconds: Math.floor(process.uptime())
  });
});

const ROTATORS = { gemini: geminiRotator, groq: groqRotator, openrouter: openrouterRotator };

app.get('/api-key', (req, res) => {
  for (const provider of PRIORITY) {
    const rotator = ROTATORS[provider];
    if (rotator?.hasKeys()) {
      const key = rotator.keys[rotator.index % rotator.keys.length];
      return res.json({
        provider,
        masked_api_key: maskApiKey(key),
        priority: PRIORITY
      });
    }
  }
  res.json({ provider: 'none', masked_api_key: 'N/A', priority: PRIORITY });
});

app.get('/api/agents', (req, res) => {
  const stats = getProviderStats();
  const agents = PRIORITY.map((provider, index) => {
    const rotator = ROTATORS[provider];
    const configured = Boolean(rotator?.hasKeys());
    return {
      provider,
      priority: index + 1,
      configured,
      masked_api_key: configured ? maskApiKey(rotator.keys[0]) : null,
      status: configured ? 'ready' : 'not_configured',
      stats: stats[provider] || null
    };
  });
  const primary = agents.find((a) => a.configured) || null;
  res.json({ priority: PRIORITY, primary, agents });
});

app.post('/analyze-ticket', async (req, res) => {
  const startMs = Date.now();

  const inputCheck = validateRequestBody(req.body);
  if (!inputCheck.valid) {
    const status = inputCheck.errors.some((e) => e.includes('complaint')) ? 422 : 400;
    return res.status(status).json({ error: inputCheck.errors[0], errors: inputCheck.errors });
  }

  const body = inputCheck.sanitized;
  const { ticket_id, complaint } = body;
  const language = body.language || detectLanguage(complaint);

  const preFilterResult = preFilter(body);

  if (preFilterResult?.flagged) {
    console.warn(`[Security] Injection attempt detected in ticket ${ticket_id}`);
  }

  const matchResult = matchTransactions(body.transaction_history || [], complaint);
  const evidenceResult = buildEvidence(matchResult, complaint, body.transaction_history || []);
  const rulesResult = applyRules({
    preFilterResult,
    matchResult,
    evidenceResult,
    complaint
  });

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(body, {
    preFilterResult,
    matchResult,
    evidenceResult,
    rulesResult,
    language
  });

  let raw;
  let provider;
  let maskedApiKey;
  let fallbackUsed = false;
  let llmLatencyMs = 0;

  try {
    const result = await callLLM(systemPrompt, userPrompt);
    raw = result.raw;
    provider = result.provider;
    maskedApiKey = result.masked_api_key;
    fallbackUsed = result.fallback_used || false;
    llmLatencyMs = result.latency_ms || 0;
  } catch (err) {
    console.error(`[LLM] All providers failed for ${ticket_id}:`, err.message);
    const detail = err.message || 'Unknown error';
    const isRateLimit = /429|rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(detail);
    return res.status(isRateLimit ? 429 : 503).json({
      error: isRateLimit
        ? 'LLM rate limit reached on all keys. Wait a minute or add Groq/OpenRouter keys in .env.'
        : 'LLM service unavailable. Please retry.',
      detail
    });
  }

  let parsed;
  try {
    parsed = parseJSON(raw);
  } catch (err) {
    console.error(`[Parse] JSON parse failed for ${ticket_id}:`, err.message);
    parsed = {
      agent_summary: `Ticket ${ticket_id} analyzed. Evidence: ${evidenceResult.evidence_verdict}. Case: ${rulesResult.case_type}.`,
      recommended_next_action: rulesResult.human_review_required
        ? 'Escalate to human agent for manual review.'
        : 'Proceed with standard resolution workflow.',
      customer_reply: null
    };
  }

  const { data: validated, errors: validationErrors } = validate(parsed, ticket_id, {
    evidenceResult,
    rulesResult,
    preFilterResult,
    transactionHistory: body.transaction_history || [],
    language
  });

  const latencyMs = Date.now() - startMs;
  const safetyPassed = !validationErrors.some((e) =>
    e.includes('forbidden phrase') || e.includes('credential leak')
  );

  logTicket({
    ticketId: ticket_id,
    provider,
    latencyMs,
    llmLatencyMs,
    fallbackUsed,
    caseType: validated.case_type,
    evidenceVerdict: validated.evidence_verdict,
    safetyPassed,
    confidence: validated.confidence,
    complaintHash: hashComplaint(complaint),
    validationErrors: validationErrors.length > 0 ? validationErrors : null,
    reasonCodes: validated.reason_codes,
    matcherScore: matchResult.best?.score ?? null,
    securityFlags: preFilterResult?.security_flag || null,
    promptInjection: Boolean(preFilterResult?.flagged),
    department: validated.department,
    severity: validated.severity
  }).catch(() => {});

  console.log(
    `[OK] ${ticket_id} | ${validated.case_type} | ${validated.evidence_verdict} | ${provider} | ${latencyMs}ms`
  );

  return res.status(200).json({
    ...validated,
    _meta: {
      provider,
      masked_api_key: maskedApiKey,
      fallback_used: fallbackUsed,
      latency_ms: latencyMs,
      llm_latency_ms: llmLatencyMs
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('[Unhandled]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`QueueStorm Investigator running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});

function gracefulShutdown(signal) {
  console.log(`[Shutdown] Received ${signal}, closing server…`);
  server.close(() => {
    console.log('[Shutdown] Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
