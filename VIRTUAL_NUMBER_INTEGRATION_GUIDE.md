# Virtual Number (DID) Integration Guide & System Architecture

## 1. Executive Summary

Your agent from `core-engine` (**Priya - Aarogya Dental Care**, with full Hindi/English/Hinglish/Marathi appointment booking and doctor consultation tools) is **fully integrated** into the single unified system at `Smart_AI_Dialer`.

Per your specification:
> *"just a part of virtual number is to be added will add that later on"*

The virtual number provisioning step is **decoupled and deferred**. In the meantime, the system operates in **Full Browser WebAudio & Interactive Sandbox Mode**:
- **In-Browser Direct Voice Loop**: Access `http://localhost:8000/demo` or `ws://localhost:8000/ws/browser-voice` to speak directly into your microphone with Priya with sub-300ms turn latency.
- **Interactive Sandbox Modal**: Built into the Web UI (`http://localhost:3000`) on the AI Voice Studio and Campaigns tab.
- **Zero Carrier Fees during Testing**: You can evaluate prompts, appointment booking (`check_availability`, `book_appointment`), and pricing without needing a live telecom trunk.

---

## 2. Unified System Architecture

```
                                  +-------------------------------------------------------+
                                  |            CALLFORGE SMART AI DIALER                 |
                                  |           Single Unified Working Platform             |
                                  +-------------------------------------------------------+
                                                              |
                     +----------------------------------------+----------------------------------------+
                     |                                                                                 |
                     v                                                                                 v
   +------------------------------------+                                            +------------------------------------+
   |        Node.js + React UI          |                                            |      Python Core Engine Daemon     |
   |       (callforge-ops / :3000)      |                                            |         (core-engine / :8000)      |
   +------------------------------------+                                            +------------------------------------+
   | * Vite + React 19 Dashboard        |                                            | * FastAPI Asynchronous Service     |
   | * Agent Workspace & CRM            |                                            | * Priya - Aarogya Dental Preset    |
   | * Live Floor & Supervisor Console  |<--- /api/calling/core-engine/health ------>| * OpenAI LLM (gpt-4o-mini)         |
   | * Visual IVR & Audio Sandbox       |<--- /api/calling/core-engine/agents ------>| * OpenAI TTS + Cartesia + Sarvam   |
   | * Campaign Persistent Queue        |                                            | * Deepgram Streaming STT           |
   | * Lead Store & WhatsApp Dispatch   |                                            | * SQLite Appointment DB            |
   +------------------------------------+                                            +------------------------------------+
                     |                                                                                 |
                     |                                                                                 |
                     +----------------------------------------+----------------------------------------+
                                                              |
                                                              v
                                  +-------------------------------------------------------+
                                  |          TELEPHONY CARRIER ROUTING LAYER             |
                                  +-------------------------------------------------------+
                                  | 1. In-Browser WebAudio (ACTIVE NOW - Immediate Test) |
                                  | 2. Tata Smartflo SIP Trunk (Placeholder Ready)       |
                                  | 3. Twilio DID / Voice Trunk (Placeholder Ready)       |
                                  | 4. Exotel India Virtual Number (Placeholder Ready)   |
                                  +-------------------------------------------------------+
```

---

## 3. How to Plug in Your Virtual Number Later

When you acquire your virtual number (DID) from your preferred telecom carrier, you can activate it in **either of two ways**:

### Method 1: Through the Web UI (Zero Server Restart)
1. Open the dashboard at `http://localhost:3000`.
2. Navigate to **Admin & Billing** in the left sidebar.
3. In the **Telephony Carrier & GSM Trunk Gateway** card, click **Configure Carrier Trunks**.
4. Select your carrier (**Tata Smartflo**, **Twilio**, or **Exotel**).
5. Enter your virtual phone number in E.164 format (e.g., `+912266001234` or `+18005550199`) and save.
6. The carrier badge will immediately transition to **Live Telecom Trunk Connected**.

### Method 2: Through Environment Configuration (`.env`)

#### For Tata Smartflo:
In `Smart_AI_Dialer/.env` and `core-engine/.env`:
```env
DEFAULT_TELEPHONY_PROVIDER=tata_smartflo
TATA_SMARTFLO_API_KEY=your_smartflo_api_key
TATA_SMARTFLO_TOKEN=your_smartflo_token
TATA_SIP_TRUNK=sip.tatasmartflo.com:5060
TATA_CALLER_ID=+9122XXXXXXXX
VIRTUAL_NUMBER_PENDING=false
```

#### For Twilio:
In `Smart_AI_Dialer/.env` and `core-engine/.env`:
```env
TELEPHONY_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
VIRTUAL_NUMBER_PENDING=false
```

#### For Exotel (India Outbound):
In `Smart_AI_Dialer/.env` and `core-engine/.env`:
```env
TELEPHONY_PROVIDER=exotel
EXOTEL_ACCOUNT_SID=your_sid
EXOTEL_API_KEY=your_key
EXOTEL_API_TOKEN=your_token
EXOTEL_SUBDOMAIN=api.exotel.com
EXOTEL_CALLER_ID=+9180XXXXXXXX
VIRTUAL_NUMBER_PENDING=false
```

---

## 4. How to Run the Unified System

### One-Command Unified Launch:
From `d:\calling_ai_deployra\Smart_AI_Dialer_comressed\Smart_AI_Dialer`:
```powershell
npm run dev
```
*(or run `powershell -ExecutionPolicy Bypass -File .\start-system.ps1`)*

This launches:
1. **Python Core Voice Engine** on `http://localhost:8000`
2. **CallForge Node.js Server & React UI** on `http://localhost:3000`

### Individual Service Commands:
- To run only Node.js & React: `npm run dev:node`
- To run only Python Core Agent: `npm run dev:agent`
- To run Typecheck: `npm run check`
- To run Vitest Test Suite: `npm run test`
