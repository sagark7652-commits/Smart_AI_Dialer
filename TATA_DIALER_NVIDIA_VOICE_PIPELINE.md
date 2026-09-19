# Tata Dialer AI Voice Pipeline — NVIDIA Stack Architecture

This specification document outlines the integration of the **Tata Dialer** with the **NVIDIA Conversational AI Speech Stack** in CallForge Ops.

---

## 1. Speech Layer Mapping

| Function | Model / Technology | Production Purpose & Role |
| :--- | :--- | :--- |
| **Speech → Text (STT)** | **NVIDIA Nemotron Speech ASR** | Converts customer's voice into text in real time with continuous streaming chunks (`nemotron-asr-streaming`). |
| **Serving Layer (STT)** | **NVIDIA Riva ASR** | Production low-latency serving/streaming layer for ASR, Voice Activity Detection (VAD), audio processing, and endpointing. |
| **LLM / Response Generation** | **NVIDIA Nemotron** | Understands the transcript, analyzes customer intent, executes business logic / tools (e.g., loan balance lookup), and generates response text. |
| **Text → Speech (TTS)** | **NVIDIA Riva Magpie TTS** | Multilingual neural TTS model for agentic voice applications, converting AI-generated text back into natural human-like voice. |

---

## 2. Speech-to-Text (STT)

### Recommended Model
**NVIDIA Nemotron ASR** (`nemotron-asr-streaming`)

NVIDIA provides `nemotron-asr-streaming` for real-time speech recognition. It is exposed through **NVIDIA Riva / NIM** and supports streaming transcription.

### Inbound Flow
```
Customer speaks
      ↓
Microphone / Phone audio (Tata SIP Trunk)
      ↓
NVIDIA Riva (Audio Processing & VAD)
      ↓
Nemotron ASR (Streaming Transcription)
      ↓
Text transcript
      ↓
Nemotron LLM
```

### Example
- **Customer**: *"I want to know my loan balance."*
- **STT output**: *"I want to know my loan balance."*

---

## 3. Text-to-Speech (TTS)

### Recommended Model
**NVIDIA Riva Magpie TTS** (`riva-magpie-multilingual-v1`)

For the reverse direction, **NVIDIA Riva Magpie TTS** generates natural conversational speech. NVIDIA describes Magpie as a multilingual TTS model designed specifically for agentic voice applications.

### Outbound Flow
```
Nemotron LLM (Reasoning & Business Logic)
      ↓
"Your current loan balance is ₹50,000."
      ↓
Riva Magpie TTS (Neural Synthesis)
      ↓
Audio / Human-like voice
      ↓
Tata Dialer Audio Bridge
      ↓
Customer
```

---

## 4. Complete Tata Dialer Voice-AI Flow

```
             CUSTOMER
                 │
                 │ Voice (16kHz PCM Linear / RTP)
                 ▼
       ┌──────────────────┐
       │ NVIDIA Riva      │ (Audio Ingestion, Noise Gating & VAD)
       │ Audio Processing │
       └────────┬─────────┘
                ▼
       ┌──────────────────┐
       │ Nemotron ASR     │ (Speech → Text Real-Time Streaming)
       │ Speech → Text    │
       └────────┬─────────┘
                ▼ Text Transcript
       ┌──────────────────┐
       │ Nemotron LLM     │ (Agentic Dialogue & Context Understanding)
       │ Understand/Think │
       └────────┬─────────┘
                │
        API / Business Logic (Query Customer Loan Account / DB)
                │
                ▼ Response Text ("Your current loan balance is ₹50,000.")
       ┌──────────────────┐
       │ Riva Magpie TTS  │ (Text → Speech Multilingual Neural Model)
       │ Text → Speech    │
       └────────┬─────────┘
                │ Synthesized 24kHz Audio
                ▼
       ┌──────────────────┐
       │ Tata Smartflo    │ (Carrier PSTN & Cloud SIP Trunk Gateway)
       │ Dialer Bridge    │
       └────────┬─────────┘
                ▼
             CUSTOMER (Hears Natural Conversational Agent)
```

---

## 5. Platform Architecture: Riva as Platform vs. Speech Model

> **Key Distinction**:
> - **NVIDIA Riva** is primarily the **speech AI platform and production serving/streaming layer**, providing high-throughput gRPC streaming, zero-copy memory buffers, real-time Voice Activity Detection (VAD), and turn-taking endpointing.
> - **ASR (Nemotron Speech ASR)** and **TTS (Riva Magpie TTS)** are the **actual specialized neural speech models** running inside or through the Riva runtime.

### Summary Architecture Configuration:
- **STT**: Nemotron ASR + NVIDIA Riva
- **LLM**: NVIDIA Nemotron
- **TTS**: NVIDIA Riva Magpie TTS
- **Dialer & Carrier**: Tata Smartflo Cloud Dialer & SIP Trunks

---

## 6. Implementation in CallForge Ops Codebase

1. **Backend Service (`server/calling/nvidiaVoicePipeline.ts`)**:
   - Manages end-to-end 4-layer orchestration.
   - Built-in business logic for banking, loan balances, EMI schedules, and payment links.
   - Sub-300ms round-trip latency benchmarking and telemetry.

2. **Telephony Provider (`server/calling/provider.ts`)**:
   - `TataDialerProvider` connects Tata Smartflo Cloud Dialer to the NVIDIA Riva voice pipeline.

3. **Interactive Studio (`client/src/components/calling/ai/NvidiaVoicePipelineStudio.tsx`)**:
   - Live visual diagram of the 4-tier flow.
   - Interactive pipeline simulator with the pre-loaded loan balance test query.
   - Live browser Web Audio playback and real-time latency breakdown.

4. **Voice Personas (`client/src/components/calling/ai/VoiceSelectionPicker.tsx`)**:
   - Added NVIDIA Riva Magpie voices: `Aditi (Magpie)`, `Arjun (Magpie)`, and `Meera (Magpie)`.

5. **Trunk Gateway (`client/src/components/calling/global/CarrierConfigModal.tsx`)**:
   - Added Tata Smartflo & NVIDIA Riva gRPC configuration cards and live connection test.
