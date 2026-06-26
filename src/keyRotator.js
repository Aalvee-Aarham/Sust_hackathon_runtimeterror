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
}

function parseKeys(envVal) {
  if (!envVal) return [];
  return envVal.split(',').map(k => k.trim()).filter(Boolean);
}

const geminiRotator = new KeyRotator(parseKeys(process.env.GEMINI_API_KEYS));
const groqRotator = new KeyRotator(parseKeys(process.env.GROQ_API_KEYS));
const openrouterRotator = new KeyRotator(parseKeys(process.env.OPENROUTER_API_KEYS));

module.exports = { geminiRotator, groqRotator, openrouterRotator };
