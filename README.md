<div align="center">

# Smart AI Dialer & CallForge Ops — Enterprise Autonomous Voice AI Platform

> **Next-Generation India-First Cloud Contact Center Platform** powered by **Tata Smartflo / Cloud SIP**, **Groq Qwen Reasoning**, and **Tri-Lingual ElevenLabs & Neural Voice Synthesis**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Groq AI](https://img.shields.io/badge/AI%20Engine-Groq%20Qwen3--32B-F55036?style=flat-square)](https://groq.com/)
[![ElevenLabs](https://img.shields.io/badge/Voice%20AI-ElevenLabs%20%2B%20HF%20Router-000000?style=flat-square)](https://elevenlabs.io/)
[![Compliance](https://img.shields.io/badge/Compliance-TRAI%20DND%20%26%20DPDP-22C55E?style=flat-square)]()
[![Vercel Live](https://img.shields.io/badge/Deployment-Vercel-000000?style=flat-square&logo=vercel)](https://smart-ai-dialer-ranger22.vercel.app)

**[Overview](#-overview) • [November 2026 Updates](#-november-2026-updates) • [Architecture](#%EF%B8%8F-architecture) • [Quick Start](#-quick-start) • [Security](#-security--compliance)**

</div>

---

## 🎯 Overview

**Smart AI Dialer (CallForge Ops)** is a complete B2B autonomous calling & contact center suite built for high-volume Indian outbound sales, healthcare front-desk booking, financial collections, and customer support. It unifies **telephony SIP trunks (Tata Smartflo)**, **real-time conversational AI (Groq + OpenAI-compatible + Python LiveKit engine)**, **tri-lingual female neural voices (English, Hindi, Marathi)**, **local RAG knowledge grounding**, and **automated QA scoring**.

---

## 🚀 November 2026 Updates

- **Groq Real-Time Reasoning (`qwen/qwen3-32b`)**: Low-latency dynamic responses with strict zero-repetition filtering (eliminates canned `"Certainly! I am here to assist you"` loops and mid-call re-introductions).
- **ElevenLabs Custom Tri-Lingual Female Voices**: Language-locked Voice IDs used consistently across both call intros and every turn:
  - Hindi (`hi-IN`): `RABOvaPec1ymXz02oDQi`
  - English (`en-IN`): `ZUrEGyu8GFMwnHbvLhv2`
  - Marathi (`mr-IN`): `dSEhEXLzhnZEytnJ2rRy`
- **Deep Marathi Training (Aarogya Dental Care)**: Authentic Marathi (`स्त्रीलिंगी` female grammar lock) covering Dr. Sharma consultation, FC Road Shivaji Nagar Pune address, timings, cleaning/RCT/implant pricing, and appointment booking.
- **No-Refresh Session Isolation**: Switching agents or starting consecutive calls cleanly aborts previous audio/timers and isolates session context without refreshing the page.
- **Hugging Face Router Support**: Migrated all HF TTS (`facebook/mms-tts-eng`, `facebook/mms-tts-hin`, `facebook/mms-tts-mar`), embeddings, and sentiment inference to `https://router.huggingface.co/hf-inference/models`.
- **Full Vercel Serverless Runtime (`api/calling.js` + `api/_runtime.js`)**: Supports `/api/calling/runtime/*` endpoints in production alongside the full Express backend.

---

## ✨ Key Platform Modules

| Module | Capabilities |
| :--- | :--- |
| **Live Conversational Voice Sandbox** | Real-time microphone + text turn simulation with Simran (SwiftTel 5G), Priya (Aarogya Dental Care), and Aarti (Tata Smartflo Banking) |
| **WebRTC Browser Softphone** | Zero-cost local & cloud audio softphone with continuous speech loop, DTMF keypad, barge-in cancellation, and transcript logging |
| **Campaign Dialer & Scheduler** | Automated batch execution, TRAI calling-window guardrails (`09:30–20:00 IST`), retry cadences, and CSV lead ingestion |
| **AI Script Lab & Prompt Studio** | Multi-turn persona rules, strict language locks (`en-IN`, `hi-IN`, `mr-IN`), tool schemas, and RAG snippet grounding |
| **Recordings, CDR & QA Scoring** | Persistent call detail records, automated QA rubrics, sentiment analytics, and WhatsApp follow-up templates |
| **Billing & Enterprise Controls** | INR Prepaid Wallet, GST invoicing, 100% Consent/DND whitelisting, and workspace team roles |

---

## 🏗️ Architecture

```
Smart_AI_Dialer/
├── api/
│   ├── calling.js              # Vercel serverless API dispatcher (/api/calling/*)
│   └── _runtime.js             # Serverless Groq + ElevenLabs tri-lingual AI runtime
├── callforge-ops/
│   ├── client/                 # React 18 + Vite + TailwindCSS frontend dashboard
│   ├── server/                 # Express backend, WebSocket bridge & runtime engine
│   └── data/                   # Persistent JSON storage (leads, campaigns, CDRs)
├── core-engine/                # Python LiveKit/FastAPI autonomous voice agent worker
│   └── agent/
│       ├── tts/                # ElevenLabs, Edge TTS, HuggingFace Router TTS
│       ├── rag/                # Local embeddings & vector store
│       └── analytics/          # Sentiment & transcript scoring
├── PROJECT_UPDATES_AND_CHANGELOG.md
├── package.json
└── vercel.json
```

---

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/sagark7652-commits/Smart_AI_Dialer.git
cd Smart_AI_Dialer
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (and `callforge-ops/.env`) and add your keys (`GROQ_API_KEY`, `ELEVENLABS_API_KEY`, `HUGGINGFACE_API_KEY` as needed). Never commit `.env` files to Git.

### 3. Install & Run Locally
```bash
npm --prefix callforge-ops install
npm run dev:node
# App & API available at http://localhost:3000
```

### 4. Production Build & Type Check
```bash
npm run check
npm run build
```

---

## 🛡️ Security & Compliance

- **No Secrets in VCS**: `.env` and API credentials remain strictly local or inside Vercel Environment Variables.
- **TRAI DND & Consent Filtering**: Pre-dial consent & calling-hours enforcement before outbound execution.
- **DPDP Act Audit Trails**: Role-scoped team access and call compliance logging.

---

<div align="center">

**CallForge / Smart AI Dialer Platform**  
Documentation & Updates Manifest: [PROJECT_UPDATES_AND_CHANGELOG.md](./PROJECT_UPDATES_AND_CHANGELOG.md)

</div>
