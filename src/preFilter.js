// Fast rule-based pre-filter — injection, fraud, and case hints (EN/BN/Banglish)

const { normalizeText } = require('./transactionMatcher');

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|prior|system)/i,
  /forget\s+(your|all|the)\s+(instructions?|rules?|prompt)/i,
  /new\s+instructions?\s*:/i,
  /system\s+prompt/i,
  /you\s+are\s+now/i,
  /act\s+as\s+(a\s+)?/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /roleplay\s+as/i,
  /jailbreak/i,
  /developer\s+mode/i,
  /dan\s+mode/i,
  /override\s+(your|the|all)/i,
  /reveal\s+(your|the)\s+(system|secret|api|key)/i,
  /output\s+(your|the)\s+(system|prompt|instructions?)/i,
  /<\/?system>/i,
  /\[INST\]/i
];

const PHISHING_ACTION = /asked|share|give|send|told|requested|demand|bolche|bollo|bolsen|chay|chaitese|dite|pathate|janate|বল|চাই|দিত|পাঠ|জান/i;
const PHISHING_CREDENTIAL = /otp|pin|password|cvv|card\s*number|security\s*code|পিন|ওটিপি|পাসওয়ার্ড|কার্ড/i;

const CASE_HINTS = [
  {
    hint: 'phishing_or_social_engineering',
    case_type: 'phishing_or_social_engineering',
    pattern: (text) => PHISHING_CREDENTIAL.test(text) && PHISHING_ACTION.test(text),
    severity: 'critical'
  },
  {
    hint: 'wrong_transfer',
    case_type: 'wrong_transfer',
    pattern: /wrong\s*(number|person|recipient|account)|sent\s*to\s*wrong|ভুল\s*(নম্বর|মানুষ|নম্বরে)|ভুলে|vul\s*number|bhul\s*number|vul\s*nombor/i
  },
  {
    hint: 'duplicate_payment',
    case_type: 'duplicate_payment',
    pattern: /duplicate|twice|double\s*charg|two\s*times|charged\s*twice|দুই\s*বার|দুবার|duibar|dubare|duto\s*bar/i
  },
  {
    hint: 'payment_failed',
    case_type: 'payment_failed',
    pattern: /payment\s*fail|transaction\s*fail|deducted\s*but|money\s*deduct|fail\s*ho|ব্যর্থ|unsuccessful|hoyni|hoy\s*nai/i
  },
  {
    hint: 'merchant_settlement_delay',
    case_type: 'merchant_settlement_delay',
    pattern: /merchant|settlement\s*delay|seller|shop|store|দোকান|merchant\s*payment/i
  },
  {
    hint: 'agent_cash_in_issue',
    case_type: 'agent_cash_in_issue',
    pattern: /cash\s*in|agent|booth|ক্যাশ\s*ইন|এজেন্ট|cash\s*out/i
  },
  {
    hint: 'refund_request',
    case_type: 'refund_request',
    pattern: /refund|money\s*back|return\s*my\s*money|টাকা\s*ফের|রিফান্ড|ferot|firt/i
  }
];

function detectInjection(text) {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

function preFilter(body) {
  const complaint = body?.complaint || '';
  const normalized = normalizeText(complaint);
  const reason_codes = [];

  if (detectInjection(complaint) || detectInjection(normalized)) {
    return {
      hint: 'injection_attempt',
      sanitize: true,
      flagged: true,
      security_flag: 'prompt_injection',
      reason_codes: ['injection_attempt_ignored']
    };
  }

  for (const rule of CASE_HINTS) {
    const matched = typeof rule.pattern === 'function'
      ? rule.pattern(complaint) || rule.pattern(normalized)
      : rule.pattern.test(complaint) || rule.pattern.test(normalized);

    if (matched) {
      const result = {
        hint: rule.hint,
        case_type: rule.case_type,
        flagged: false,
        reason_codes: [rule.hint.replace(/ /g, '_') + '_claim']
      };
      if (rule.severity) result.severity = rule.severity;
      if (/[\u0980-\u09FF]/.test(complaint)) {
        result.reason_codes.push(/[a-zA-Z]/.test(complaint) ? 'banglish_complaint' : 'bangla_complaint');
      } else {
        result.reason_codes.push('english_complaint');
      }
      return result;
    }
  }

  if (/[\u0980-\u09FF]/.test(complaint)) {
    reason_codes.push(/[a-zA-Z]/.test(complaint) ? 'banglish_complaint' : 'bangla_complaint');
  } else {
    reason_codes.push('english_complaint');
  }

  if (/vague|not\s*sure|maybe|something|কিছু|জানি\s*না/i.test(normalized)) {
    reason_codes.push('vague_complaint');
  }

  return reason_codes.length > 0 ? { hint: null, flagged: false, reason_codes } : null;
}

module.exports = { preFilter, detectInjection };
