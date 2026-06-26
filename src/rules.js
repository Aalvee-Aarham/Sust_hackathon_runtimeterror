// Deterministic rule engine — severity, department, routing, human review (NOT LLM)

const {
  CASE_TYPES,
  CASE_TO_DEPARTMENT,
  MATCH_THRESHOLDS
} = require('./constants');

const CASE_PRIORITY = [
  'phishing_or_social_engineering',
  'wrong_transfer',
  'duplicate_payment',
  'payment_failed',
  'agent_cash_in_issue',
  'merchant_settlement_delay',
  'refund_request',
  'other'
];

function resolveCaseType(preFilterResult, matchContext, evidenceResult) {
  const hints = [];

  if (preFilterResult?.case_type) hints.push(preFilterResult.case_type);
  if (preFilterResult?.hint === 'phishing_or_social_engineering') {
    hints.push('phishing_or_social_engineering');
  }
  if (preFilterResult?.hint) {
    const hintMap = {
      wrong_transfer: 'wrong_transfer',
      duplicate_payment: 'duplicate_payment',
      payment_failed: 'payment_failed',
      refund_request: 'refund_request',
      merchant_settlement_delay: 'merchant_settlement_delay',
      agent_cash_in_issue: 'agent_cash_in_issue',
      phishing_or_social_engineering: 'phishing_or_social_engineering'
    };
    if (hintMap[preFilterResult.hint]) hints.push(hintMap[preFilterResult.hint]);
  }

  if (matchContext?.detectedIntent) hints.push(matchContext.detectedIntent);

  if (matchContext?.detectedType === 'settlement') hints.push('merchant_settlement_delay');
  if (matchContext?.detectedType === 'cash_in') hints.push('agent_cash_in_issue');

  for (const preferred of CASE_PRIORITY) {
    if (hints.includes(preferred)) return preferred;
  }

  if (evidenceResult?.reason_codes?.includes('duplicate_detected')) {
    return 'duplicate_payment';
  }

  return 'other';
}

function resolveSeverity(caseType, evidenceResult, matchedTransaction, complaint = '') {
  if (caseType === 'phishing_or_social_engineering') return 'critical';

  const amount = matchedTransaction?.amount ? Number(matchedTransaction.amount) : 0;
  const verdict = evidenceResult?.evidence_verdict;

  if (caseType === 'wrong_transfer' && verdict === 'consistent') return 'high';
  if (caseType === 'payment_failed' && verdict === 'consistent') return 'high';
  if (caseType === 'duplicate_payment' && verdict === 'consistent') return 'high';
  if (caseType === 'agent_cash_in_issue') return 'high';

  if (amount >= MATCH_THRESHOLDS.CRITICAL_AMOUNT_BDT) return 'high';
  if (amount >= MATCH_THRESHOLDS.HIGH_AMOUNT_BDT) return 'high';

  if (verdict === 'inconsistent') return 'medium';
  if (caseType === 'merchant_settlement_delay') return 'medium';
  if (caseType === 'refund_request') return 'low';

  if (/urgent|emergency|immediately|অতি\s*জরুরি|joldi|turant/i.test(complaint)) return 'medium';

  return 'low';
}

function resolveDepartment(caseType) {
  return CASE_TO_DEPARTMENT[caseType] || CASE_TO_DEPARTMENT.other;
}

function resolveHumanReview(caseType, evidenceResult, severity, matchedTransaction) {
  if (caseType === 'phishing_or_social_engineering') return true;
  if (caseType === 'wrong_transfer') return true;
  if (evidenceResult?.evidence_verdict === 'inconsistent') return true;
  if (evidenceResult?.ambiguous) return true;
  if (severity === 'critical' || severity === 'high') return true;

  const amount = matchedTransaction?.amount ? Number(matchedTransaction.amount) : 0;
  if (amount >= MATCH_THRESHOLDS.CRITICAL_AMOUNT_BDT) return true;

  if (evidenceResult?.reason_codes?.includes('manual_review_required')) return true;
  if (evidenceResult?.reason_codes?.includes('ambiguous_match')) return true;

  return false;
}

function resolveEscalation(caseType, severity, evidenceResult) {
  if (caseType === 'phishing_or_social_engineering') return 'fraud_escalation';
  if (severity === 'critical') return 'immediate_escalation';
  if (evidenceResult?.evidence_verdict === 'inconsistent') return 'supervisor_review';
  if (caseType === 'wrong_transfer') return 'dispute_escalation';
  if (caseType === 'duplicate_payment') return 'payments_escalation';
  if (caseType === 'merchant_settlement_delay') return 'merchant_escalation';
  if (caseType === 'agent_cash_in_issue') return 'agent_escalation';
  return 'standard_queue';
}

function resolveRouting(caseType, department) {
  const routes = {
    phishing_or_social_engineering: 'fraud_risk',
    wrong_transfer: 'dispute_resolution',
    duplicate_payment: 'payments_ops',
    payment_failed: 'payments_ops',
    merchant_settlement_delay: 'merchant_operations',
    agent_cash_in_issue: 'agent_operations',
    refund_request: 'customer_support',
    other: 'customer_support'
  };

  return {
    route: routes[caseType] || department,
    department,
    case_type: caseType
  };
}

function applyRules({
  preFilterResult = null,
  matchResult = {},
  evidenceResult = {},
  complaint = ''
}) {
  const matchContext = matchResult.context || {};
  const matchedTransaction = matchResult.best || null;

  const case_type = resolveCaseType(preFilterResult, matchContext, evidenceResult);
  const severity = resolveSeverity(case_type, evidenceResult, matchedTransaction, complaint);
  const department = resolveDepartment(case_type);
  const human_review_required = resolveHumanReview(
    case_type,
    evidenceResult,
    severity,
    matchedTransaction
  );
  const escalation = resolveEscalation(case_type, severity, evidenceResult);
  const routing = resolveRouting(case_type, department);

  const reason_codes = [];
  if (severity === 'high' || severity === 'critical') {
    reason_codes.push(severity === 'critical' ? 'critical_amount' : 'high_amount');
  }
  if (human_review_required) reason_codes.push('manual_review_required');

  return {
    case_type,
    severity,
    department,
    human_review_required,
    escalation,
    routing,
    reason_codes
  };
}

module.exports = {
  applyRules,
  resolveCaseType,
  resolveSeverity,
  resolveDepartment,
  resolveHumanReview,
  resolveEscalation,
  resolveRouting
};
