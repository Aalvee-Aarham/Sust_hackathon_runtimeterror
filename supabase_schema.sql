-- Run this in your Supabase SQL editor to create the logging table

CREATE TABLE IF NOT EXISTS ticket_logs (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  api_used TEXT,
  latency_ms INTEGER,
  case_type TEXT,
  evidence_verdict TEXT,
  safety_passed BOOLEAN DEFAULT TRUE,
  confidence FLOAT,
  raw_complaint_hash TEXT,
  validation_errors JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket_id ON ticket_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_timestamp ON ticket_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_case_type ON ticket_logs(case_type);
