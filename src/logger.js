// Async Supabase logger — never blocks API response

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

let supabase = null;

function getClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (url && key) {
      supabase = createClient(url, key);
    }
  }
  return supabase;
}

async function logTicket({
  ticketId,
  provider,
  latencyMs,
  llmLatencyMs,
  fallbackUsed,
  caseType,
  evidenceVerdict,
  safetyPassed,
  confidence,
  complaintHash,
  validationErrors,
  reasonCodes,
  matcherScore,
  securityFlags,
  promptInjection,
  department,
  severity
}) {
  const client = getClient();
  if (!client) return;

  try {
    await client.from('ticket_logs').insert({
      ticket_id: ticketId,
      api_used: provider,
      latency_ms: latencyMs,
      llm_latency_ms: llmLatencyMs ?? null,
      fallback_used: fallbackUsed ?? false,
      case_type: caseType,
      evidence_verdict: evidenceVerdict,
      safety_passed: safetyPassed,
      confidence: confidence,
      raw_complaint_hash: complaintHash,
      validation_errors: validationErrors,
      reason_codes: reasonCodes ?? null,
      matcher_score: matcherScore ?? null,
      security_flags: securityFlags ?? null,
      prompt_injection: promptInjection ?? false,
      department: department ?? null,
      severity: severity ?? null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Logger] Supabase insert failed:', err.message);
  }
}

function hashComplaint(complaint) {
  return crypto.createHash('sha256').update(complaint || '').digest('hex').substring(0, 16);
}

module.exports = { logTicket, hashComplaint };
