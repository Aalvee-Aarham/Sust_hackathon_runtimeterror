# QueueStorm Investigator — Backend

AI-powered support ticket investigator for the SUST CSE Carnival 2026 hackathon.

## Tech Stack
- **Runtime**: Node.js 20 + Express
- **LLM Providers**: Gemini (primary) → Groq (fallback) → OpenRouter (fallback)
- **Database**: Supabase (async logging, non-blocking)
- **Safety**: Pre-filter rule engine + post-LLM validator

## Models Used
| Provider | Model | Why |
|----------|-------|-----|
| Gemini | `gemini-2.0-flash` | Fast, cheap, JSON mode, excellent instruction following |
| Groq | `llama-3.3-70b-versatile` | Ultra-fast inference, free tier available |
| OpenRouter | `google/gemini-2.0-flash-001` | Fallback with key rotation |

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and fill in your API keys
```

### 3. Create Supabase table
Run `supabase_schema.sql` in your Supabase SQL editor.

### 4. Start server
```bash
npm start
# Or for dev with auto-reload:
npm run dev
```

### 5. Test
```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/analyze-ticket \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

## Docker

```bash
docker build -t queuestorm .
docker run -p 3000:3000 --env-file .env queuestorm
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEYS` | Yes* | Comma-separated Gemini API keys |
| `GROQ_API_KEYS` | Yes* | Comma-separated Groq API keys |
| `OPENROUTER_API_KEYS` | Yes* | Comma-separated OpenRouter API keys |
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_SECRET_KEY` | No | Supabase service role key |
| `LLM_PRIORITY` | No | Provider order, default: `gemini,groq,openrouter` |
| `LLM_TIMEOUT_MS` | No | Per-request timeout, default: `25000` |
| `PORT` | No | Server port, default: `3000` |

*At least one provider must have keys.

## Architecture

```
POST /analyze-ticket
       │
       ▼
  Input Validation (400/422)
       │
       ▼
  Pre-Filter Rule Engine (~10ms)
  - Injection detection
  - Phishing hint
  - Duplicate/wrong-transfer hint
       │
       ▼
  LLM Call with fallback chain
  Gemini → Groq → OpenRouter
       │
       ▼
  JSON Parse + Validate
  - Enum correctness
  - Safety phrase check
  - Auto-fix + flag errors
       │
       ▼
  Async Supabase Log (non-blocking)
       │
       ▼
  200 JSON Response
```

## Safety Logic
1. Pre-filter catches injection attempts before LLM sees them (still processed, instructions ignored)
2. System prompt explicitly instructs LLM to ignore embedded directives
3. Post-validation strips forbidden phrases from customer_reply
4. Safety reminder is always appended if missing
5. `recommended_next_action` is validated to never promise refunds

## Known Limitations
- Bangla language detection relies on LLM; pre-filter uses basic regex
- Multi-transaction ambiguity resolution depends on LLM reasoning quality
- Supabase logging is best-effort; failures are silent
