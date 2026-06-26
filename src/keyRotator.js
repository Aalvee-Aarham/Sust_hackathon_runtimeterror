// src/keyRotator.js
// Round-robin key rotation for multiple API keys per provider

class KeyRotator {
  constructor(keys) {
    this.keys = keys.filter(Boolean);
    this.index = 0;
  }

  next() {
    if (this.keys.length === 0) return null;
    const key = this.keys[this.index % this.keys.length];
    this.index = (this.index + 1) % this.keys.length;
    return key;
  }

  hasKeys() {
    return this.keys.length > 0;
  }

  get count() {
    return this.keys.length;
  }
}

function isPlaceholderKey(key) {
  if (!key || key.length < 12) return true;
  return /^(your_|key\d+|sk-xxx|xxx)/i.test(key);
}

function parseKeys(envVal) {
  if (!envVal) return [];
  return envVal
    .split(',')
    .map((k) => k.trim().replace(/^["']|["']$/g, ''))
    .filter((k) => k && !isPlaceholderKey(k));
}

const geminiRotator = new KeyRotator(parseKeys(process.env.GEMINI_API_KEYS));
const groqRotator = new KeyRotator(parseKeys(process.env.GROQ_API_KEYS));
const openrouterRotator = new KeyRotator(parseKeys(process.env.OPENROUTER_API_KEYS));

module.exports = { geminiRotator, groqRotator, openrouterRotator, isPlaceholderKey };
