# QueueStorm Investigator

Production-grade AI support ticket investigation backend for digital finance platforms. Combines **deterministic rule engines** with **LLM narrative generation** for reliable, explainable, and secure ticket analysis.

Built for the SUST CSE Carnival 2026 hackathon.

---

## Features

- **Hybrid AI Architecture** — deterministic evidence + rules; LLM only writes narrative fields
- **Transaction Matcher** — English, Bangla, Banglish; phone/amount/time extraction; weighted scoring
- **Evidence Engine** — consistent / inconsistent / insufficient_data with reason codes
- **Rule Engine** — severity, department, human review, escalation (not LLM-decided)
- **Security** — prompt injection detection, credential leak prevention, safe customer replies
- **Multi-Provider LLM** — Gemini → Groq → OpenRouter with key rotation, retries, circuit breaker
- **Async Logging** — Supabase ticket logs (non-blocking)
- **Production Ready** — Docker, PM2, health checks, graceful shutdown

---

## Architecture

```
POST /analyze-ticket
       │
       ▼
  Input Validation (security.js)
       │
       ▼
  Pre-Filter (injection, phishing, case hints)
       │
       ▼
  Transaction Matcher (weighted scoring, ambiguity detection)
       │
       ▼
  Evidence Engine (deterministic verdict + confidence)
       │
       ▼
  Rule Engine (severity, department, routing, human review)
       │
       ▼
  Prompt Builder → LLM (narrative fields only)
       │
       ▼
  Validator (schema, safety, assembly)
       │
       ▼
  Async Logger (Supabase)
       │
       ▼
  200 JSON Response
```

### Sequence Diagram

```
Client          API           Matcher       Evidence       Rules         LLM
  │              │               │             │            │            │
  │─ POST ──────►│               │             │            │            │
  │              │─ preFilter ──►│             │            │            │
  │              │─ match ──────►│             │            │            │
  │              │─ evidence ────────────────►│            │            │
  │              │─ rules ────────────────────────────────►│            │
  │              │─ prompt + call ─────────────────────────────────────►│
  │              │◄─ narrative JSON ────────────────────────────────────│
  │              │─ validate + assemble                            │            │
  │              │─ async log                                      │            │
  │◄─ 200 JSON ──│               │             │            │            │
```

---

## Folder Structure

```
sust_preli/
├── src/
│   ├── index.js              # Express orchestrator
│   ├── security.js           # Input validation
│   ├── preFilter.js          # Injection + case hints
│   ├── transactionMatcher.js # Transaction matching engine
│   ├── evidenceEngine.js     # Evidence reasoning
│   ├── rules.js              # Deterministic routing rules
│   ├── prompt.js             # LLM prompt builder
│   ├── llmCaller.js          # Multi-provider LLM layer
│   ├── keyRotator.js         # API key rotation
│   ├── validator.js          # Output validation + assembly
│   ├── logger.js             # Async Supabase logging
│   └── constants.js          # Shared enums and weights
├── tests/
│   └── investigator.test.js  # Comprehensive test suite
├── public/                   # Demo frontend
├── supabase_schema.sql
├── ecosystem.config.js       # PM2 config
├── Dockerfile
├── .env.example
└── package.json
```

---

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Add at least one LLM provider key
```

### 3. Supabase (optional)

Run `supabase_schema.sql` in your Supabase SQL editor.

### 4. Run

```bash
npm start
# Development with auto-reload:
npm run dev
```

### 5. Test

```bash
npm test
curl http://localhost:3000/health
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEYS` | Yes* | — | Comma-separated Gemini keys |
| `GROQ_API_KEYS` | Yes* | — | Comma-separated Groq keys |
| `OPENROUTER_API_KEYS` | Yes* | — | Comma-separated OpenRouter keys |
| `SUPABASE_URL` | No | — | Supabase project URL |
| `SUPABASE_SECRET_KEY` | No | — | Supabase service role key |
| `LLM_PRIORITY` | No | `gemini,groq,openrouter` | Provider fallback order |
| `LLM_TIMEOUT_MS` | No | `25000` | Per-request LLM timeout |
| `LLM_MAX_RETRIES` | No | `2` | Retries per key |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model |
| `OPENROUTER_MODEL` | No | `google/gemini-2.0-flash-001` | OpenRouter model |
| `PORT` | No | `3000` | Server port |
| `RATE_LIMIT_MAX` | No | `120` | Requests per minute |

*At least one provider must have valid keys.

---

## API Documentation

### `GET /health`

Health check with uptime.

**Response:**
```json
{ "status": "ok", "timestamp": "2026-06-26T12:00:00.000Z", "providers": ["gemini","groq","openrouter"], "uptime_seconds": 42 }
```

### `GET /api-key`

Returns masked API key for the primary configured provider.

### `GET /api/agents`

Returns all providers with configuration status and usage stats.

### `POST /analyze-ticket`

Analyze a customer support ticket.

**Request:**
```json
{
  "ticket_id": "TKT-001",
  "complaint": "I sent 5000 taka to a wrong number around 2pm today",
  "language": "en",
  "channel": "in_app_chat",
  "user_type": "customer",
  "transaction_history": [
    {
      "transaction_id": "TXN-9101",
      "timestamp": "2026-04-14T14:08:22Z",
      "type": "transfer",
      "amount": 5000,
      "counterparty": "+8801719876543",
      "status": "completed"
    }
  ]
}
```

**Response:**
```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "...",
  "recommended_next_action": "...",
  "customer_reply": "...",
  "human_review_required": true,
  "confidence": 0.88,
  "reason_codes": ["amount_match", "counterparty_match", "wrong_transfer_claim", "manual_review_required"],
  "_meta": {
    "provider": "gemini",
    "masked_api_key": "AIza••••••••",
    "fallback_used": false,
    "latency_ms": 1234,
    "llm_latency_ms": 980
  }
}
```

**Error codes:** `400` invalid input, `422` empty complaint, `429` rate limit, `503` LLM unavailable

---

## Security

1. **Pre-filter** detects prompt injection, jailbreak, phishing before LLM
2. **Deterministic fields** (verdict, severity, routing) never LLM-decided
3. **Validator** blocks refund promises, credential requests, secret leakage
4. **Helmet** CSP headers, 1MB body limit, rate limiting
5. **Complaint hashing** — raw complaints never stored in logs

---

## Testing

```bash
npm test
```

Covers: Bangla/Banglish parsing, injection detection, evidence verdicts, rule routing, validator safety, ambiguous matches, empty history.

---

## Deployment

### Docker

```bash
docker build -t queuestorm .
docker run -p 3000:3000 --env-file .env queuestorm
```

### PM2 (Ubuntu / EC2)

```bash
npm install -g pm2
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Railway / Render

- Set environment variables from `.env.example`
- Start command: `npm start`
- Health check path: `/health`

### Nginx reverse proxy (optional)

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  client_max_body_size 1m;
}
```

---

## Screenshots

<!-- Add screenshots of the demo UI and API responses here -->

| Demo UI | API Response |
|---------|--------------|
| _placeholder_ | _placeholder_ |

---

## Future Improvements

- Vector-based similar ticket retrieval
- Real-time agent dashboard with Supabase Realtime
- Fine-tuned Bangla support model
- Webhook notifications for fraud escalation
- OpenTelemetry distributed tracing

---

## License

Hackathon project — SUST CSE Carnival 2026.
