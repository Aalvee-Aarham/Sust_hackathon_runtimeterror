// src/llmCaller.js
// Tries providers in priority order; falls back on error/timeout

const axios = require('axios');
const { geminiRotator, groqRotator, openrouterRotator } = require('./keyRotator');

const TIMEOUT = parseInt(process.env.LLM_TIMEOUT_MS || '25000');
const PRIORITY = (process.env.LLM_PRIORITY || 'gemini,groq,openrouter').split(',').map(s => s.trim());

async function callGemini(systemPrompt, userPrompt) {
  const key = geminiRotator.next();
  if (!key) throw new Error('No Gemini keys configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
  const body = {
    contents: [
      {
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1200,
      responseMimeType: 'application/json'
    }
  };

  const res = await axios.post(url, body, { timeout: TIMEOUT });
  const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Gemini returned empty response');
  return raw;
}

async function callGroq(systemPrompt, userPrompt) {
  const key = groqRotator.next();
  if (!key) throw new Error('No Groq keys configured');

  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 1200,
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
}

async function callOpenRouter(systemPrompt, userPrompt) {
  const key = openrouterRotator.next();
  if (!key) throw new Error('No OpenRouter keys configured');

  const res = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 1200,
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
      const raw = await fn(systemPrompt, userPrompt);
      return { raw, provider };
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
      // try next provider
    }
  }
  throw new Error(`All LLM providers failed: ${errors.join(' | ')}`);
}

module.exports = { callLLM };
