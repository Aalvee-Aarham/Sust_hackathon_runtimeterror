// src/validator.js
// Validates and sanitizes LLM output

const VALID_EVIDENCE = new Set(['consistent', 'inconsistent', 'insufficient_data']);
const VALID_CASE_TYPE = new Set([
  'wrong_transfer', 'payment_failed', 'refund_request', 'duplicate_payment',
  'merchant_settlement_delay', 'agent_cash_in_issue', 'phishing_or_social_engineering', 'other'
]);
const VALID_SEVERITY = new Set(['low', 'medium', 'high', 'critical']);
const VALID_DEPARTMENT = new Set([
  'customer_support', 'dispute_resolution', 'payments_ops',
  'merchant_operations', 'agent_operations', 'fraud_risk'
]);

// Dangerous phrases that must NOT appear in customer-facing fields
const FORBIDDEN_CUSTOMER_PHRASES = [
  /\bPIN\b/i,
  /\bOTP\b/i,
  /\bpassword\b/i,
  /\bwe will refund you\b/i,
  /\bwill return your money\b/i,
  /\byour money will be returned\b/i,
  /\bwe will reverse\b/i,
  /\baccount will be unblocked\b/i
];

function parseJSON(raw) {
  // Strip markdown fences if present
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function validate(data, ticketId) {
  const errors = [];

  // Required string fields
  if (data.ticket_id !== ticketId) {
    data.ticket_id = ticketId; // fix silently
  }

  if (!VALID_EVIDENCE.has(data.evidence_verdict)) {
    errors.push(`invalid evidence_verdict: ${data.evidence_verdict}`);
    data.evidence_verdict = 'insufficient_data';
  }

  if (!VALID_CASE_TYPE.has(data.case_type)) {
    errors.push(`invalid case_type: ${data.case_type}`);
    data.case_type = 'other';
  }

  if (!VALID_SEVERITY.has(data.severity)) {
    errors.push(`invalid severity: ${data.severity}`);
    data.severity = 'medium';
  }

  if (!VALID_DEPARTMENT.has(data.department)) {
    errors.push(`invalid department: ${data.department}`);
    data.department = 'customer_support';
  }

  if (typeof data.human_review_required !== 'boolean') {
    data.human_review_required = true; // safe default
  }

  if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
    data.confidence = 0.5;
  }

  if (!Array.isArray(data.reason_codes)) {
    data.reason_codes = [];
  }

  // Safety checks on customer_reply and recommended_next_action
  const safetyFields = ['customer_reply', 'recommended_next_action'];
  for (const field of safetyFields) {
    if (typeof data[field] !== 'string' || data[field].trim() === '') {
      data[field] = field === 'customer_reply'
        ? 'We have received your complaint and our team is reviewing it. Please do not share your PIN or OTP with anyone, including our support staff.'
        : 'Escalate to human agent for manual review.';
      errors.push(`missing or empty ${field}`);
    }
  }

  for (const pattern of FORBIDDEN_CUSTOMER_PHRASES) {
    if (pattern.test(data.customer_reply || '')) {
      errors.push(`forbidden phrase in customer_reply: ${pattern}`);
      // Append safety override
      data.customer_reply = data.customer_reply.replace(
        /we will refund you|will return your money|your money will be returned|we will reverse|account will be unblocked/gi,
        'any eligible amount will be returned through official channels'
      );
      // Strip credential asks
      data.customer_reply = data.customer_reply.replace(/\b(PIN|OTP|password)\b/gi, '[REDACTED]');
    }
  }

  // Ensure safety reminder exists in customer_reply
  const hasSafetyReminder = /pin|otp|share|credential|পিন|ওটিপি/i.test(data.customer_reply);
  if (!hasSafetyReminder) {
    data.customer_reply += ' Please never share your PIN or OTP with anyone.';
  }

  // Ensure agent_summary exists
  if (typeof data.agent_summary !== 'string' || data.agent_summary.trim() === '') {
    data.agent_summary = `Ticket ${ticketId} requires manual review. Evidence verdict: ${data.evidence_verdict}.`;
    errors.push('missing agent_summary');
  }

  return { data, errors };
}

module.exports = { parseJSON, validate };
