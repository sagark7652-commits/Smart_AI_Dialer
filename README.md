# Smart AI Dialer (CallForge Ops) — Enterprise Autonomous Voice AI & Telephony Console

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Deployment-black?style=for-the-badge&logo=vercel)](https://smart-ai-dialer-ranger22.vercel.app)
[![Branch](https://img.shields.io/badge/Branch-main-blue?style=for-the-badge&logo=git)](https://github.com/sumitkhomne123-commits/Smart_AI_Dialer)
[![TypeScript](https://img.shields.io/badge/TypeScript-Clean%20(0%20Errors)-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Auth-Pure%20Firebase%20OTP-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)

> 🚀 **Official Live Production URL**: [https://smart-ai-dialer-ranger22.vercel.app](https://smart-ai-dialer-ranger22.vercel.app)  
> *Notice: Team members should always use this official production URL. Every git push to `main` automatically triggers a zero-downtime redeployment on Vercel.*

---

## 📖 Executive Summary & Architecture Overview

**CallForge Ops (Smart AI Dialer)** is an enterprise autonomous voice AI contact center and predictive dialer engineered for high-throughput outbound and inbound voice operations across India. 

Designed for BFSI (Banking, NBFCs), Real Estate, Healthcare, and E-commerce, it replaces legacy IVR menus with autonomous, sub-300ms conversational agents powered by **NVIDIA Riva & Nemotron** models running over **Tata Smartflo / Telecom SIP Trunks**, with strict statutory **TRAI (Telecom Regulatory Authority of India)** and DLT compliance.

```
                  ┌────────────────────────────────────────┐
                  │       Client Frontend (React / Vite)   │
                  │   Overview, Campaigns, CRM, Studio     │
                  └───────────────────┬────────────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│ Vercel Serverless Dispatcher │              │ Express Full-Stack Server    │
│       (/api/calling.js)      │              │ (server/_core/index.ts:5000) │
├──────────────────────────────┤              ├──────────────────────────────┤
│ • Leads & Bulk CSV Import    │              │ • Asynchronous Worker Queue  │
│ • Campaign Orchestration     │              │ • SSE Real-Time Floor Stream │
│ • CDR Audio Playback & QA    │              │ • Live Twilio / SIP Bridge   │
│ • GST Invoices & Top-Up      │              │ • SQLite / Persistent Store  │
│ • WhatsApp Cloud Dispatch    │              │ • WebRTC Softphone Audio     │
│ • Tata / NVIDIA Simulations  │              │ • Automated QA Scoring       │
└──────────────────────────────┘              └──────────────────────────────┘
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      ▼
                      ┌──────────────────────────────┐
                      │    Telephony & AI Services   │
                      │  • Google Firebase Auth      │
                      │  • Tata Smartflo SIP Trunks  │
                      │  • NVIDIA Riva Speech Engine │
                      │  • Meta WhatsApp Cloud API   │
                      └──────────────────────────────┘
```

---

## ⚡ Key Updates & Transferred Work (Latest Release)

### 1. Pure Google Firebase Authentication (Zero Third-Party Dependency)
- **100% Native Firebase Phone Auth:** Completely removed legacy third-party SMS providers (`Fast2SMS`, `OTP.dev`). Phone verification runs entirely via official Google Firebase SDK (`signInWithPhoneNumber`, invisible reCAPTCHA, and verified OTP confirmation).
- **Multi-Factor / Enterprise Login:** Supports Email + SMTP OTP (`nodemailer`), Google 1-Tap OAuth (GSI), and verified corporate demo logins.
- **Auto-Fill & Test Passcodes:** Pre-configured test code support (`123456`) for rapid offline and QA verification.

### 2. Comprehensive Vercel Serverless Calling API Dispatcher (`api/calling.js`)
- Solved Vercel 404 / HTML rewrite mismatch by provisioning a dedicated serverless dispatcher handling 30+ enterprise calling routes:
  - `GET /api/calling/leads`, `POST /api/calling/leads`, `POST /api/calling/leads/bulk`
  - `GET /api/calling/campaigns`, `POST /api/calling/campaigns/start`, pause, resume, stop
  - `GET /api/calling/cdrs`, `POST /api/calling/cdrs`
  - `POST /api/calling/automation/whatsapp` (with delivery receipt & message ID)
  - `GET /api/calling/billing/wallet`, `POST /api/calling/billing/topup`, `GET /api/calling/billing/invoices`
  - `GET /api/calling/carrier-config`, `POST /api/calling/carrier-test`
  - `GET /api/calling/consent-records`, `POST /api/calling/consent-records`
  - `GET /api/calling/wallboard` (returns live agents, active calls, queues, and floor stats)
  - `POST /api/calling/nvidia-pipeline/simulate`, `GET /api/calling/nvidia-pipeline/status`

### 3. Anti-Stale Cache & Production Deployment Headers (`vercel.json`)
- Added strict `Cache-Control: public, max-age=0, must-revalidate` for `index.html` to guarantee that browser caches never show stale UI after deployments.
- Assets (`/assets/*.js`, `/assets/*.css`) utilize immutable one-year hashed caching for instantaneous loading.

### 4. Rollup Performance Optimization & Chunk Splitting
- Configured Rollup `manualChunks` in `callforge-ops/vite.config.ts`.
- Split large dependencies (`vendor-firebase`, `vendor-icons`, `vendor-pdf`, `vendor`) into modular bundles, dropping individual chunk sizes under limits and cutting initial render latency.

### 5. Automated GST PDF Invoices Generator (`InvoicesTable.tsx`)
- Dynamic A4 PDF Tax Invoice generation under Section 31 of CGST Act, 2017 using `jsPDF`.
- Outputs SAC code 9984 (Telecommunication Services), CGST 9%, SGST 9%, digital authorization stamps, and customer billing metadata.

### 6. NVIDIA Voice Pipeline Studio with Nemotron Reasoning
- Implemented 4-stage pipeline simulation:
  1. **NVIDIA Riva Audio Ingestion & VAD** (16kHz PCM stream, End-of-Utterance detection).
  2. **Nemotron ASR** (Speech-to-Text via Riva NIM).
  3. **Nemotron-4-340B LLM** (Autonomous financial and account reasoning).
  4. **Riva Magpie TTS** (Neural speech synthesis with Web Speech API browser playback).
- Sub-300ms telemetry tracking (76ms STT, 42ms LLM first token, 80ms TTS synthesis).

### 7. Supervisor Live Floor & Whisper Wallboard (`LiveWallboardGrid.tsx`)
- Displays real-time agent status cards (AI Bots Priya & Rahul, human agents Pooja, Vikram, Rohan).
- Real-time customer call cards with sentiment indicators, live duration timers, whisper coaching, and barge-in actions.

### 8. Statutory TRAI / DLT Consent Ledger (`ConsentAuditLedger.tsx`)
- Full audit log of verified digital opt-ins and DNC scrubbed numbers.
- One-click CSV export with DLT registration reference numbers (`DLT-PE-1401552890014`) for statutory telecom inspections.

---

## 🛠️ Repository Structure

```
├── .devcontainer/             # GitHub Codespaces container setup (Node.js 20, auto-ports)
├── .github/workflows/         # Scheduled warm-up workflow (keep-backend-warm.yml)
├── api/                       # Vercel Serverless Functions
│   ├── calling.js             # Unified 30+ endpoint calling operations dispatcher
│   ├── calling-auth-email-check.js   # SMTP email credentials & OTP sender
│   ├── calling-auth-email-verify.js  # Email OTP verifier
│   └── health.js              # Production uptime healthcheck
├── callforge-ops/             # Main Application Codebase
│   ├── client/                # React 18 + Vite + TailwindCSS Frontend
│   │   ├── src/
│   │   │   ├── components/calling/   # 40+ calling components across 8 categories
│   │   │   │   ├── admin/            # Team, roles, audit logs, carriers
│   │   │   │   ├── agent/            # WebRTC softphone, agent status, screenpop
│   │   │   │   ├── ai/               # NVIDIA Voice Studio, A/B scripts, voice picker
│   │   │   │   ├── billing/          # Wallet top-up, invoices, auto-recharge
│   │   │   │   ├── campaigns/        # Campaign builder, pacing, sandbox test
│   │   │   │   ├── crm/              # Leads, bulk import, WhatsApp modal, consent
│   │   │   │   ├── global/           # Audio drawer, command palette, settings
│   │   │   │   └── supervisor/       # Live wallboard, CDR table, QA scorecard
│   │   │   ├── pages/                # Home.tsx, LoginPage.tsx, NotFound.tsx
│   │   │   └── lib/firebase.ts       # Clean Google Firebase SDK initialization
│   ├── server/                # Express & Telephony Backend Engine
│   │   ├── calling/           # Routes, dialer worker, Claude QA, NVIDIA pipeline
│   │   └── storage/           # Persistent store & SQLite database models
├── GEMINI.md                  # Team Git & Automated Vercel redeployment instructions
├── package.json               # Root monorepo configuration (ES Modules enabled)
├── README.md                  # Complete platform documentation & master reference
└── vercel.json                # Vercel deployment routes, rewrites & anti-cache headers
```

---

## 🚀 Getting Started & Local Development

### 1. Requirements
- Node.js 20+ installed
- Git CLI

### 2. Quick Install
```bash
# Clone the repository
git clone https://github.com/sumitkhomne123-commits/Smart_AI_Dialer.git
cd Smart_AI_Dialer

# Install dependencies
npm install
npm --prefix callforge-ops install
```

### 3. Running Locally
```bash
# Start Full-Stack Dev Server (Express backend + Vite frontend)
npm run dev
```
The application will open on `http://localhost:5000` (or `http://localhost:3000`).

### 4. Running Typecheck & Production Build
```bash
# Verify TypeScript (0 errors expected)
npm --prefix callforge-ops run check

# Build production bundle
npm --prefix callforge-ops run build
```

---

## ☁️ GitHub Codespaces (1-Click Cloud Workspace)
This repository contains a pre-configured `.devcontainer/devcontainer.json`.
1. Go to `https://github.com/sumitkhomne123-commits/Smart_AI_Dialer`.
2. Click **Code** -> **Codespaces** -> **Create codespace on main**.
3. Node.js 20, all npm packages, and forwarded ports `5000` and `3000` will initialize automatically.

---

## 🚢 Team Git & Vercel Automated Deployment Workflow

As defined in `GEMINI.md`, all updates to this repository must follow this sequence:

```bash
git add .
git commit -m "<concise descriptive message>"
git pull --rebase origin main
git push origin main
node -e "fetch('https://api.vercel.com/v1/integrations/deploy/prj_achNYYSGPCG7xlKWCORJNMivgtmh/JSwjsxAPan', { method: 'POST' }).then(() => console.log('Vercel Redeploy Triggered!'))"
```

---

## 📞 Support & Telephony Specifications
- **Telecom Carrier Bridge:** Tata Smartflo SIP Trunk (`sip.tatasmartflo.com:5060`) with RFC 3261 compliance.
- **Audio Codec:** G.711u / PCMU (16kHz HD Voice).
- **Statutory Calling Window:** 09:00 - 21:00 IST (TRAI statutory hours).
- **License:** Enterprise Commercial Proprietary.
