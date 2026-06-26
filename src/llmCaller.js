// LLM caller — provider fallback, key rotation, retries, metrics

const axios = require('axios');
const { geminiRotator, groqRotator, openrouterRotator } = require('./keyRotator');

const TIMEOUT = parseInt(process.env.LLM_TIMEOUT_MS || '25000', 10);
const RETRY_DELAY_MS = parseInt(process.env.LLM_RETRY_DELAY_MS || '500', 10);
const MAX_RETRIES_PER_KEY = parseInt(process.env.LLM_MAX_RETRIES || '2', 10);

const PRIORITY = (process.env.LLM_PRIORITY || 'gemini,groq,openrouter')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MODELS = {
  gemini: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  groq: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  openrouter: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001'
};

const providerStats = {
  gemini: { attempts: 0, successes: 0, failures: 0, totalLatencyMs: 0 },
  groq: { attempts: 0, successes: 0, failures: 0, totalLatencyMs: 0 },
  openrouter: { attempts: 0, successes: 0, failures: 0, totalLatencyMs: 0 }
};

const circuitBreaker = {
  gemini: { failures: 0, openUntil: 0 },
  groq: { failures: 0, openUntil: 0 },
  openrouter: { failures: 0, openUntil: 0 }
};

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 60000;

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return 'N/A';
  if (key.length <= 4) return '****';
  return `${key.slice(0, 4)}••••••••`;
}

function getErrorMessage(err) {
  const status = err.response?.status;
  const apiMsg = err.response?.data?.error?.message
    || err.response?.data?.error?.status
    || err.response?.data?.message;
  if (status && apiMsg) return `HTTP ${status}: ${apiMsg}`;
  if (status) return `HTTP ${status}`;
  return err.message;
}

function isRetryableError(err) {
  const status = err.response?.status;
  if ([429, 503, 500, 502, 504].includes(status)) return true;
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return true;
  if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') return true;
  return false;
}

function isKeyRotationError(status) {
  return [401, 403, 429, 402].includes(status);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCircuitOpen(provider) {
  const cb = circuitBreaker[provider];
  if (!cb) return false;
  if (Date.now() < cb.openUntil) return true;
  return false;
}

function recordSuccess(provider, latencyMs) {
  const stats = providerStats[provider];
  if (stats) {
    stats.attempts += 1;
    stats.successes += 1;
    stats.totalLatencyMs += latencyMs;
  }
  if (circuitBreaker[provider]) {
    circuitBreaker[provider].failures = 0;
    circuitBreaker[provider].openUntil = 0;
  }
}

function recordFailure(provider) {
  const stats = providerStats[provider];
  if (stats) {
    stats.attempts += 1;
    stats.failures += 1;
  }
  const cb = circuitBreaker[provider];
  if (cb) {
    cb.failures += 1;
    if (cb.failures >= CIRCUIT_THRESHOLD) {
      cb.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
      console.warn(`[LLM] Circuit breaker OPEN for ${provider} (${CIRCUIT_COOLDOWN_MS}ms)`);
    }
  }
}

async function callWithKeyRotation(rotator, providerName, callFn) {
  if (!rotator.hasKeys()) {
    throw new Error(`No ${providerName} keys configured`);
  }

  const errors = [];
  const maxKeyAttempts = rotator.count;

  for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
    const key = rotator.next();

    for (let retry = 0; retry < MAX_RETRIES_PER_KEY; retry++) {
      const start = Date.now();
      try {
        const raw = await callFn(key);
        recordSuccess(providerName, Date.now() - start);
        return { raw, masked_api_key: maskApiKey(key) };
      } catch (err) {
        recordFailure(providerName);
        const status = err.response?.status;
        const msg = getErrorMessage(err);
        errors.push(`${maskApiKey(key)}[r${retry}] → ${msg}`);

        if (isRetryableError(err) && retry < MAX_RETRIES_PER_KEY - 1) {
          await sleep(RETRY_DELAY_MS * (retry + 1));
          continue;
        }

        if (isKeyRotationError(status) && keyAttempt < maxKeyAttempts - 1) {
          console.warn(`[LLM] ${providerName} key failed (${msg}), rotating…`);
          break;
        }

        throw new Error(`${providerName}: ${errors.join(' | ')}`);
      }
    }
  }

  throw new Error(`${providerName} failed (${maxKeyAttempts} key(s)): ${errors.join(' | ')}`);
}

async function callGemini(systemPrompt, userPrompt) {
  const model = MODELS.gemini;
  return callWithKeyRotation(geminiRotator, 'gemini', async (key) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 800,
        responseMimeType: 'application/json'
      }
    }, { timeout: TIMEOUT });

    const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Gemini returned empty response');
    return raw;
  });
}

async function callGroq(systemPrompt, userPrompt) {
  return callWithKeyRotation(groqRotator, 'groq', async (key) => {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: MODELS.groq,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      },
      {
        timeout: TIMEOUT,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
      }
    );

    const raw = res.data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Groq returned empty response');
    return raw;
  });
}

async function callOpenRouter(systemPrompt, userPrompt) {
  return callWithKeyRotation(openrouterRotator, 'openrouter', async (key) => {
    const res = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: MODELS.openrouter,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      },
      {
        timeout: TIMEOUT,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://queuestorm.local',
          'X-Title': 'QueueStorm Investigator'
        }
      }
    );

    const raw = res.data?.choices?.[0]?.message?.content;
    if (!raw) throw new Error('OpenRouter returned empty response');
    return raw;
  });
}

const CALLERS = {
  gemini: callGemini,
  groq: callGroq,
  openrouter: callOpenRouter
};

async function callLLM(systemPrompt, userPrompt) {
  const errors = [];
  const attemptLog = [];
  let fallbackUsed = false;
  let primaryProvider = null;

  for (let i = 0; i < PRIORITY.length; i++) {
    const provider = PRIORITY[i];
    const fn = CALLERS[provider];
    if (!fn) continue;

    if (isCircuitOpen(provider)) {
      errors.push(`${provider}: circuit open`);
      continue;
    }

    const attemptStart = Date.now();
    try {
      const { raw, masked_api_key } = await fn(systemPrompt, userPrompt);
      const latencyMs = Date.now() - attemptStart;

      if (i > 0) fallbackUsed = true;
      if (!primaryProvider) primaryProvider = provider;

      attemptLog.push({ provider, success: true, latencyMs, fallback: i > 0 });

      return {
        raw,
        provider,
        masked_api_key,
        fallback_used: fallbackUsed,
        latency_ms: latencyMs,
        attempt_log: attemptLog
      };
    } catch (err) {
      const latencyMs = Date.now() - attemptStart;
      attemptLog.push({ provider, success: false, latencyMs, error: err.message });
      errors.push(`${provider}: ${err.message}`);
      console.warn(`[LLM] Provider ${provider} failed (${latencyMs}ms), trying next…`, err.message);
    }
  }

  throw new Error(`All LLM providers failed → ${errors.join(' | ')}`);
}

function getProviderStats() {
  const result = {};
  for (const [provider, stats] of Object.entries(providerStats)) {
    result[provider] = {
      ...stats,
      avgLatencyMs: stats.successes > 0
        ? Math.round(stats.totalLatencyMs / stats.successes)
        : 0
    };
  }
  return result;
}

module.exports = {
  callLLM,
  maskApiKey,
  PRIORITY,
  getProviderStats,
  providerStats
};
