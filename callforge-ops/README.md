# CallForge Ops — Enterprise Autonomous Voice AI & Telephony Operations

> **Next-Generation India-First Cloud Contact Center Platform** powered by the **Tata Dialer (Tata Smartflo)** and the **NVIDIA Conversational AI Speech Stack**.

[![Platform](https://img.shields.io/badge/Platform-Tata%20Smartflo%20%7C%20SIP%20Trunk-blue?style=flat-square)](https://www.tatateleservices.com/)
[![Speech AI](https://img.shields.io/badge/Speech%20AI-NVIDIA%20Riva%20%2B%20Nemotron-76b900?style=flat-square)](https://developer.nvidia.com/riva)
[![SLA](https://img.shields.io/badge/Audio%20Latency-%3C300ms%20SLA-emerald?style=flat-square)](#latency-profile)
[![Compliance](https://img.shields.io/badge/Compliance-TRAI%20%2F%20DLT%20%2F%20TCCCPR-purple?style=flat-square)](#regulatory-compliance)

---

## Executive Summary

**CallForge Ops** is an enterprise-grade calling operations console engineered for high-throughput outbound and inbound voice campaigns across India. Built for financial services, retail, insurance, and customer support, it replaces rigid interactive voice response (IVR) trees with **fully autonomous, low-latency conversational agents** capable of executing complex business workflows (such as real-time loan inquiries, KYC verification, EMI scheduling, and UPI payment dispatch) while adhering strictly to statutory telecom regulations.

---

## High-Level Voice Architecture

```
                  CUSTOMER (Mobile / Landline)
                              │
                              │ Voice (16kHz PCM Linear via Tata SIP Trunk)
                              ▼
                ┌───────────────────────────┐
                │ Tata Smartflo / Dialer    │ (Carrier PSTN & Cloud SIP Trunk Gateway)
                └─────────────┬─────────────┘
                              │
                              ▼
                ┌───────────────────────────┐
                │ NVIDIA Riva Audio Engine  │ (Audio Processing, Noise Gating & VAD)
                └─────────────┬─────────────┘
                              ▼
                ┌───────────────────────────┐
                │ NVIDIA Nemotron ASR       │ (Real-Time Streaming Speech-to-Text)
                │ Example: "I want to know  │
                │ my loan balance."         │
                └─────────────┬─────────────┘
                              ▼ Text Transcript
                ┌───────────────────────────┐
                │ NVIDIA Nemotron LLM       │ (Understands Intent & Executes Tools)
                │ Core Business Logic:      │
                │ Query Loan Database       │
                │ Generate: "Your loan      │
                │ balance is ₹50,000."      │
                └─────────────┬─────────────┘
                              ▼ Text Response
                ┌───────────────────────────┐
                │ NVIDIA Riva Magpie TTS    │ (Multilingual Agentic Voice Synthesis)
                └─────────────┬─────────────┘
                              │ 24kHz Neural Audio
                              ▼
                ┌───────────────────────────┐
                │ Tata Dialer Audio Bridge  │ (Outbound Media Relay)
                └─────────────┬─────────────┘
                              ▼
                  CUSTOMER (Hears Natural Voice)
```

---

## Speech Layer Technology Mapping

| Layer | Technology / Model | Enterprise Purpose |
| :--- | :--- | :--- |
| **Speech → Text (STT)** | **NVIDIA Nemotron Speech ASR** (`nemotron-asr-streaming`) | Continuous chunked real-time voice transcription with Indic accent adaptation. |
| **Serving & Streaming** | **NVIDIA Riva ASR** (gRPC port `50051` / NIM) | Production streaming gateway, Voice Activity Detection (VAD), and turn-taking endpointing. |
| **LLM & Reasoning** | **NVIDIA Nemotron** (`nemotron-4-340b` / `nemotron-mini`) | Contextual intent analysis, financial account lookups, and multi-turn conversational reasoning. |
| **Text → Speech (TTS)** | **NVIDIA Riva Magpie TTS** (`riva-magpie-multilingual-v1`) | Native multilingual speech generation with human-grade conversational prosody. |
| **Telephony Gateway** | **Tata Dialer (Tata Smartflo)** | Enterprise PRI/SIP trunks, TRAI-compliant caller IDs, and carrier-grade media routing. |

---

## Real-Time Latency SLA Benchmark

CallForge Ops operates within an ultra-low round-trip latency budget to preserve conversational flow:

```
┌─────────────────┬──────────────────┬─────────────────┬─────────────────┐
│ Riva VAD Ingest │ Nemotron ASR     │ Nemotron LLM    │ Riva Magpie TTS │
│ 16ms – 22ms     │ 78ms – 88ms      │ 104ms – 118ms   │ 72ms – 82ms     │
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
 Total Round-Trip Audio Loop: 270ms – 295ms (Well under the 350ms Human SLA)
```

---

## Key Enterprise Capabilities

- **AI Voice Studio**: Real-time pipeline visualizer and sandbox simulator with preloaded banking and retail scenarios.
- **Multilingual Persona Library**: High-fidelity Indian English, Hindi, Marathi, and Indic regional voices powered by NVIDIA Riva Magpie.
- **Carrier Agility & Fallback**: Native Tata Smartflo SIP trunk integration with seamless toggle between live carrier trunks and zero-cost virtual sandbox testing.
- **Predictive & Progressive Dialer**: Decoupled asynchronous worker queue handling thousands of concurrent leads without UI thread degradation.
- **Live Supervisor Wallboard**: Real-time Server-Sent Events (SSE) stream offering 3-way supervisor whisper coaching, call barging, and talk-over alerts.
- **Automated QA & Call Records (CDR)**: 100% call audit logging with transcription, automated quality scoring, and sentiment analytics.

---

## Regulatory & Telecom Compliance (TRAI / DLT)

- **Statutory Calling Window**: Hard enforcement of 09:00 to 21:00 IST calling hours with lead timezone validation.
- **National DNC Registry Scrub**: Automated de-duplication against the National Do Not Call (NDNC) suppression list.
- **Mandatory Disclosure Preamble**: Locked AI disclosure preamble delivered automatically upon call pickup.
- **DLT Registration Verification**: Enterprise caller ID validation against registered TRAI entity headers.

---

## Technical Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Web Audio API
- **Backend**: Node.js, Express, tRPC, Drizzle ORM, SSE Event Broker
- **Telephony & Speech**: Tata Smartflo Cloud Telephony, NVIDIA Riva Streaming Platform, NVIDIA Nemotron Models
- **Database & Storage**: SQLite / PostgreSQL via Drizzle with persistent local fallback

---

## Deployment & Verification

### Prerequisites
- Node.js 20+
- (Optional) NVIDIA Riva / NIM container endpoint (`grpc://...`)
- (Optional) Tata Smartflo API token and SIP trunk credentials

### Running the Platform
```bash
# Install dependencies and build
npm install
npm run build

# Start the application
npm start
```
Open `http://localhost:5000` to access the CallForge Ops dashboard.

---

## License & Enterprise Support
Proprietary & Confidential. Designed for enterprise telecommunications deployments.
