// Production transaction matching engine — English, Bangla, Banglish support

const { MATCH_WEIGHTS, MATCH_THRESHOLDS } = require('./constants');

const PHONE_REGEX = /(?:\+8801|8801|01)[0-9০-৯]{9}/g;

const BANGLA_DIGITS = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

const CURRENCY_PATTERN = /\b(\d+(?:\.\d+)?)\s*(k|tk|taka|bdt|টাকা|টকা)\b/gi;

const AMOUNT_WITH_CONTEXT = /\b(\d{1,7}(?:\.\d{1,2})?)\s*(k|tk|taka|bdt|টাকা|টকা)?\b/gi;

const INTENT_PATTERNS = {
  wrong_transfer: /wrong\s*(number|person|recipient|account)|sent\s*to\s*wrong|ভুল\s*(নম্বর|মানুষ|নম্বরে|অ্যাকাউন্ট)|ভুলে\s*(পাঠ|দিয়|টাকা)|vul\s*(number|nombor)|bhul\s*(number|nombor)/i,
  payment_failed: /payment\s*fail|transaction\s*fail|deducted\s*but|money\s*deduct|charge\s*fail|fail\s*ho|ব্যর্থ|কাটা\s*গেছে\s*কিন্তু|transaction\s*unsuccessful|unsuccessful/i,
  duplicate_payment: /duplicate|twice|double\s*charg|two\s*times|charged\s*twice|দুই\s*বার|দুবার|duibar|dubare/i,
  refund_request: /refund|money\s*back|return\s*my\s*money|টাকা\s*ফের|রিফান্ড|ferot|firt/i,
  merchant_settlement_delay: /merchant|settlement|seller|shop|দোকান|merchant\s*delay|settlement\s*delay/i,
  agent_cash_in_issue: /cash\s*in|agent|booth|cash\s*out|ক্যাশ\s*ইন|এজেন্ট/i,
  phishing_or_social_engineering: /otp|pin|password|পিন|ওটিপি|পাসওয়ার্ড/i
};

const TYPE_KEYWORDS = {
  transfer: /transfer|send\s*money|sent\s*taka|pathiy|pathano|পাঠ|ট্রান্সফার/i,
  payment: /payment|pay\s*bill|bill\s*pay|পেমেন্ট/i,
  cash_in: /cash\s*in|add\s*money|top\s*up|ক্যাশ\s*ইন/i,
  cash_out: /cash\s*out|withdraw|উত্তোলন/i,
  settlement: /settlement|merchant|settle/i,
  refund: /refund|রিফান্ড/i
};

const STATUS_KEYWORDS = {
  failed: /fail|failed|unsuccessful|error|ব্যর্থ|hoyni|hoy nai/i,
  pending: /pending|processing|wait|অপেক্ষ|pend/i,
  completed: /success|completed|done|received|সফল|pouch|peye/i,
  reversed: /reverse|reversed|ফেরত\s*দিয়|reversal/i
};

const TIME_PATTERNS = {
  today: /\b(today|aj|aaj|আজ)\b/i,
  yesterday: /\b(yesterday|gato?kal|গত\s*কাল|gatkale)\b/i,
  morning: /\b(morning|sokal|shokal|সকাল|9\s*am|10\s*am|11\s*am)\b/i,
  evening: /\b(evening|bikal|বিকাল|afternoon|4\s*pm|5\s*pm|6\s*pm)\b/i,
  night: /\b(night|rat|রাত|late\s*night|10\s*pm|11\s*pm|12\s*am)\b/i
};

const TIME_OF_DAY_RANGES = {
  morning: [5, 11],
  evening: [12, 18],
  night: [19, 4]
};

function normalizeText(text = '') {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] || d)
    .replace(/,/g, '')
    .toLowerCase()
    .trim();
}

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 11) return digits.slice(-11);
  return digits;
}

function isPhoneLikeNumber(value) {
  const str = String(value);
  return str.length >= 10 && str.startsWith('01');
}

function extractPhones(text = '') {
  const normalized = text.replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] || d);
  const matches = normalized.match(PHONE_REGEX) || [];
  return [...new Set(matches.map((m) => normalizePhone(m)))];
}

function extractPhone(text = '') {
  const phones = extractPhones(text);
  return phones.length > 0 ? phones[0] : null;
}

function parseAmountValue(raw, unit) {
  let value = Number(raw);
  if (Number.isNaN(value)) return null;
  if (unit && unit.toLowerCase() === 'k') value *= 1000;
  if (value < 1 || value > 50000000) return null;
  if (isPhoneLikeNumber(raw) && !unit) return null;
  return value;
}

function extractAmount(text = '') {
  const normalized = normalizeText(text);
  const candidates = [];

  for (const match of normalized.matchAll(CURRENCY_PATTERN)) {
    const value = parseAmountValue(match[1], match[2]);
    if (value !== null) candidates.push({ value, priority: 3 });
  }

  for (const match of normalized.matchAll(AMOUNT_WITH_CONTEXT)) {
    const value = parseAmountValue(match[1], match[2]);
    if (value !== null) {
      const priority = match[2] ? 2 : 1;
      candidates.push({ value, priority });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.priority - a.priority || b.value - a.value);
  return candidates[0].value;
}

function detectIntent(text = '') {
  const intents = [];
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(text)) intents.push(intent);
  }
  if (intents.includes('phishing_or_social_engineering') &&
      /asked|share|give|send|told|বল|চাই|দিত|পাঠ|bolche|bollo|dite|pathate/.test(text)) {
    return 'phishing_or_social_engineering';
  }
  const priority = [
    'phishing_or_social_engineering',
    'wrong_transfer',
    'duplicate_payment',
    'payment_failed',
    'agent_cash_in_issue',
    'merchant_settlement_delay',
    'refund_request'
  ];
  for (const p of priority) {
    if (intents.includes(p)) return p;
  }
  return intents[0] || null;
}

function detectTransactionType(text = '') {
  for (const [type, pattern] of Object.entries(TYPE_KEYWORDS)) {
    if (pattern.test(text)) return type;
  }
  return null;
}

function detectStatus(text = '') {
  for (const [status, pattern] of Object.entries(STATUS_KEYWORDS)) {
    if (pattern.test(text)) return status;
  }
  return null;
}

function detectMerchant(text = '') {
  return /merchant|seller|shop|store|vendor|দোকান|merchant\s*name/i.test(text);
}

function parseRelativeTime(text = '') {
  const result = { day: null, period: null, hour: null };

  if (TIME_PATTERNS.today.test(text)) result.day = 'today';
  if (TIME_PATTERNS.yesterday.test(text)) result.day = 'yesterday';
  if (TIME_PATTERNS.morning.test(text)) result.period = 'morning';
  if (TIME_PATTERNS.evening.test(text)) result.period = 'evening';
  if (TIME_PATTERNS.night.test(text)) result.period = 'night';

  const clockMatch = text.match(/\b(\d{1,2})\s*(:\s*\d{2})?\s*(am|pm)\b/i);
  if (clockMatch) {
    let hour = parseInt(clockMatch[1], 10);
    const meridiem = clockMatch[3].toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    result.hour = hour;
  }

  return result;
}

function isSameDay(dateA, dateB) {
  return dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate();
}

function isYesterday(txDate, now) {
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return isSameDay(txDate, yesterday);
}

function isInPeriod(hour, period) {
  const range = TIME_OF_DAY_RANGES[period];
  if (!range) return false;
  if (range[0] <= range[1]) return hour >= range[0] && hour <= range[1];
  return hour >= range[0] || hour <= range[1];
}

function scoreTimeMatch(tx, timeHints, now = new Date()) {
  if (!tx.timestamp) return { score: 0, reasons: [] };

  const txDate = new Date(tx.timestamp);
  if (Number.isNaN(txDate.getTime())) return { score: 0, reasons: [] };

  const reasons = [];
  let score = 0;
  const txHour = txDate.getUTCHours();

  if (timeHints.hour !== null && txHour === timeHints.hour) {
    score += MATCH_WEIGHTS.TIME_EXACT;
    reasons.push('time_match');
  }

  if (timeHints.day === 'today' && isSameDay(txDate, now)) {
    score += MATCH_WEIGHTS.TIME_DAY;
    reasons.push('time_day_match');
  }

  if (timeHints.day === 'yesterday' && isYesterday(txDate, now)) {
    score += MATCH_WEIGHTS.TIME_DAY;
    reasons.push('time_day_match');
  }

  if (timeHints.period && isInPeriod(txHour, timeHints.period)) {
    score += MATCH_WEIGHTS.TIME_PERIOD;
    reasons.push('time_period_match');
  }

  return { score, reasons };
}

function amountsMatch(txAmount, extractedAmount) {
  const tx = Number(txAmount);
  if (Number.isNaN(tx) || extractedAmount === null) return { exact: false, close: false };
  const exact = tx === extractedAmount;
  const close = !exact && Math.abs(tx - extractedAmount) / Math.max(tx, 1) <= MATCH_THRESHOLDS.AMOUNT_TOLERANCE;
  return { exact, close };
}

function scoreTransaction(tx, complaint = '', context = {}) {
  const text = context.normalizedText || normalizeText(complaint);
  const extractedAmount = context.extractedAmount ?? extractAmount(text);
  const extractedPhones = context.extractedPhones ?? extractPhones(text);
  const detectedStatus = context.detectedStatus ?? detectStatus(text);
  const detectedType = context.detectedType ?? detectTransactionType(text);
  const timeHints = context.timeHints ?? parseRelativeTime(text);
  const isMerchant = context.isMerchant ?? detectMerchant(text);

  let score = 0;
  const reasons = [];

  const amountResult = amountsMatch(tx.amount, extractedAmount);
  if (amountResult.exact) {
    score += MATCH_WEIGHTS.AMOUNT_EXACT;
    reasons.push('amount_match');
  } else if (amountResult.close) {
    score += MATCH_WEIGHTS.AMOUNT_CLOSE;
    reasons.push('amount_close_match');
  }

  const txPhone = normalizePhone(tx.counterparty || '');
  if (txPhone && extractedPhones.some((p) => p === txPhone)) {
    score += MATCH_WEIGHTS.COUNTERPARTY;
    reasons.push('counterparty_match');
  }

  if (detectedStatus && tx.status === detectedStatus) {
    score += MATCH_WEIGHTS.STATUS;
    reasons.push('status_match');
  }

  if (detectedType && tx.type === detectedType) {
    score += MATCH_WEIGHTS.TYPE;
    reasons.push('type_match');
  }

  if (isMerchant && (tx.type === 'settlement' || tx.type === 'payment')) {
    score += MATCH_WEIGHTS.MERCHANT;
    reasons.push('merchant_match');
  }

  const timeResult = scoreTimeMatch(tx, timeHints, context.now);
  score += timeResult.score;
  reasons.push(...timeResult.reasons);

  const confidence = Math.min(0.99, score / 100);

  return { score, confidence, reasons: [...new Set(reasons)] };
}

function findDuplicates(history = [], complaint = '', context = {}) {
  const text = context.normalizedText || normalizeText(complaint);
  const amount = context.extractedAmount ?? extractAmount(text);
  const duplicates = [];

  for (let i = 0; i < history.length; i++) {
    for (let j = i + 1; j < history.length; j++) {
      const a = history[i];
      const b = history[j];
      const sameAmount = amount !== null && Number(a.amount) === amount && Number(b.amount) === amount;
      const sameCounterparty = normalizePhone(a.counterparty) === normalizePhone(b.counterparty) &&
        normalizePhone(a.counterparty) !== '';

      let withinWindow = false;
      if (a.timestamp && b.timestamp) {
        const diff = Math.abs(new Date(a.timestamp) - new Date(b.timestamp));
        withinWindow = diff <= MATCH_THRESHOLDS.DUPLICATE_WINDOW_MS;
      }

      if ((sameAmount && withinWindow) || (sameAmount && sameCounterparty)) {
        duplicates.push({ a, b, sameAmount, sameCounterparty, withinWindow });
      }
    }
  }

  return duplicates;
}

function buildMatchContext(complaint = '') {
  const normalizedText = normalizeText(complaint);
  return {
    normalizedText,
    extractedAmount: extractAmount(normalizedText),
    extractedPhones: extractPhones(complaint),
    detectedIntent: detectIntent(normalizedText),
    detectedType: detectTransactionType(normalizedText),
    detectedStatus: detectStatus(normalizedText),
    isMerchant: detectMerchant(normalizedText),
    timeHints: parseRelativeTime(normalizedText),
    now: new Date()
  };
}

function matchTransactions(history = [], complaint = '') {
  const context = buildMatchContext(complaint);
  const duplicates = findDuplicates(history, complaint, context);

  if (!history.length) {
    return {
      best: null,
      candidates: [],
      ambiguous: false,
      context,
      duplicates
    };
  }

  const scored = history.map((tx) => {
    const result = scoreTransaction(tx, complaint, context);
    let bonus = 0;
    const bonusReasons = [];

    if (duplicates.some((d) => d.a === tx || d.b === tx)) {
      bonus += MATCH_WEIGHTS.DUPLICATE;
      bonusReasons.push('duplicate_detected');
    }

    return {
      ...tx,
      score: result.score + bonus,
      confidence: Math.min(0.99, (result.score + bonus) / 100),
      reason_codes: [...new Set([...result.reasons, ...bonusReasons])]
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score ?? 0;
  const candidates = scored.filter(
    (tx) => tx.score >= MATCH_THRESHOLDS.MIN_SCORE &&
      topScore - tx.score <= MATCH_THRESHOLDS.AMBIGUITY_DELTA
  );

  const ambiguous = candidates.length > 1 &&
    candidates[0].score - candidates[candidates.length - 1].score <= MATCH_THRESHOLDS.AMBIGUITY_DELTA;

  const best = topScore >= MATCH_THRESHOLDS.MIN_SCORE && !ambiguous ? scored[0] : null;

  return {
    best,
    candidates: candidates.slice(0, 5),
    ambiguous,
    context,
    duplicates
  };
}

function findBestTransaction(history = [], complaint = '') {
  const result = matchTransactions(history, complaint);
  if (result.ambiguous) {
    return {
      ...result.candidates[0],
      ambiguous: true,
      candidate_count: result.candidates.length
    };
  }
  return result.best;
}

module.exports = {
  normalizeText,
  normalizePhone,
  extractPhone,
  extractPhones,
  extractAmount,
  detectIntent,
  detectTransactionType,
  detectStatus,
  detectMerchant,
  parseRelativeTime,
  scoreTransaction,
  matchTransactions,
  findBestTransaction,
  buildMatchContext,
  findDuplicates
};
