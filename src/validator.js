// Strict output validation and sanitization

const {
  EVIDENCE_VERDICTS,
  CASE_TYPES,
  SEVERITY_LEVELS,
  DEPARTMENTS,
  VALID_REASON_CODES
} = require('./constants');

const FORBIDDEN_CUSTOMER_PATTERNS = [
  /\bshare\s+your\s+(pin|otp|password)\b/i,
  /\b(send|give|provide)\s+(me\s+)?(your\s+)?(pin|otp|password|cvv)\b/i,
  /\bwe\s+will\s+refund\b/i,
  /\bguaranteed\s+refund\b/i,
  /\bmoney\s+back\s+guaranteed\b/i,
  /\bwill\s+return\s+your\s+money\b/i,
  /\bwe\s+will\s+reverse\b/i,
  /\baccount\s+will\s+be\s+unblocked\b/i,
  /\b(taka|money)\s+ferot\s+dibo\b/i,
  /\brefund\s+kore\s+dibo\b/i,
  /\b(pocket|bkash|nagad|rocket)\s+(pin|otp)\b/i
];

const CREDENTIAL_LEAK_PATTERNS = [
  /\bsk-[a-zA-Z0-9]{10,}\b/,
  /\bAIza[a-zA-Z0-9_-]{20,}\b/,
  /\b(api[_-]?key|secret[_-]?key)\s*[:=]\s*\S+/i,
  /\bBearer\s+[a-zA-Z0-9._-]{20,}\b/
];

const DEFAULT_CUSTOMER_REPLY =
  'We have received your complaint and our team is reviewing it. Please do not share your PIN or OTP with anyone, including people claiming to be support staff.';

const DEFAULT_NEXT_ACTION = 'Escalate to human agent for manual review.';

function parseJSON(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty LLM response');
  }

  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '');

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  return JSON.parse(cleaned);
}

function clampConfidence(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

function sanitizeReasonCodes(codes) {
  if (!Array.isArray(codes)) return [];
  return [...new Set(
    codes
      .filter((c) => typeof c === 'string')
      .map((c) => c.trim().toLowerCase())
      .filter((c) => VALID_REASON_CODES.has(c))
  )];
}

function checkForbiddenPhrases(text, fieldName, errors) {
  if (typeof text !== 'string') return text;

  let sanitized = text;
  for (const pattern of FORBIDDEN_CUSTOMER_PATTERNS) {
    if (pattern.test(sanitized)) {
      errors.push(`forbidden phrase in ${fieldName}`);
      sanitized = sanitized.replace(
        /we will refund|guaranteed refund|money back guaranteed|will return your money|we will reverse|account will be unblocked|refund kore dibo|taka ferot dibo/gi,
        'any eligible amount will be returned through official channels'
      );
    }
  }

  for (const pattern of CREDENTIAL_LEAK_PATTERNS) {
    if (pattern.test(sanitized)) {
      errors.push(`credential leak detected in ${fieldName}`);
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
  }

  return sanitized;
}

function ensureSafetyReminder(text, language) {
  if (typeof text !== 'string') return DEFAULT_CUSTOMER_REPLY;

  const hasReminder = /pin|otp|share|credential|পিন|ওটিপি|শেয়ার/i.test(text);
  if (hasReminder) return text;

  if (language === 'bn' || language === 'mixed') {
    return `${text} অনুগ্রহ করে কখনোই আপনার PIN বা OTP কারো সাথে শেয়ার করবেন না।`;
  }
  return `${text} Please never share your PIN or OTP with anyone.`;
}

function validateNarrative(parsed, language) {
  const errors = [];
  const data = {};

  const fields = ['agent_summary', 'recommended_next_action', 'customer_reply'];
  for (const field of fields) {
    if (typeof parsed[field] !== 'string' || parsed[field].trim() === '') {
      errors.push(`missing or empty ${field}`);
      data[field] = field === 'customer_reply'
        ? DEFAULT_CUSTOMER_REPLY
        : field === 'recommended_next_action'
          ? DEFAULT_NEXT_ACTION
          : 'Ticket requires manual review.';
    } else {
      data[field] = parsed[field].trim();
    }
  }

  data.customer_reply = checkForbiddenPhrases(data.customer_reply, 'customer_reply', errors);
  data.recommended_next_action = checkForbiddenPhrases(data.recommended_next_action, 'recommended_next_action', errors);
  data.agent_summary = checkForbiddenPhrases(data.agent_summary, 'agent_summary', errors);

  data.customer_reply = ensureSafetyReminder(data.customer_reply, language);

  if (data.customer_reply.length > 2000) {
    data.customer_reply = data.customer_reply.slice(0, 1997) + '...';
    errors.push('customer_reply truncated');
  }

  return { data, errors };
}

function assembleResponse({
  ticketId,
  narrative,
  evidenceResult,
  rulesResult,
  preFilterResult,
  transactionHistory = []
}) {
  const errors = [...(narrative.errors || [])];

  const evidence_verdict = EVIDENCE_VERDICTS.includes(evidenceResult?.evidence_verdict)
    ? evidenceResult.evidence_verdict
    : 'insufficient_data';

  const case_type = CASE_TYPES.includes(rulesResult?.case_type)
    ? rulesResult.case_type
    : 'other';

  const severity = SEVERITY_LEVELS.includes(rulesResult?.severity)
    ? rulesResult.severity
    : 'medium';

  const department = DEPARTMENTS.includes(rulesResult?.department)
    ? rulesResult.department
    : 'customer_support';

  let relevant_transaction_id = evidenceResult?.relevant_transaction_id ?? null;

  if (relevant_transaction_id && transactionHistory.length > 0) {
    const validIds = new Set(transactionHistory.map((tx) => tx.transaction_id));
    if (!validIds.has(relevant_transaction_id)) {
      errors.push(`invalid relevant_transaction_id: ${relevant_transaction_id}`);
      relevant_transaction_id = null;
    }
  }

  const confidence = clampConfidence(evidenceResult?.confidence);

  const reason_codes = sanitizeReasonCodes([
    ...(evidenceResult?.reason_codes || []),
    ...(rulesResult?.reason_codes || []),
    ...(preFilterResult?.reason_codes || [])
  ]);

  const human_review_required = typeof rulesResult?.human_review_required === 'boolean'
    ? rulesResult.human_review_required
    : true;

  return {
    data: {
      ticket_id: ticketId,
      relevant_transaction_id,
      evidence_verdict,
      case_type,
      severity,
      department,
      agent_summary: narrative.data.agent_summary,
      recommended_next_action: narrative.data.recommended_next_action,
      customer_reply: narrative.data.customer_reply,
      human_review_required,
      confidence,
      reason_codes
    },
    errors
  };
}

function validate(parsed, ticketId, context = {}) {
  const language = context.language || 'en';
  const narrative = validateNarrative(parsed, language);

  if (context.evidenceResult && context.rulesResult) {
    return assembleResponse({
      ticketId,
      narrative,
      evidenceResult: context.evidenceResult,
      rulesResult: context.rulesResult,
      preFilterResult: context.preFilterResult,
      transactionHistory: context.transactionHistory || []
    });
  }

  return {
    data: {
      ticket_id: ticketId,
      ...narrative.data,
      relevant_transaction_id: parsed.relevant_transaction_id ?? null,
      evidence_verdict: EVIDENCE_VERDICTS.includes(parsed.evidence_verdict)
        ? parsed.evidence_verdict
        : 'insufficient_data',
      case_type: CASE_TYPES.includes(parsed.case_type) ? parsed.case_type : 'other',
      severity: SEVERITY_LEVELS.includes(parsed.severity) ? parsed.severity : 'medium',
      department: DEPARTMENTS.includes(parsed.department) ? parsed.department : 'customer_support',
      human_review_required: typeof parsed.human_review_required === 'boolean'
        ? parsed.human_review_required
        : true,
      confidence: clampConfidence(parsed.confidence),
      reason_codes: sanitizeReasonCodes(parsed.reason_codes)
    },
    errors: narrative.errors
  };
}

module.exports = {
  parseJSON,
  validate,
  validateNarrative,
  assembleResponse,
  sanitizeReasonCodes
};
