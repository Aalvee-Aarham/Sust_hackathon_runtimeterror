// src/logger.js
// Async Supabase logger — never blocks the response

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

async function ensureTable(client) {
  // Create table if not exists via RPC or just try insert and ignore schema errors
  // We'll attempt the upsert and let Supabase handle it
}

async function logTicket({ ticketId, provider, latencyMs, caseType, evidenceVerdict, safetyPassed, confidence, complaintHash, validationErrors }) {
  const client = getClient();
  if (!client) return; // Supabase not configured, skip silently

  try {
    await client.from('ticket_logs').insert({
      ticket_id: ticketId,
      api_used: provider,
      latency_ms: latencyMs,
      case_type: caseType,
      evidence_verdict: evidenceVerdict,
      safety_passed: safetyPassed,
      confidence: confidence,
      raw_complaint_hash: complaintHash,
      validation_errors: validationErrors,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // Non-blocking: log to console only
    console.error('[Logger] Supabase insert failed:', err.message);
  }
}

function hashComplaint(complaint) {
  return crypto.createHash('sha256').update(complaint || '').digest('hex').substring(0, 16);
}

module.exports = { logTicket, hashComplaint };
