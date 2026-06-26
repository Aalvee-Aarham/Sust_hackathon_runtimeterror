// Deterministic evidence reasoning — consumes matcher output, no duplicate matching logic

const { MATCH_THRESHOLDS } = require('./constants');

function countRecipientOccurrences(history, counterparty) {
  if (!counterparty) return 0;
  const normalized = String(counterparty).replace(/\D/g, '').slice(-11);
  return history.filter((tx) => {
    const cp = String(tx.counterparty || '').replace(/\D/g, '').slice(-11);
    return cp === normalized && cp !== '';
  }).length;
}

function buildEvidence(matchResult = {}, complaint = '', transactionHistory = []) {
  const history = Array.isArray(transactionHistory) ? transactionHistory : [];
  const { best, candidates, ambiguous, context, duplicates } = matchResult;
  const text = typeof complaint === 'string' ? complaint : '';

  const supporting = [];
  const contradicting = [];
  const reason_codes = [];

  if (history.length === 0) {
    return {
      evidence_verdict: 'insufficient_data',
      confidence: 0.3,
      reason_codes: ['empty_history'],
      supporting_evidence: ['No transaction history provided'],
      contradicting_evidence: [],
      explanation: 'Cannot verify claim without transaction records.',
      relevant_transaction_id: null,
      ambiguous: false
    };
  }

  if (!best && (ambiguous || (candidates && candidates.length > 1))) {
    return {
      evidence_verdict: 'insufficient_data',
      confidence: 0.55,
      reason_codes: ['ambiguous_match', 'multiple_matching_transactions', 'manual_review_required'],
      supporting_evidence: candidates.slice(0, 3).map(
        (c) => `Candidate ${c.transaction_id}: score ${c.score}, amount ${c.amount}`
      ),
      contradicting_evidence: [],
      explanation: 'Multiple transactions match equally; manual review required.',
      relevant_transaction_id: null,
      ambiguous: true
    };
  }

  if (!best) {
    return {
      evidence_verdict: 'insufficient_data',
      confidence: 0.35,
      reason_codes: ['no_matching_transaction'],
      supporting_evidence: [],
      contradicting_evidence: ['No transaction met minimum match confidence'],
      explanation: 'Complaint details do not match any transaction in history.',
      relevant_transaction_id: null,
      ambiguous: false
    };
  }

  const intent = context?.detectedIntent;
  const recipientCount = countRecipientOccurrences(history, best.counterparty);

  if (best.reason_codes) reason_codes.push(...best.reason_codes);

  supporting.push(
    `Best match: ${best.transaction_id} (score ${best.score}, amount ${best.amount}, status ${best.status})`
  );

  if (best.reason_codes?.includes('amount_match')) {
    supporting.push('Reported amount matches transaction amount');
  }
  if (best.reason_codes?.includes('counterparty_match')) {
    supporting.push('Counterparty phone matches complaint');
  }
  if (best.reason_codes?.includes('status_match')) {
    supporting.push('Transaction status aligns with complaint');
  }

  if (intent === 'wrong_transfer' || /wrong|ভুল|vul|bhul/i.test(text)) {
    reason_codes.push('wrong_transfer_claim');
    if (recipientCount >= MATCH_THRESHOLDS.ESTABLISHED_RECIPIENT_COUNT) {
      contradicting.push(
        `Recipient ${best.counterparty} appears ${recipientCount} times — established recipient pattern`
      );
      return {
        evidence_verdict: 'inconsistent',
        confidence: 0.92,
        reason_codes: [...new Set([...reason_codes, 'established_recipient_pattern', 'inconsistent_evidence'])],
        supporting_evidence: supporting,
        contradicting_evidence: contradicting,
        explanation: 'Customer claims wrong transfer but frequently sends to this recipient.',
        relevant_transaction_id: best.transaction_id,
        ambiguous: false
      };
    }
  }

  if (
    (intent === 'payment_failed' || /fail|failed|unsuccessful|ব্যর্থ/i.test(text)) &&
    best.status === 'completed'
  ) {
    contradicting.push('Customer claims failure but matched transaction is completed');
    return {
      evidence_verdict: 'inconsistent',
      confidence: 0.9,
      reason_codes: [...new Set([...reason_codes, 'payment_failed_claim', 'completed_transaction', 'inconsistent_evidence'])],
      supporting_evidence: supporting,
      contradicting_evidence: contradicting,
      explanation: 'Payment reported as failed but transaction record shows completed.',
      relevant_transaction_id: best.transaction_id,
      ambiguous: false
    };
  }

  if (best.status === 'failed' && (intent === 'payment_failed' || /fail|failed|ব্যর্থ/i.test(text))) {
    supporting.push('Transaction status is failed, consistent with complaint');
    return {
      evidence_verdict: 'consistent',
      confidence: 0.88,
      reason_codes: [...new Set([...reason_codes, 'payment_failed_claim', 'failed_transaction', 'transaction_match'])],
      supporting_evidence: supporting,
      contradicting_evidence: contradicting,
      explanation: 'Failed transaction matches customer complaint.',
      relevant_transaction_id: best.transaction_id,
      ambiguous: false
    };
  }

  if (best.status === 'pending' && (intent === 'payment_failed' || /pending|অপেক্ষ/i.test(text))) {
    supporting.push('Transaction is still pending');
    return {
      evidence_verdict: 'consistent',
      confidence: 0.82,
      reason_codes: [...new Set([...reason_codes, 'pending_transaction', 'transaction_match'])],
      supporting_evidence: supporting,
      contradicting_evidence: contradicting,
      explanation: 'Pending transaction aligns with customer concern.',
      relevant_transaction_id: best.transaction_id,
      ambiguous: false
    };
  }

  if (
    (intent === 'duplicate_payment' || /duplicate|twice|double|দুই\s*বার|দুবার/i.test(text)) &&
    duplicates && duplicates.length > 0
  ) {
    supporting.push(`Found ${duplicates.length} potential duplicate pair(s) in history`);
    return {
      evidence_verdict: 'consistent',
      confidence: 0.87,
      reason_codes: [...new Set([...reason_codes, 'duplicate_payment_claim', 'duplicate_detected', 'transaction_match'])],
      supporting_evidence: supporting,
      contradicting_evidence: contradicting,
      explanation: 'Duplicate transactions detected matching customer claim.',
      relevant_transaction_id: best.transaction_id,
      ambiguous: false
    };
  }

  if (intent === 'duplicate_payment' && !duplicates?.length) {
    contradicting.push('Duplicate payment claimed but no duplicate pairs found in history');
    return {
      evidence_verdict: 'inconsistent',
      confidence: 0.75,
      reason_codes: [...new Set([...reason_codes, 'duplicate_payment_claim', 'inconsistent_evidence'])],
      supporting_evidence: supporting,
      contradicting_evidence: contradicting,
      explanation: 'Customer claims duplicate charge but history shows no duplicate pair.',
      relevant_transaction_id: best.transaction_id,
      ambiguous: false
    };
  }

  const confidence = Math.min(0.95, Math.max(0.65, best.confidence || best.score / 100));
  return {
    evidence_verdict: 'consistent',
    confidence,
    reason_codes: [...new Set([...reason_codes, 'transaction_match'])],
    supporting_evidence: supporting,
    contradicting_evidence: contradicting,
    explanation: 'Transaction data supports the customer complaint.',
    relevant_transaction_id: best.transaction_id,
    ambiguous: false
  };
}

module.exports = { buildEvidence };
