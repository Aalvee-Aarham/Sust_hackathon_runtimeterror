// Shared constants — single source of truth for enums, weights, and routing maps

const TRANSACTION_TYPES = [
  'transfer',
  'payment',
  'cash_in',
  'cash_out',
  'settlement',
  'refund'
];

const TRANSACTION_STATUS = [
  'completed',
  'failed',
  'pending',
  'reversed'
];

const CASE_TYPES = [
  'wrong_transfer',
  'payment_failed',
  'refund_request',
  'duplicate_payment',
  'merchant_settlement_delay',
  'agent_cash_in_issue',
  'phishing_or_social_engineering',
  'other'
];

const EVIDENCE_VERDICTS = [
  'consistent',
  'inconsistent',
  'insufficient_data'
];

const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'];

const DEPARTMENTS = [
  'customer_support',
  'dispute_resolution',
  'payments_ops',
  'merchant_operations',
  'agent_operations',
  'fraud_risk'
];

const CASE_TO_DEPARTMENT = {
  wrong_transfer: 'dispute_resolution',
  payment_failed: 'payments_ops',
  refund_request: 'customer_support',
  duplicate_payment: 'payments_ops',
  merchant_settlement_delay: 'merchant_operations',
  agent_cash_in_issue: 'agent_operations',
  phishing_or_social_engineering: 'fraud_risk',
  other: 'customer_support'
};

const MATCH_WEIGHTS = {
  AMOUNT_EXACT: 50,
  AMOUNT_CLOSE: 35,
  COUNTERPARTY: 30,
  STATUS: 20,
  TYPE: 15,
  TIME_EXACT: 25,
  TIME_DAY: 15,
  TIME_PERIOD: 10,
  MERCHANT: 15,
  DUPLICATE: 15
};

const MATCH_THRESHOLDS = {
  MIN_SCORE: 25,
  AMBIGUITY_DELTA: 5,
  ESTABLISHED_RECIPIENT_COUNT: 3,
  DUPLICATE_WINDOW_MS: 3600000,
  HIGH_AMOUNT_BDT: 5000,
  CRITICAL_AMOUNT_BDT: 10000,
  AMOUNT_TOLERANCE: 0.01
};

const VALID_REASON_CODES = new Set([
  'amount_match',
  'amount_close_match',
  'counterparty_match',
  'status_match',
  'type_match',
  'time_match',
  'time_day_match',
  'time_period_match',
  'merchant_match',
  'duplicate_detected',
  'transaction_match',
  'no_matching_transaction',
  'empty_history',
  'ambiguous_match',
  'multiple_matching_transactions',
  'established_recipient_pattern',
  'completed_transaction',
  'failed_transaction',
  'pending_transaction',
  'wrong_transfer_claim',
  'payment_failed_claim',
  'duplicate_payment_claim',
  'refund_request_claim',
  'merchant_delay_claim',
  'cash_in_claim',
  'phishing_detected',
  'injection_attempt_ignored',
  'bangla_complaint',
  'banglish_complaint',
  'english_complaint',
  'vague_complaint',
  'inconsistent_evidence',
  'manual_review_required',
  'high_amount',
  'critical_amount'
]);

const LIMITS = {
  MAX_COMPLAINT_LENGTH: 10000,
  MAX_TRANSACTION_HISTORY: 500,
  MAX_TICKET_ID_LENGTH: 128
};

module.exports = {
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
  CASE_TYPES,
  EVIDENCE_VERDICTS,
  SEVERITY_LEVELS,
  DEPARTMENTS,
  CASE_TO_DEPARTMENT,
  MATCH_WEIGHTS,
  MATCH_THRESHOLDS,
  VALID_REASON_CODES,
  LIMITS
};
