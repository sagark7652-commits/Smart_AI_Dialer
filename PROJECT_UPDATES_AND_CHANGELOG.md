# Project Updates & Data Transfer Manifest — Smart AI Dialer

**Document Updated**: November 2026  
**Repository**: `https://github.com/sagark7652-commits/Smart_AI_Dialer`  
**Branch**: `main`  
**Production Deployment**: `https://smart-ai-dialer-ranger22.vercel.app`

---

## 1. Unified Architecture Overview (CallForge Ops + Core Engine)

This repository contains the complete merged codebase combining the **CallForge Ops Cloud Contact Center Platform** (`callforge-ops/`) and the **Python Core Autonomous Voice Agent Engine** (`core-engine/`) alongside the **Vercel Serverless API Layer** (`api/`):

- **Frontend SaaS Dashboard (`callforge-ops/client/`)**: React + Vite + TailwindCSS UI covering Campaigns, Live Calling Workspace, WebRTC Softphone, Sandbox AI Voice Agent Tester, AI Script Lab, Leads CRM, WhatsApp Business Logs, Call Recordings & CDR Analytics, Wallet/GST Billing, and Compliance Portal.
- **Backend Telephony & Conversational AI Runtime (`callforge-ops/server/`)**: Node.js + Express + WebSockets API handling `/api/calling/runtime/*` conversational turns, multi-persona state memory, local RAG knowledge base, function tool execution, Tata Smartflo webhooks, and persistent JSON datastore (`callforge-ops/data/storage.json`).
- **Vercel Serverless Dispatcher (`api/calling.js` & `api/_runtime.js`)**: Zero-config serverless API routing `/api/calling/*` requests on Vercel, now including live `/api/calling/runtime/personas`, `/runtime/session/create`, `/runtime/session/end`, `/runtime/turn`, and `/runtime/tts` powered by Groq AI and ElevenLabs custom voices.
- **Python Autonomous Voice Engine (`core-engine/`)**: FastAPI & LiveKit/WebRTC agent workers, Silero VAD, Whisper/Deepgram STT, Groq/OpenAI LLM adapters, Hugging Face Inference Router adapters (`router.huggingface.co`), and Edge/ElevenLabs/Piper TTS streaming.

---

## 2. November 2026 Major Upgrades (Latest Release)

### A. Real-Time Tri-Lingual Conversational AI (Groq + OpenAI Compatible)
- Upgraded conversational reasoning in `callforge-ops/server/calling/runtime/llm/llmProviders.ts` and `api/_runtime.js` to support **Groq LPU Inference (`qwen/qwen3-32b`)** with automatic `<think>` block stripping and sub-second latency.
- Eliminated repetitive fallback phrases (such as `"Certainly! I am here to assist you"`) and prevented mid-call re-introductions.

### B. ElevenLabs Custom Female Voice IDs Across Full Conversations
- Replaced legacy pre-recorded intro audio overrides so **both initial call greetings and every live conversation turn** use the exact language-locked ElevenLabs female Voice IDs (`callforge-ops/server/calling/routes.ts` & `api/_runtime.js`):
  - **Hindi (`hi-IN`)**: `RABOvaPec1ymXz02oDQi`
  - **English (`en-IN`)**: `ZUrEGyu8GFMwnHbvLhv2`
  - **Marathi (`mr-IN`)**: `dSEhEXLzhnZEytnJ2rRy`
- Added automatic Edge Neural TTS fallback (`mr-IN-AarohiNeural`, `hi-IN-SwaraNeural`, `en-IN-NeerjaNeural`) when offline or without API credits.

### C. Deep Marathi Training & Female Grammar Lock (Aarogya Dental Care)
- Added strict **Marathi स्त्रीलिंगी (female) grammatical verb rules** (`मी बोलतेय`, `मी मदत करू शकते`, `मी नोंद करते`) in `agentRuntime.ts` and `api/_runtime.js`.
- Enriched clinic knowledge base (`localKnowledgeBase.ts` & `agentRuntime.ts`) for **Aarogya Dental Care & Implant Center** (Office 204, Fortune Plaza, FC Road, Shivaji Nagar, Pune; Dr. Sharma BDS, MDS; timings; fees for consultation ₹400, cleaning ₹1,200, root canal ₹3,500+, implants ₹25,000+; parking & UPI payments).

### D. Zero-Bleed Call Session Isolation (No Page Refresh Required)
- Fixed audio playback and Web Speech synthesis state in `SandboxTestModal.tsx`, `WebRTCSoftphone.tsx`, and `audioEngine.ts` so starting a new call or switching languages (`hi-IN` ↔ `mr-IN` ↔ `en-IN`) immediately aborts any in-flight turn audio/timers and clears stale session state without needing a browser refresh.

### E. Hugging Face Inference Router Migration
- Migrated all Hugging Face TTS, Embeddings, and Sentiment endpoints from deprecated `api-inference.huggingface.co` to `https://router.huggingface.co/hf-inference/models`:
  - Node runtime: `callforge-ops/server/calling/runtime/tts/ttsProviders.ts` (including `facebook/mms-tts-eng`, `facebook/mms-tts-hin`, `facebook/mms-tts-mar`)
  - Python engine: `core-engine/agent/tts/huggingface_tts.py`, `core-engine/agent/rag/embeddings.py`, and `core-engine/agent/analytics/sentiment.py`

### F. Vercel Serverless Runtime Synchronization
- Added `api/_runtime.js` and updated `api/calling.js` so `/api/calling/runtime/personas`, `/runtime/session/create`, `/runtime/session/end`, `/runtime/turn`, `/runtime/tts`, and `/runtime/config` execute full AI reasoning and ElevenLabs audio data-URI synthesis on Vercel deployments.

---

## 3. Recent Commit History (`main`)

- `49c3599` — `fix: update Hugging Face inference endpoints to router.huggingface.co and multilingual TTS`
- `593deb3` — `feat: enable dynamic multilingual model routing for Hugging Face TTS`
- `834a070` — `fix: eliminate certainly-assist-you repetition, isolate session on no-refresh call start, and deeply train marathi agent`
- `d2a302b` — `feat: enforce recharged ElevenLabs custom voice IDs across all intro greetings and conversation turns`
- `7326236` — `fix: integrate Groq real AI dynamic reasoning, ElevenLabs tri-lingual cloned female voices, continuous listening loop, and fix gender and repetition issues`
- `abda618` — `fix: polish tri-lingual intent routing and audio engine speech synthesis`
- `9ee3dbc` — `fix: resolve voice gender mismatch, lock languages strictly, enable Marathi & cloned voice routing`

---

## 4. Verification & Build Checks

- **TypeScript Type Check**: `npm --prefix callforge-ops run check`
- **Production Bundle**: `npm --prefix callforge-ops run build`
- **Vercel Deployment Hook**: `npm run deploy:vercel`
- **Local Unified Startup**: `npm run dev:all` or `npm run dev:node` (`http://localhost:3000`)
