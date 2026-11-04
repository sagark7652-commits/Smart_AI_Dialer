# TTS Provider Capability Audit for Marathi, Indian English, and Hindi

**Date:** 2026-11-01  
**Scope:** Official documentation verification for real-time conversational telephony TTS in Marathi (`mr`), Indian English (`en-IN`), and Hindi (`hi`).  
**Decision Criteria:** Real-time streaming WebSocket, continuation/context prosody, pronunciation controls, custom voice cloning, native telephony mulaw 8000 output, and commercial licensing.

---

## 1. Provider Comparison Matrix

| Provider | Supported Languages (`mr`, `en-IN`, `hi`) | Streaming WebSocket | Context Continuation | Pronunciation Control | Stock Voices | Voice Cloning Options | Cloning Audio Req. | Telephony mu-law 8kHz | Commercial License | Pricing (Standard / Min) |
|---|---|---|---|---|---|---|---|---|---|---|
| **Cartesia** | **mr**: Yes<br>**en-IN**: Yes<br>**hi**: Yes | Yes (`wss://api.cartesia.ai/tts/websocket`) | Yes (`context_id` + `continue: true`) | Custom dictionary & phonetic rules | 50+ global, Indian multilingual personas | Instant Voice Cloning (IVC) & Pro Voice Cloning (PVC) | IVC: ~10 sec<br>PVC: 30+ min clean audio | Yes (`pcm_mulaw` at 8000 Hz) | Yes (on Pro Plan and above) | ~1 credit/char (~$5/mo Pro, 100k+ chars) |
| **Sarvam AI** | **mr**: Yes (`mr-IN`)<br>**en-IN**: Yes (`en-IN`)<br>**hi**: Yes (`hi-IN`) | Yes (REST streaming & WebSocket) | Chunk sequence preservation | Transliteration & Indic phonetic text prep | 30+ in v3 (`leher`, `meera`, `arvind`), 200+ in v4-flash | Instant Voice Cloning (IVC) | ~30 sec clean speech | Yes (native 8000 Hz, 16000 Hz, 24000 Hz) | Yes (Commercial rights included on paid tiers) | ₹2.00 to ₹3.00 per 1,000 characters |
| **ElevenLabs** | **mr**: Yes<br>**en-IN**: Yes<br>**hi**: Yes | Yes (`wss://api.elevenlabs.io/v1/text-to-speech/.../stream-input`) | Yes (`previous_text` & `next_text`) | Pronunciation Dictionary API & phonemes | 100+ stock voices (`Rachel`, `Aria`, `Adam`, etc.) | Instant Voice Cloning (IVC) & Professional Voice Cloning (PVC) | IVC: ~30 sec<br>PVC: 10–30 min clean audio | Yes (`ulaw_8000` output format) | Yes (Creator/Pro/Scale plans) | ~$22 to $99/mo depending on tier |
| **Azure AI Speech** | **mr**: Yes (`mr-IN-AarohiNeural`, `mr-IN-ManoharNeural`)<br>**en-IN**: Yes (`en-IN-NeerjaNeural`, `en-IN-PrabhatNeural`)<br>**hi**: Yes (`hi-IN-SwaraNeural`, `hi-IN-MadhurNeural`) | Yes (Cognitive Speech SDK WebSocket) | SSML structure continuation | Full SSML `<phoneme>`, `<prosody>`, `<lexicon>` | 2+ per language, high clarity | Custom Neural Voice (CNV) | 300+ sentences / 30+ min verified audio | Yes (`raw-8khz-8bit-mono-mulaw`) | Yes (Azure enterprise commercial terms) | ~$16 per 1,000,000 characters |
| **Google Cloud TTS** | **mr**: Yes (`mr-IN-Wavenet-A`, `Standard-A`)<br>**en-IN**: Yes (`en-IN-Neural2-A/B/C/D`)<br>**hi**: Yes (`hi-IN-Neural2-A/B/C/D`) | Yes (Bidirectional gRPC streaming) | SSML boundary context | Full SSML `<phoneme>`, `<say-as>`, `<prosody>` | Studio/Neural2/Wavenet voices | Custom Voice (Enterprise gating) | Enterprise custom training dataset | Yes (`MULAW` at 8000 Hz) | Yes (Google Cloud Commercial Agreement) | ~$16 per 1,000,000 characters |
| **Deepgram Aura** | **mr**: **NO**<br>**en-IN**: Limited<br>**hi**: **NO** | Yes (`wss://api.deepgram.com/v1/speak`) | Chunked streaming | Pronunciation dictionary | English personas (`Asteria`, `Luna`, `Arcas`) | Not publicly self-serve | N/A | Yes | Yes | ~$0.015 / 1k chars |

---

## 2. Official Documentation Pages Consulted

1. **Cartesia:**
   - Sonic Multilingual & Language Coverage: `https://cartesia.ai/docs/capabilities/languages`
   - WebSocket API & Context Continuation (`context_id`, `continue`): `https://cartesia.ai/docs/api-reference/websocket`
   - Voice Cloning Guidelines & Compliance: `https://cartesia.ai/docs/capabilities/voice-cloning`
   - Pricing & Commercial Tiers: `https://cartesia.ai/pricing`
2. **Sarvam AI:**
   - Bulbul v3 / v4-Flash Indic Text-to-Speech: `https://docs.sarvam.ai/api-reference/text-to-speech`
   - WebSocket & Streaming Integration: `https://docs.sarvam.ai/api-reference/text-to-speech/streaming`
   - Voice Cloning & Pricing: `https://www.sarvam.ai/pricing`
3. **ElevenLabs:**
   - Multilingual v2 & Language Matrix: `https://elevenlabs.io/docs/languages`
   - Text-to-Speech WebSocket Input Streaming: `https://elevenlabs.io/docs/api-reference/websockets`
   - Voice Cloning Requirements (IVC vs PVC): `https://elevenlabs.io/docs/voice-lab/instant-voice-cloning`
4. **Deepgram:**
   - Aura Voice Models & Language Support: `https://developers.deepgram.com/docs/aura-tts`
5. **Azure Cognitive Services:**
   - Speech Service Language & Voice Support: `https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts`
6. **Google Cloud Text-to-Speech:**
   - Supported Voices and Languages: `https://cloud.google.com/text-to-speech/docs/voices`

---

## 3. Recommended Candidates for Marathi, Hindi, and Indian English

- **Primary Candidate for Naturalness & Speed:** **Cartesia Sonic 3.6**  
  *Why:* Lowest first-audio latency (<90ms), native `context_id` continuation preventing boundary clicks, native `pcm_mulaw` 8000Hz telephony streaming, and native Devanagari code-switching.
- **Specialist Indic Candidate for Spoken Marathi & Hindi:** **Sarvam AI (Bulbul v3 / v4-flash)**  
  *Why:* Built natively for Indian languages and accents with authentic pronunciation of Maharashtra and North India colloquial terms, native 8kHz telephony support, and low pricing (₹2/1k chars).
- **Secondary Multilingual / Voice Cloning Fallback:** **ElevenLabs (Multilingual v2)**  
  *Why:* High emotional fidelity and established voice cloning, though higher latency (~250-400ms) than Cartesia.
- **Enterprise SSML Precision Candidate:** **Azure Neural Speech** (`mr-IN-AarohiNeural`, `hi-IN-SwaraNeural`, `en-IN-NeerjaNeural`)  
  *Why:* Exact phonetic control with SSML `<phoneme>` and rock-solid corporate uptime.
