// Input validation and security checks

const { LIMITS, TRANSACTION_TYPES, TRANSACTION_STATUS } = require('./constants');

function validateRequestBody(body) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['Invalid JSON body'], sanitized: null };
  }

  const { ticket_id, complaint, transaction_history } = body;

  if (!ticket_id || typeof ticket_id !== 'string' || ticket_id.trim() === '') {
    errors.push('Missing required field: ticket_id');
  } else if (ticket_id.length > LIMITS.MAX_TICKET_ID_LENGTH) {
    errors.push(`ticket_id exceeds max length of ${LIMITS.MAX_TICKET_ID_LENGTH}`);
  }

  if (!complaint || typeof complaint !== 'string' || complaint.trim() === '') {
    errors.push('Missing or empty complaint field');
  } else if (complaint.length > LIMITS.MAX_COMPLAINT_LENGTH) {
    errors.push(`complaint exceeds max length of ${LIMITS.MAX_COMPLAINT_LENGTH}`);
  }

  let sanitizedHistory = [];
  if (transaction_history !== undefined && transaction_history !== null) {
    if (!Array.isArray(transaction_history)) {
      errors.push('transaction_history must be an array');
    } else {
      if (transaction_history.length > LIMITS.MAX_TRANSACTION_HISTORY) {
        errors.push(`transaction_history exceeds max of ${LIMITS.MAX_TRANSACTION_HISTORY} items`);
      }
      sanitizedHistory = transaction_history
        .filter((tx) => tx && typeof tx === 'object')
        .map((tx, index) => sanitizeTransaction(tx, index))
        .filter(Boolean);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, sanitized: null };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      ...body,
      ticket_id: ticket_id.trim(),
      complaint: complaint.trim(),
      transaction_history: sanitizedHistory
    }
  };
}

function sanitizeTransaction(tx, index) {
  const id = tx.transaction_id || `TXN-UNKNOWN-${index}`;
  const amount = Number(tx.amount);
  const type = TRANSACTION_TYPES.includes(tx.type) ? tx.type : 'payment';
  const status = TRANSACTION_STATUS.includes(tx.status) ? tx.status : 'completed';

  return {
    transaction_id: String(id).slice(0, 64),
    timestamp: tx.timestamp || null,
    type,
    amount: Number.isNaN(amount) ? 0 : amount,
    counterparty: tx.counterparty ? String(tx.counterparty).slice(0, 32) : '',
    status
  };
}

function detectLanguage(text = '') {
  const banglaChars = (text.match(/[\u0980-\u09FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  if (banglaChars > 0 && latinChars > 0) return 'mixed';
  if (banglaChars > 0) return 'bn';
  return 'en';
}

module.exports = {
  validateRequestBody,
  detectLanguage
};
