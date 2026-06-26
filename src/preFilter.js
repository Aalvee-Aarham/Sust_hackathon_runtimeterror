// src/preFilter.js
// Fast rule-based pre-filter before hitting any LLM

function preFilter(body) {
  const complaint = (body.complaint || '').toLowerCase();

  // Injection attempt detection
  if (/ignore previous|system prompt|pretend you|jailbreak|disregard|forget your|new instructions|override|act as|you are now|roleplay as/.test(complaint)) {
    return { hint: 'injection_attempt', sanitize: true, flagged: true };
  }

  // Phishing detection (English + Bangla signals)
  if (
    /otp|pin|password|পিন|ওটিপি|পাসওয়ার্ড/.test(complaint) &&
    /asked|share|give|send|told|বলেছে|চাইছে|দিতে|পাঠাতে|জানতে/.test(complaint)
  ) {
    return { hint: 'phishing_or_social_engineering', severity: 'critical', flagged: false };
  }

  // Duplicate payment timing hint (will still go to LLM but with hint)
  if (/duplicate|twice|double|charged twice|two times|দুইবার|দুবার/.test(complaint)) {
    return { hint: 'duplicate_payment', flagged: false };
  }

  // Wrong transfer hint
  if (/wrong number|wrong person|wrong recipient|ভুল নম্বর|ভুল মানুষ|ভুলে/.test(complaint)) {
    return { hint: 'wrong_transfer', flagged: false };
  }

  return null;
}

module.exports = { preFilter };
