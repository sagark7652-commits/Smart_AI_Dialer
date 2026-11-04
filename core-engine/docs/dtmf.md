# DTMF (Keypad Input) Implementation & Provider Guide

## Overview
The engine supports interactive DTMF keypad collection during active calls for numeric selections, menu confirmation, callback requests, and human agent transfers.

---

## 1. Provider Capabilities & Architectural Truth
We adhere to documented provider mechanisms without improvisation:

| Feature | Twilio | Exotel |
|---|---|---|
| **In-Stream WebSocket DTMF** | **Supported natively.** Twilio delivers JSON `{"event": "dtmf", "dtmf": {"digit": "1"}}` over the active Media Stream WebSocket. | **NOT Supported.** Exotel's bidirectional Voicebot WebSocket does not emit in-stream DTMF JSON frames. |
| **Alternative Capture Method** | `<Gather input="dtmf">` in static TwiML | Exotel IVR Flow Builder "Gather" Applet sending HTTP POST to webhook endpoint |
| **Webhook Endpoint** | N/A (handled via WebSocket) | `/webhooks/exotel/dtmf` |
| **Redaction & PCI-DSS** | Built-in redaction in engine | Built-in redaction in engine |

---

## 2. Interactive DTMF Menus
Interactive keypad menus allow callers to choose actions:
- **Digit 1:** Confirm selection (`action: confirm`)
- **Digit 2:** Schedule callback (`action: callback`)
- **Digit 9:** Transfer to live human operator (`action: transfer_human`)

### Retry & Timeout Management
- **Configurable Max Retries:** Default `2`.
- **Invalid Keypress:** Speaks verbal retry prompt: *"अमान्य इनपुट। कृपया पुष्टि के लिए 1, कॉलबैक के लिए 2, या एजेंट के लिए 9 दबाएं।"*
- **Exceeded Retries:** Automatically fails over to human transfer.
- **Timeout (10s default):** Prompts the user; if unanswered, routes to human transfer or terminates.

---

## 3. Strict Security & Redaction
Per regulatory and security mandates:
- **Card Numbers, PINs, and OTPs are NEVER accepted via DTMF.**
- Any digit sequence resembling payment cards (12–19 digits), CVV/PINs (3–4 digits), or OTPs is immediately intercepted, rejected with verbal refusal (*"सुरक्षा कारणों से कार्ड नंबर, पिन या ओटीपी स्वीकार नहीं किया जा सकता"*), and recorded as `****` in transcripts and logs.
- Plain sensitive digits are never saved to database or webhooks.

---

## 4. Endpoints
- `POST /webhooks/exotel/dtmf`: Webhook called by Exotel Gather Applet (`CallSid`, `Digits`).
- `POST /calls/{call_id}/dtmf`: Manual DTMF injection for testing or web client keypad (`{"digit": "1"}`).
