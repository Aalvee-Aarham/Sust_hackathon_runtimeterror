-- QueueStorm Investigator — ticket logging schema
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS ticket_logs (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  api_used TEXT,
  latency_ms INTEGER,
  llm_latency_ms INTEGER,
  fallback_used BOOLEAN DEFAULT FALSE,
  case_type TEXT,
  evidence_verdict TEXT,
  safety_passed BOOLEAN DEFAULT TRUE,
  confidence FLOAT,
  raw_complaint_hash TEXT,
  validation_errors JSONB,
  reason_codes JSONB,
  matcher_score INTEGER,
  security_flags TEXT,
  prompt_injection BOOLEAN DEFAULT FALSE,
  department TEXT,
  severity TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket_id ON ticket_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_timestamp ON ticket_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_case_type ON ticket_logs(case_type);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_evidence ON ticket_logs(evidence_verdict);

-- Migration for existing tables (safe to run multiple times)
ALTER TABLE ticket_logs ADD COLUMN IF NOT EXISTS llm_latency_ms INTEGER;
ALTER TABLE ticket_logs ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT FALSE;
ALTER TABLE ticket_logs ADD COLUMN IF NOT EXISTS reason_codes JSONB;
ALTER TABLE ticket_logs ADD COLUMN IF NOT EXISTS matcher_score INTEGER;
ALTER TABLE ticket_logs ADD COLUMN IF NOT EXISTS security_flags TEXT;
ALTER TABLE ticket_logs ADD COLUMN IF NOT EXISTS prompt_injection BOOLEAN DEFAULT FALSE;
ALTER TABLE ticket_logs ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE ticket_logs ADD COLUMN IF NOT EXISTS severity TEXT;
