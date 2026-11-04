# Core AI Calling Agent Engine

A high-performance, provider-agnostic conversational voice calling agent engine in Python for English, Hindi, and Marathi (with natural Hinglish code-switching). Target first-audio response latency under ~1.5s.

---

## Architecture Overview

```
Caller (Phone PSTN / Mic)
        │
        ▼
Telephony Layer (Twilio / Exotel / Local Audio Capture)
        │ 16kHz Mono PCM Audio
        ▼
Streaming STT (Deepgram Nova-3 Multilingual / Sarvam AI)
        │ Real-time Interim & Final Transcripts
        ▼
Pipeline State Machine (VAD + Turn Detection + Barge-in Guard)
        │
        ├─► RAG Knowledge Base (<1ms In-memory Vector Retrieval)
        ├─► Tool Execution (Appointments, SMS, Availability, Webhooks, Transfer)
        ├─► Language Auto-Switching (Hindi ⟷ English ⟷ Marathi)
        └─► Thinking Fillers (<800ms Latency Guard)
        │
        ▼
LLM Streaming (Groq Llama 3.3 70B / 8B)
        │ Token Stream
        ▼
Sentence Chunker & Indic Pronunciation Normalizer
        │ Phonetic & Currency Boundaries
        ▼
Streaming TTS (Cartesia Sonic / Sarvam AI Bulbul)
        │ 16-bit PCM Audio (8kHz / 16kHz)
        ▼
Telephony Output / Local Playback (with Instant Clear Audio Queue)
```

---

## Key Capabilities (Parts 1 – 8)

### 1. Foundation & Audio Pipeline (Steps 1–4)
- **Modular Base Interfaces:** `BaseSTT`, `BaseLLM`, `BaseTTS`, `BaseTelephonyProvider`, `BaseSMSProvider`.
- **Low-Latency Streaming:** Sub-1.5s speech-to-audio latency target using chunked generation.
- **Indic Support:** Native tokenization, number/currency normalization, and dates for Hindi, Marathi, and Hinglish.

### 2. Full Local Voice Loop (Step 5)
- **Silero VAD & Turn Detection:** Detects end-of-speech with configurable silence thresholds.
- **Instant Barge-In:** Halts TTS generation, cancels active LLM tokens, and flushes speaker queues the millisecond caller speaks.
- **Silence Watchdog:** 2-tier silence recovery (friendly reprompt, followed by polite farewell and hangup).

### 3. Telephony Adapters (Steps 6–7)
- **Twilio Adapter:** 8kHz G.711 $\mu$-law Base64 WebSocket audio streaming with `<Dial>` human transfer.
- **Exotel Adapter:** 16-bit linear PCM (`slin`) 8kHz WebSocket streaming with 320-byte alignment and Call Update REST API transfer.
- Zero engine code changes required to switch between providers (`TELEPHONY_PROVIDER=twilio` or `exotel`).

### 4. REST API & Persistence (Step 8)
- **FastAPI Service:** Authenticated endpoints with SHA-256 hashed API keys and per-key sliding-window rate limiting.
- **SQLAlchemy Async Models:** SQLite default, swappable to PostgreSQL via `DATABASE_URL`.
- **Alembic Migrations:** Database schema version control with SQLite batch migration compatibility.
- **Python Module Export:** `from agent import CallingAgentEngine`.

### 5. Core Capabilities (Part 5)
- **Function/Tool Calling:** Mid-call execution of `book_appointment`, `check_availability`, `send_sms`, `trigger_webhook`, and `transfer_call`.
- **RAG Knowledge Store:** Sub-millisecond (0.19 ms) vectorized semantic retrieval grounded in `business_info.md`.
- **Compliance & AMD:** Spoken recording consent with dynamic opt-out and automated Answering Machine Detection (AMD).

### 6. Quality (Part 6)
- **Spoken Thinking Fillers:** Delay guard emits natural conversational fillers (*"हाँ जी, एक सेकंड..."* / *"One moment please..."*) only if LLM latency exceeds 800ms.
- **Mid-Call Language Auto-Switching:** Automatically mirrors caller when they switch between Hindi, English, and Marathi mid-dialogue.
- **Pronunciation Dictionary:** Configurable phonetics in `pronunciation.json` for doctor names, clinic branding, and medical abbreviations (`RCT` $\to$ Root Canal, `OPD` $\to$ ओपीडी).
- **Post-Call Analysis:** Background LLM extraction of summary, outcome (`booked`, `transferred`, `info_provided`), sentiment (`positive`, `neutral`, `negative`), and entities.
- **Prompt Versioning & Rollback:** Historical prompt ledger with `POST /agents/{id}/rollback`.
- **Evaluation Harness (32 Scenarios):** `eval_runner.py` testing multi-turn flows, tools, and hallucination bounds across all 3 languages.

### 7. Business & Scale (Part 7)
- **Usage Tracking & Billing:** `GET /usage` aggregating call minutes, STT seconds, tokens, characters, and USD costs.
- **HMAC-Signed Result Webhooks:** Dispatches call summaries and transcripts signed with SHA-256 HMAC headers and exponential backoff.
- **DND & Calling Window Compliance:** Enforces TRAI-permitted 09:00–20:00 IST calling hours and internal DND blacklist.
- **Campaign Mode:** Multi-contact outbound dialer with concurrency semaphore and pause/resume/cancel controls.
- **Concurrency & Overload Queue:** Active call limiter with overload backpressure (HTTP 503/429).
- **Load Testing Tool:** `load_test.py` simulating 50+ concurrent calls reporting throughput and latency percentiles.

### 8. Production Readiness (Part 8)
- **Docker & Compose:** Non-root Debian-slim image with audio dependencies, PostgreSQL 16, and Redis 7.
- **Systemd Unit:** `calling-agent.service` with auto-recovery and security sandboxing.
- **Daily Automated Backup:** `scripts/backup_db.sh` for SQLite and PostgreSQL with 14-day rotation.
- **VPS Deployment Guide:** `scripts/deploy_vps_mumbai.md` for AWS Mumbai (`ap-south-1`) with Nginx WebSocket reverse proxy and Certbot SSL.

### 9. Multi-Purpose Modes & Hardened Safety Guards (Part D)
- **Operational Mode Templates (`modes/`):** Decoupled from any single vertical. 6 standard industry modes plus `custom`:
  1. `telecaller_sales`: Outbound sales offers, objection handling, and callback scheduling.
  2. `lead_qualification`: Consultative BANT qualification and lead capture.
  3. `appointment_booking`: Doctor, service, and consultation bookings.
  4. `reminder_collection`: Friendly billing/EMI reminders and secure payment links.
  5. `support_faq`: First-line customer support, ticket creation, and operator transfers.
  6. `feedback_survey`: CSAT rating collection and qualitative feedback.
  7. `custom`: Custom YAML schema for bespoke business logic.
- **Ready-Made Examples (`modes/examples/`):** Pre-configured examples for mobile recharge promos, announcement ads, credit/debit card offers, EMI reminders, and clinic bookings.
- **Dynamic Per-Call Variables:** Pass customer context directly in `POST /calls` (e.g. `customer_name`, `due_amount`, `expiry_date`), seamlessly interpolated into the agent's prompts and conversation memory.
- **Generic Business Tools:** `capture_lead`, `schedule_callback`, `mark_outcome`, `send_payment_link`, alongside `book_appointment`, `check_availability`, `send_sms`, `transfer_call`, and `webhook_tool`.
- **Hardened Safety & Compliance (`agent/safety.py`):**
  - **PCI-DSS Credential Guard:** Regex redaction of 13-19 digit card numbers, CVVs, OTPs, PINs, and passwords. On-call credential collection is strictly refused; customers are directed to secure digital links.
  - **Do Not Call (DNC) Registry:** Multilingual intent recognition (*"dobara call mat karna"*, *"remove my number"*, *"मला परत फोन करू नका"*). Permanently saves to `calling_agent_dnc.json` and halts outbound dialing.
  - **Legal Calling Hours:** Strictly limits outbound dialing between 08:00 AM and 07:00 PM local time.

---

## Quickstart (3 Commands to a Working Call)

```bash
# 1. Install dependencies & initialize database
pip install -r requirements.txt && python -c "import asyncio; from agent.db import get_db; asyncio.run(get_db().init_db())"

# 2. Run telephony & environment preflight check (validates credentials, ports & webhooks)
python scripts/preflight.py --provider twilio

# 3. Start local voice loop or background API server
python main.py --mode local --agent agent_config.yaml
# Or start FastAPI telephony server:
uvicorn server:app --host 0.0.0.0 --port 8000
```

---

## Environment Variables (.env Reference)

| Variable | Default | Purpose / Allowed Values |
| :--- | :--- | :--- |
| `APP_ENV` | `development` | Runtime mode: `development`, `staging`, `production` |
| `PORT` | `8000` | HTTP and WebSocket server listening port |
| `PUBLIC_URL` | `http://localhost:8000` | Publicly reachable HTTPS/WSS URL (Ngrok or VPS domain) for webhooks |
| `DATABASE_URL` | `sqlite:///./calling_agent.db` | SQLAlchemy connection URI (supports SQLite or PostgreSQL) |
| `API_KEY_SECRET` | `calling-agent-secret` | Internal HMAC signing key for API tokens |
| `STT_PROVIDER` | `deepgram` | Speech-to-Text provider: `deepgram` or `sarvam` |
| `LLM_PROVIDER` | `groq` | Large Language Model provider: `groq` or `gemini` |
| `TTS_PROVIDER` | `cartesia` | Text-to-Speech provider: `cartesia` or `sarvam` |
| `TELEPHONY_PROVIDER`| `twilio` | Telephony adapter: `twilio` or `exotel` |
| `MAX_CONCURRENT_CALLS`| `3` | Maximum simultaneous active phone calls (MVP constraint) |
| `DEEPGRAM_API_KEY` | - | Deepgram API key (Nova-3 multilingual model) |
| `GROQ_API_KEY` | - | Groq Cloud API key (Llama 3.3 70B Versatile) |
| `CARTESIA_API_KEY` | - | Cartesia Sonic API key |
| `TWILIO_ACCOUNT_SID`| - | Twilio Account SID (`AC...`) |
| `TWILIO_AUTH_TOKEN` | - | Twilio Auth Token (used for API and `X-Twilio-Signature`) |
| `TWILIO_PHONE_NUMBER`| - | Twilio purchased virtual phone number (E.164) |
| `EXOTEL_ACCOUNT_SID`| - | Exotel Account SID |
| `EXOTEL_API_KEY` | - | Exotel API Key |
| `EXOTEL_API_TOKEN` | - | Exotel API Token |
| `EXOTEL_SUBDOMAIN` | `api.exotel.com` | Exotel cluster subdomain (e.g. `api.exotel.com` or `api.in.exotel.com`) |
| `EXOTEL_CALLER_ID` | - | Exotel Virtual Landline / Caller ID Number |
| `ALERT_WEBHOOK_URL`| - | Slack / Discord incoming webhook URL for critical alerts |

---

## Latency Tuning Guide (How to Drop ~200ms)

To achieve target first-audio latency under ~1.2s – 1.4s on real phone networks:

1. **VAD Silence Duration (`silence_ms`)**:
   - Current Default: `700ms` (phone profile) / `600ms` (local mic).
   - Tuning: Decrease to `450ms - 500ms` in `agent_config.yaml`. Drops response delay by **~150ms** directly.
2. **First Chunk Sentence Splitting**:
   - In `agent/llm/client.py`, buffer the first chunk to flush on the first comma (`,`), hyphen, or question mark rather than waiting for a full period (`.`). This sends the first clause to TTS **~80ms** sooner.
3. **Cartesia Sonic Audio Format & Sample Rate**:
   - For Twilio, request raw `pcm_mulaw` at 8kHz from Cartesia directly. Bypasses software resampling and saves **~25ms** per turn.
4. **Geographic Hosting (VPS Mumbai)**:
   - Deploy engine in AWS Mumbai (`ap-south-1`) or GCP Mumbai (`asia-south1`). Reduces roundtrip network latency between Exotel/Twilio Mumbai edge and Groq/Deepgram by **~60ms**.
5. **Thinking Fillers Guard**:
   - Keep `enable_thinking_fillers: true` with an 800ms threshold. Even if LLM experiences a network hiccup, caller perceives zero dead-air.

---

## Troubleshooting Guide (Top 5 Errors & Fixes)

1. **`Twilio WebSocket 1006 / Disconnect immediately after answering`**
   - *Cause:* Public URL is not reachable or SSL certificate is invalid.
   - *Fix:* Run `python scripts/preflight.py --provider twilio`. Verify ngrok is running (`ngrok http 8000`) and `PUBLIC_URL` matches the active ngrok URL.
2. **`Slot conflict: The time slot is already booked`**
   - *Cause:* Duplicate booking on the same date and slot in SQLite database.
   - *Fix:* Query appointments using `CheckAvailabilityTool` or select another slot (e.g., 3:30 PM). To clear test appointments, delete `calling_agent.db`.
3. **`HTTP 403 Forbidden: Call blocked by compliance (Outside allowed calling hours / DND)`**
   - *Cause:* Indian TRAI regulations ban automated calls before 09:00 IST or after 20:00 IST, or number is in `dnd_registry`.
   - *Fix:* Verify system time, set `enforce_compliance: false` in test API requests, or remove number from DND: `python scripts/import_dnd.py check <phone>`.
4. **`HTTP 429 Too Many Requests: System overloaded. Concurrency limit reached`**
   - *Cause:* More than 3 active simultaneous calls are in progress.
   - *Fix:* Wait for an active call to hang up, or increase `max_concurrent_calls` in `agent/config.py` / `.env`.
5. **`Twilio Audio Echo / False Barge-in`**
   - *Cause:* Agent's voice bleeding back into STT recognition.
   - *Fix:* In `agent_config.yaml`, ensure `phone.ignore_backchannels: true` is active and `barge_in_min_speech_ms` is set to at least `280ms`.

---

### 1. Requirements
- Python 3.11+ (Python 3.13 tested)
- System audio packages (on Linux: `ffmpeg`, `libportaudio2`)

### 2. Setup Virtual Environment
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

### 4. Create an API Key
```bash
python manage_keys.py create --name "admin-key" --rate-limit 120
```

---

## API Reference & Curl Examples

### Health Check (Public)
```bash
curl -i http://localhost:8000/health
```

### Initiate Outbound Call (Authenticated)
```bash
curl -X POST http://localhost:8000/calls \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to_number": "+919876543210",
    "enforce_compliance": true
  }'
```

### Get Call Details & Analytics
```bash
curl -H "x-api-key: YOUR_API_KEY" http://localhost:8000/calls/YOUR_CALL_ID
```

### Get Usage & Billing Report
```bash
curl -H "x-api-key: YOUR_API_KEY" "http://localhost:8000/usage?from_date=2026-01-01"
```

### Add Phone Number to DND Blacklist
```bash
curl -X POST http://localhost:8000/compliance/dnd \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+919876543210",
    "reason": "Caller opted out"
  }'
```

### Launch Outbound Campaign
```bash
curl -X POST http://localhost:8000/campaigns \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekend Dental Checkup",
    "agent_id": "priya_default",
    "phone_numbers": ["+919876500001", "+919876500002"],
    "max_concurrency": 5,
    "allowed_hours_start": "09:00",
    "allowed_hours_end": "20:00"
  }'
```

---

## Testing & Quality Assurance

### 1. Run Automated Test Suite (60 Passing Tests)
```bash
python -m pytest
```

### 2. Run Evaluation Suite (32 Scenarios)
```bash
python eval_runner.py
```

### 3. Run Concurrency Load Test
```bash
python load_test.py --calls 50 --concurrency 20
```

### 4. Interactive Local Microphone Voice Loop (Day 1 & Day 2)
Run the real-time mic -> STT -> LLM -> TTS -> speaker voice loop directly from the command line:
```bash
# Standard local voice loop
python main.py --mode local --agent agent_config.yaml

# With live interim STT streaming and verbose logs
python main.py --mode local --agent agent_config.yaml --debug

# Telephony audio simulation (downsampled to 8kHz and upsampled to test audio codec degradation)
python main.py --mode local --agent agent_config.yaml --phone
```

### 5. Voice Loop Tuning Parameters (`agent_config.yaml`)
All turn-taking, VAD, and barge-in behaviors are configurable under the `voice_loop` block in `agent_config.yaml`:

| Parameter | Default | Purpose / Tuning Recommendation |
| :--- | :--- | :--- |
| `silence_ms` | `600` | Silence duration after speech before ending caller's turn. Decrease to 450-500ms for snappier responses; increase to 700-800ms for slow speakers. |
| `extra_wait_ms` | `350` | Extra grace period applied when the caller pauses on a conjunction (*"aur"*, *"lekin"*, *"and"*, *"but"*, *"आणि"*). Prevents interrupting callers who are thinking. |
| `vad_threshold` | `350.0` | RMS voice energy threshold. Lower to 250-300 in quiet office environments; raise to 450-600 in noisy rooms. |
| `barge_in_min_speech_ms` | `250` | Minimum sustained caller speech required to confirm barge-in. Filters out brief coughs or clicks while allowing instant interruption. |
| `headset_mode` | `true` | Set to `false` when using laptop speakers. Enables acoustic echo guard by raising VAD threshold by 1.85× while the agent speaks. |
| `silence_timeout_sec` | `8.0` | Level 1 silence timeout before reprompting the caller (*"क्या आप वहां हैं?"* / *"Are you there?"*). |
| `second_silence_timeout_sec` | `8.0` | Level 2 silence timeout after reprompt before politely ending the call and disconnecting. |


---

## Manual Testing Checklist

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **1. Auth & Health** | Run `curl http://localhost:8000/health` | HTTP 200 `{"status": "healthy"}` |
| **2. API Key Security**| Call `GET /calls` without `x-api-key` header | HTTP 401 Unauthorized |
| **3. DND Enforcement**| Add number to DND (`POST /compliance/dnd`), then initiate call (`POST /calls`) | HTTP 403 Forbidden with reason `registered on the Do Not Disturb (DND) list` |
| **4. Calling Window** | Initiate call outside 09:00–20:00 IST | HTTP 403 Forbidden with calling hours restriction |
| **5. Prompt Rollback**| Update agent prompt (`PUT /agents/{id}`), then call `POST /agents/{id}/rollback` | Reverts prompt and greeting to previous version |
| **6. Usage Report** | Call `GET /usage` after calls | Returns aggregated minutes, tokens, characters, and cost |
| **7. Load Stress** | Execute `python load_test.py --calls 50 --concurrency 20` | 100% completed calls with sub-1.5s p95 latency |
| **8. Eval Suite** | Execute `python eval_runner.py` | 32/32 multi-turn scenarios passing |

---

## Part H: Human Voice, Strict Language Lock & Instant Replies (Marathi, English, Hindi)

### 1. Supported Languages & High-Fidelity Voices
The agent features native, localized human voices per language with strict language enforcement (`language_policy: strict`):

| Language | Code | Default TTS Engine | Default Persona / Voice | Alternate Candidates |
| :--- | :--- | :--- | :--- | :--- |
| **मराठी (Marathi)** | `mr` | Sarvam Bulbul v3 / Cartesia 3.6 | `meera` (Natural Female) | `amol` (Male), Cartesia Marathi |
| **English (Indian)** | `en` | Cartesia Sonic 3.6 / OpenAI | `maple` (Smooth Natural Female) | `nova` (OpenAI), `ember` (Male) |
| **हिन्दी (Hindi)** | `hi` | Sarvam Bulbul v3 / Cartesia 3.6 | `leher` (Expressive Female) | `maitreyi`, `neer` (Male) |

#### How to Audition Voices (Blind Listening Test)
```bash
# Generate standardized blind audition clips into voice_audition/
python scripts/voice_audition.py

# Blind audio files are generated:
# voice_audition/audition_mr_A.wav, audition_mr_B.wav ...
# voice_audition/audition_en_A.wav, audition_en_B.wav ...
# Key is stored in voice_audition/audition_key.json
```

#### How to Lock Your Selected Voice
```bash
# Lock your chosen blind audition pick into agent_config.yaml
python scripts/set_voice.py --lang mr --pick B
python scripts/set_voice.py --lang en --pick A
python scripts/set_voice.py --lang hi --pick C
```

---

### 2. Language Pack Structure ("Training")
Each supported language has a modular language pack under `language_packs/<lang>/`:
- `style_guide.md`: Spoken tone, polite register (`आपण/तुम्ही` vs `आप`), colloquial phrasing guidelines.
- `glossary.json`: Domain terminology mapping for sales, appointments, reminders, credit cards, and lead qualification.
- `examples.json`: 15-20 high-quality spoken turns per operational mode.
- `banned_patterns.json`: Banned code-mixing words (e.g. Hindi copulas in Marathi, Hinglish in strict English).

To add new few-shot examples or domain terminology, edit `language_packs/<lang>/examples.json` or `glossary.json`. The prompt manager automatically injects matching examples compactly (<120 tokens) into system prompts.

---

### 3. Latency Tuning Guide & Measured Baselines

#### Measured Speed-of-Light Physical Network Latency (Host -> Edge)
*Logged in `recordings/network_ping_report.json`:*
- **Groq Cloud (LLM):** TCP/TLS Handshake = `942.8ms` | HTTP RTT = `2748.7ms`
- **Deepgram (STT):** HTTP RTT = `1599.2ms`
- **Cartesia (TTS):** HTTP RTT = `2540.9ms`
- **Sarvam AI (STT/TTS):** HTTP RTT = `2187.1ms`

#### Zero-Latency Localized Audio Caching
Fixed lines (greeting, 'are you there', goodbye, consent, transfer, error fallback) are pre-synthesized into `locales/cache/`:
- **Cache Hit Latency:** `<1.0ms` (instant memory streaming directly to telephony).
- **Recompile Audio Cache:** `python scripts/cache_fixed_lines.py`

#### Configuration Flags & Instant Rollback
All Part H optimizations remain switchable via single-line flags in `agent_config.yaml`:

```yaml
agent:
  default_language: hi        # Spoken language: hi, mr, en
  language_policy: strict      # strict (locked) | follow_caller (auto-switch)
  fillers: off                # off (instant direct answer) | on (thinking filler after 800ms)
  speculative_llm: false      # false (stable) | true (speculative interim transcript warmup)
```

---

### 4. Native Speaker Review & Headset Testing Checklist

#### Generate Review Sheets
```bash
python scripts/review_sheet.py --lang mr
python scripts/review_sheet.py --lang en
python scripts/review_sheet.py --lang hi
# Exports 30-turn evaluation CSVs into evals/reviews/native_speaker_review_<lang>.csv
```

#### Manual Headset Verification Checklist
1. **Audio Routing Check:** Connect via Chrome browser (`http://localhost:8000`), speak a turn, and confirm audio plays through the server-side WebAudio streaming player (not robotic Chrome desktop TTS).
2. **Marathi Pronunciation:** Test numbers and amounts ("पाचशे रुपये", "दोन हजार चारशे पन्नास रुपये") - verify native Devanagari pronunciation without Hindi accent.
3. **Strict English Lock:** Select English (`en`), speak mixed Hindi ("Mujhe appointment chahiye"), confirm the agent stays 100% in clean Indian English without any Hindi words.
4. **Immediate Disconnect:** Say "मुझे कुछ नहीं पूछना" (or "काही नको आहे" / "I have no questions") - confirm the agent gives 1 polite sign-off and IMMEDIATELY ends the call with zero silence reprompts.
5. **Silence Timeout Recovery:** Remain silent for ~8 seconds - confirm Level 1 prompt fires once, and after another 8 seconds of silence, Level 2 hangs up gracefully without looping.


---

## PART H2: Marathi & Hindi Mastery + ONE Locked Voice Per Language

### 1. ONE Voice Per Language Architecture
- Voice selection removed completely from Browser UI, `POST /agents`, and `POST /calls`.
- Voice is an internal locked setting per language, mapped directly from `agent_config.yaml`:
  - **Marathi (`mr`):** `meera` (Sarvam AI `bulbul:v3`, pace: 0.95, pitch: 0.0)
  - **Hindi (`hi`):** `leher` (Sarvam AI `bulbul:v3`, pace: 1.0, pitch: 0.0)
  - **English (`en`):** `cartesia-indian-english-female` / `maple` (Cartesia `sonic-3.6`, speed: 1.0)
- Lock status: `status: locked`, `locked: true` with immutable pause and pitch settings.

### 2. Comprehensive Language Packs (`language_packs/`)
- `language_packs/mr/`: Spoken Marathi style guide (everyday register, honorifics साहेब/सर/ताई/दादा, discourse markers ठीक आहे/बरं, loanwords appointment/recharge/offer), time/money/numbers (साडेतीन, दीड, अडीच, पंधराशे रुपये), 120 authentic dialogues across 6 business modes (`sales`, `lead_qualification`, `appointment`, `reminder_collection`, `support`, `survey`), regional register options (`standard`, `pune_mumbai`, `solapur_kolhapur_style`).
- `language_packs/hi/`: Spoken Hindi style guide, 120 authentic dialogues across 6 business modes, time/money/numbers (साढ़े तीन, डेढ़, ढाई, पंद्रह सौ रुपये), banned patterns, compact few-shot selector (~100 tokens).

### 3. Native-Speaker Review Loop
- `python scripts/review_sheet.py --lang mr` / `--lang hi`: Generates 40-scenario evaluation sheets with columns for naturalness (1-5), sounds translated (yes/no), sounds like script (yes/no), correctness (1-5), accent, smoothness, and corrections.
- `python scripts/apply_review.py --input review_mr_round1.csv --lang mr`: Automatically absorbs reviewer corrections, adds awkward phrases to banned patterns, enriches glossary and dialogues, and triggers Round 2 sheets.

### 4. Honesty & AI Disclosure Guard (`agent/honesty_guard.py`)
- Code-enforced rule: Agent NEVER claims to be human and NEVER denies being an AI in Marathi, Hindi, or English.
- Catches direct and indirect inquiries ("Are you real", "तुम्ही माणूस आहात का", "क्या आप इंसान हैं").
- Configurable initial greeting AI disclosure (`agent.ai_disclosure: on | off`, default ON for outbound calls).

### 5. Voice Reel Portfolio (`scripts/voice_reel.py`)
- Generates 10 high-fidelity 24kHz local samples and 10 simulated 8kHz telephony samples per language in `voice_reel/`.
- Manifest with duration, peak amplitude, and RMS energy: `voice_reel/manifest.json`.

---

## PART H3: Greeting Polish & Timing Architecture

### 1. Rotated Multilingual Call-Type Templates
Templates defined in `locales/mr.yaml`, `locales/hi.yaml`, `locales/en.yaml` for 5 distinct operational call flows:
- **Outbound**, **Inbound**, **Reminder**, **Support**, **Survey**.
- **Rotation:** 3 variants per call type rotated per call turn so repeat callers do not hear identical opening scripts.
- **Gender Agreement:** Grammatically correct morphology dynamically keyed to `agent.agent_gender` (`female`: `बोलतेय`/`बोल रही हूँ`, `male`: `बोलतोय`/`बोल रहा हूँ`).
- **Turn Handoff:** Under 7.0 seconds, ending with a single natural turn-yielding question.

### 2. Name Validation & Honorific Formatter
- **Reliability Filter:** Rejects placeholders (`Unknown`, `null`, `n/a`, `test`, digits) and triggers neutral opening.
- **Cultural Honorifics:** Automatically attaches `जी` (Hindi), `साहेब` / `ताई` / `दादा` / `सर` / `मॅडम` (Marathi), `Mr./Ms.` (English).

### 3. Telephony Timing & Pickup Collision Protection
- **`greeting_delay_ms: 600`:** Configurable media stream readiness buffer ensuring the first syllable is never clipped on Twilio or Exotel.
- **`pickup_wait_ms: 1200`:** On outbound calls, listens for the caller's initial pickup ("hello/हॅलो/हेलो/हां"); greets immediately if heard, or after 1.2s of silence.
- **`barge_in_grace_window_ms: 1500`:** Protects greeting against abrupt cutoffs when caller utters short pickup backchannels; sustained interruptions after 1.5s still halt playback in <300ms.

### 4. Acoustic Normalization & Continuity Verification
- **Loudness & Silence:** Trims leading (<15ms) and trailing (<30ms) silence and normalizes peak amplitude to avoid volume jumps between the greeting and live replies.
- **Benchmark Tool (`scripts/verify_greetings.py`):** Renders 20 variants per language (60 total) in 24kHz local PCM and 8kHz $\mu$-law phone quality, measuring 0 continuity gaps and 0 boundary clicks. Outputs human rating sheet to `greeting_scorecard.csv`.

---

Comprehensive guides for all operational, telephony, and safety modules:

- **[Campaign Mode](docs/campaigns.md):** CSV upload, deduplication, E.164 validation, IST calling hours, concurrency cap (20), retries, and crash-safe idempotency.
- **[Callback Scheduler](docs/callbacks.md):** `schedule_callback` tool with timezone, previous context summary injection, slot shifting, and max 3 attempts.
- **[Result Webhooks](docs/webhooks.md):** HMAC-SHA256 signature verification, exponential backoff (5 retries), dead-letter storage, replay scripts, and fallback polling.
- **[Cost Controls & Budgets](docs/cost_controls.md):** Per-call duration/cost caps, verbal closure, API key quotas (80% alert, 100% hard block 429), and campaign budgets.
- **[DTMF Keypad Input](docs/dtmf.md):** Twilio WebSocket DTMF vs Exotel HTTP Gather webhook, interactive keypad flows (1/2/9), timeout/retry, and PCI-DSS digit redaction.
- **[Safety & Voice Guardrails](docs/safety_and_guardrails.md):** 20 voice injection attacks tested across Hindi/English/Marathi, tool JSON-schema validation, side-effect confirmation, and sensitive data redaction.
- **[Review Queue & Auto-Flag](docs/review_queue.md):** 11 post-call anomaly flags, supervisor triage CLI (`scripts/review_queue.py`), and `GET /calls?needs_review=true`.
- **[India Regulatory Compliance](docs/compliance_india.md):** TRAI / DLT registration, 140-series promotional numbers, NDNC scrubbing, calling hours, consent & recording disclosure, and DPDP Act privacy.
