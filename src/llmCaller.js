// src/llmCaller.js
// Tries providers in priority order; falls back on error/timeout

const axios = require('axios');
const { geminiRotator, groqRotator, openrouterRotator } = require('./keyRotator');

const TIMEOUT = parseInt(process.env.LLM_TIMEOUT_MS || '25000');
const PRIORITY = (process.env.LLM_PRIORITY || 'gemini,groq,openrouter').split(',').map(s => s.trim());

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

function isRetryableStatus(status) {
  return [401, 403, 429, 402, 503, 500].includes(status);
}

async function callWithKeyRotation(rotator, providerName, callFn) {
  if (!rotator.hasKeys()) {
    throw new Error(`No ${providerName} keys configured (check .env)`);
  }

  const errors = [];
  const maxAttempts = rotator.count;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const key = rotator.next();
    try {
      const raw = await callFn(key);
      return { raw, masked_api_key: maskApiKey(key) };
    } catch (err) {
      const status = err.response?.status;
      const msg = getErrorMessage(err);
      errors.push(`${maskApiKey(key)} → ${msg}`);

      if (isRetryableStatus(status) && attempt < maxAttempts - 1) {
        console.warn(`[LLM] ${providerName} key ${maskApiKey(key)} failed (${msg}), trying next key…`);
        continue;
      }
      break;
    }
  }

  throw new Error(`${providerName} failed (${maxAttempts} key(s)): ${errors.join(' | ')}`);
}

async function callGemini(systemPrompt, userPrompt) {
  return callWithKeyRotation(geminiRotator, 'gemini', async (key) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
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
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 8192,
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
        model: 'google/gemini-3.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 4000,
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
  for (const provider of PRIORITY) {
    const fn = CALLERS[provider];
    if (!fn) continue;
    try {
      const { raw, masked_api_key } = await fn(systemPrompt, userPrompt);
      return { raw, provider, masked_api_key };
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
      console.warn(`[LLM] Provider ${provider} failed, trying next…`, err.message);
    }
  }
  throw new Error(`All LLM providers failed → ${errors.join(' | ')}`);
}

module.exports = { callLLM, maskApiKey, PRIORITY };
