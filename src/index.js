// src/index.js
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { preFilter } = require('./preFilter');
const { callLLM, maskApiKey, PRIORITY } = require('./llmCaller');
const { geminiRotator, groqRotator, openrouterRotator } = require('./keyRotator');
const { buildSystemPrompt, buildUserPrompt } = require('./prompt');
const { parseJSON, validate } = require('./validator');
const { logTicket, hashComplaint } = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
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
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});
app.use(limiter);

// ── Health ────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
  const agents = PRIORITY.map((provider, index) => {
    const rotator = ROTATORS[provider];
    const configured = Boolean(rotator?.hasKeys());
    return {
      provider,
      priority: index + 1,
      configured,
      masked_api_key: configured ? maskApiKey(rotator.keys[0]) : null,
      status: configured ? 'ready' : 'not_configured'
    };
  });
  const primary = agents.find((a) => a.configured) || null;
  res.json({ priority: PRIORITY, primary, agents });
});

// ── Shared analysis logic ─────────────────────────────────────
async function analyzeOneTicket(body) {
  const startMs = Date.now();
  const { ticket_id, complaint } = body;

  if (!ticket_id || typeof ticket_id !== 'string' || ticket_id.trim() === '') {
    return { error: true, status: 400, data: { error: 'Missing required field: ticket_id' } };
  }

  if (!complaint || typeof complaint !== 'string' || complaint.trim() === '') {
    return { error: true, status: 422, data: { error: 'Missing or empty complaint field', ticket_id } };
  }

  // Pre-filter
  const preFilterResult = preFilter(body);
  if (preFilterResult?.flagged) {
    console.warn(`[Security] Injection attempt detected in ticket ${ticket_id}`);
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(body, preFilterResult);

  // Call LLM with fallback
  let raw, provider, maskedApiKey;
  try {
    const result = await callLLM(systemPrompt, userPrompt);
    raw = result.raw;
    provider = result.provider;
    maskedApiKey = result.masked_api_key;
  } catch (err) {
    console.error(`[LLM] All providers failed for ${ticket_id}:`, err.message);
    const detail = err.message || 'Unknown error';
    const isRateLimit = /429|rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(detail);
    return {
      error: true,
      status: isRateLimit ? 429 : 503,
      data: {
        error: isRateLimit
          ? 'LLM rate limit reached on all keys. Wait a minute or add Groq/OpenRouter keys in .env.'
          : 'LLM service unavailable. Please retry.',
        detail,
        ticket_id
      }
    };
  }

  // Parse JSON
  let parsed;
  try {
    parsed = parseJSON(raw);
  } catch (err) {
    console.error(`[Parse] JSON parse failed for ${ticket_id}:`, err.message, '\nRaw:', raw?.substring(0, 200));
    return { error: true, status: 500, data: { error: 'Failed to parse LLM response. Please retry.', ticket_id } };
  }

  // Validate and sanitize
  const { data: validated, errors: validationErrors } = validate(parsed, ticket_id);

  const latencyMs = Date.now() - startMs;
  const safetyPassed = validationErrors.filter(e => e.includes('forbidden phrase')).length === 0;

  // Async log to Supabase (non-blocking)
  logTicket({
    ticketId: ticket_id,
    provider,
    latencyMs,
    caseType: validated.case_type,
    evidenceVerdict: validated.evidence_verdict,
    safetyPassed,
    confidence: validated.confidence,
    complaintHash: hashComplaint(complaint),
    validationErrors: validationErrors.length > 0 ? validationErrors : null
  }).catch(() => {});

  console.log(`[OK] ${ticket_id} | ${validated.case_type} | ${validated.evidence_verdict} | ${provider} | ${latencyMs}ms`);

  return {
    error: false,
    status: 200,
    data: {
      ...validated,
      _meta: { provider, masked_api_key: maskedApiKey }
    }
  };
}

// ── Main endpoint (single ticket) ─────────────────────────────
app.post('/analyze-ticket', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const result = await analyzeOneTicket(body);
  return res.status(result.status).json(result.data);
});

// ── Batch endpoint (multiple tickets) ─────────────────────────
app.post('/analyze-batch', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Accept either a raw array or an object with a "tickets" key
  let tickets;
  if (Array.isArray(body)) {
    tickets = body;
  } else if (Array.isArray(body.tickets)) {
    tickets = body.tickets;
  } else {
    return res.status(400).json({
      error: 'Batch payload must be a JSON array of tickets, or an object with a "tickets" array.'
    });
  }

  if (tickets.length === 0) {
    return res.status(400).json({ error: 'Tickets array is empty.' });
  }

  if (tickets.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 tickets per batch.' });
  }

  const results = [];
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    console.log(`[Batch] Processing ticket ${i + 1}/${tickets.length}: ${ticket.ticket_id || '(no id)'}`);
    const result = await analyzeOneTicket(ticket);
    results.push({
      index: i,
      ticket_id: ticket.ticket_id || null,
      success: !result.error,
      status: result.status,
      result: result.data
    });
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  console.log(`[Batch] Complete: ${successCount} succeeded, ${failCount} failed out of ${results.length}`);

  return res.status(200).json({
    batch: true,
    total: results.length,
    succeeded: successCount,
    failed: failCount,
    results
  });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Unhandled]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`QueueStorm Investigator running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});

module.exports = app;
