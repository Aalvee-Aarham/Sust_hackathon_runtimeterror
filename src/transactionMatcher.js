const PHONE_REGEX = /(?:\+8801\d{9}|8801\d{9}|01\d{9})/g;

function normalizePhone(phone = "") {
  return phone.replace(/\D/g, "").slice(-11);
}

function extractAmount(text = "") {
  const matches = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g);

  if (!matches) return null;

  let largest = 0;

  for (const value of matches) {
    const num = Number(value.replace(/,/g, ""));

    if (num > largest) {
      largest = num;
    }
  }

  return largest || null;
}

function extractPhone(text = "") {
  const match = text.match(PHONE_REGEX);

  if (!match) return null;

  return normalizePhone(match[0]);
}

function scoreTransaction(tx, complaint) {
  let score = 0;

  const amount = extractAmount(complaint);

  if (amount !== null && Number(tx.amount) === amount) {
    score += 50;
  }

  const phone = extractPhone(complaint);

  if (
    phone &&
    normalizePhone(tx.counterparty || "") === phone
  ) {
    score += 30;
  }

  if (
    complaint.toLowerCase().includes("failed") &&
    tx.status === "failed"
  ) {
    score += 20;
  }

  if (
    complaint.toLowerCase().includes("pending") &&
    tx.status === "pending"
  ) {
    score += 20;
  }

  if (
    complaint.toLowerCase().includes("refund") &&
    tx.type === "refund"
  ) {
    score += 20;
  }

  if (
    complaint.toLowerCase().includes("transfer") &&
    tx.type === "transfer"
  ) {
    score += 15;
  }

  if (
    complaint.toLowerCase().includes("payment") &&
    tx.type === "payment"
  ) {
    score += 15;
  }

  return score;
}

function findBestTransaction(history = [], complaint = "") {
  if (!history.length) return null;

  let best = null;
  let bestScore = -1;

  for (const tx of history) {
    const score = scoreTransaction(tx, complaint);

    if (score > bestScore) {
      bestScore = score;

      best = {
        ...tx,
        score
      };
    }
  }

  if (!best || best.score < 20) {
    return null;
  }

  return best;
}

module.exports = {
  extractAmount,
  extractPhone,
  scoreTransaction,
  findBestTransaction
};