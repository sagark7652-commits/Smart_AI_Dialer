# Webhook Integration & Event Specifications

Core Calling Agent provides asynchronous result webhooks for real-time CRM and telephony synchronization. Every event payload is signed with HMAC-SHA256 and delivered with 5 exponential retries.

---

## 1. Security & Signature Verification

Every outgoing HTTP POST request contains the following standard headers:

| Header | Description | Example |
|---|---|---|
| `X-Webhook-Signature` | Timestamp + HMAC-SHA256 signature | `t=1730200000,v1=5d41402abc4b2a76b9719d911017c592` |
| `X-Webhook-Timestamp` | Unix epoch time in seconds | `1730200000` |
| `X-Idempotency-Key` | Unique UUID per event dispatch | `a1b2c3d4-e5f6-7890-abcd-ef0123456789` |
| `Content-Type` | MIME type | `application/json` |

### Python Signature Verification Sample (FastAPI / Flask)

```python
import hashlib
import hmac
import time
from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI()
WEBHOOK_SIGNING_SECRET = "your-configured-signing-secret"

def verify_calling_agent_webhook(payload_bytes: bytes, signature_header: str, secret: str, tolerance_sec: int = 300):
    if not signature_header or "t=" not in signature_header or "v1=" not in signature_header:
        raise ValueError("Malformed signature header")

    parts = dict(item.split("=") for item in signature_header.split(","))
    timestamp = int(parts["t"])
    provided_sig = parts["v1"]

    # Prevent replay attacks
    now = int(time.time())
    if abs(now - timestamp) > tolerance_sec:
        raise ValueError("Timestamp expired or clock drift")

    signed_data = f"{timestamp}.".encode("utf-8") + payload_bytes
    expected_sig = hmac.new(secret.encode("utf-8"), signed_data, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_sig, provided_sig):
        raise ValueError("Invalid HMAC signature")
    return True

@app.post("/webhooks/calling-agent")
async def receive_webhook(
    request: Request,
    x_webhook_signature: str = Header(None),
):
    body = await request.body()
    try:
        verify_calling_agent_webhook(body, x_webhook_signature, WEBHOOK_SIGNING_SECRET)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    event = await request.json()
    print(f"Received verified event: {event.get('event')} (ID: {event.get('id')})")
    return {"received": True}
```

---

## 2. Event Payloads

### `call.started`
Dispatched when a call connects and the audio stream begins:
```json
{
  "id": "e4b3c2a1-0987-6543-210f-fedcba987654",
  "event": "call.started",
  "timestamp": 1730200000,
  "agent_id": "clinic_receptionist",
  "call_id": "call_123456789",
  "data": {
    "direction": "outbound",
    "provider": "twilio",
    "caller_number_masked": "*******4321",
    "started_at": "2026-10-29T12:00:00Z"
  }
}
```

### `call.ended`
Dispatched when a call terminates (with summary, outcome, cost, flags, and transcript):
```json
{
  "id": "f5a4b3c2-1098-7654-3210-abcdef012345",
  "event": "call.ended",
  "timestamp": 1730200180,
  "agent_id": "clinic_receptionist",
  "call_id": "call_123456789",
  "data": {
    "duration_sec": 142.5,
    "end_reason": "caller_hungup",
    "outcome": "appointment_booked",
    "summary": "Caller Rahul Sharma booked dental cleaning appointment for tomorrow 10 AM.",
    "collected_fields": {
      "patient_name": "Rahul Sharma",
      "preferred_date": "tomorrow",
      "time_slot": "10:00 AM",
      "service": "Dental Cleaning"
    },
    "cost_usd": 0.048,
    "flags": ["needs_review:false"],
    "transcript": [
      {"role": "agent", "text": "Namaste! Welcome to Aarogya Dental Care."},
      {"role": "user", "text": "I want to book an appointment for tomorrow."}
    ]
  }
}
```

### `lead.captured`
Dispatched when qualification or contact details are captured:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "event": "lead.captured",
  "timestamp": 1730200150,
  "agent_id": "sales_qualifier",
  "call_id": "call_123456789",
  "data": {
    "lead_name": "Suresh Patil",
    "phone_masked": "*******9876",
    "intent": "Enterprise 5G Cloud Migration",
    "budget": "High",
    "timeline": "Immediate"
  }
}
```

### `callback.scheduled`
Dispatched when caller requests a callback:
```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f0123456789a",
  "event": "callback.scheduled",
  "timestamp": 1730200120,
  "agent_id": "billing_reminder",
  "call_id": "call_123456789",
  "data": {
    "callback_id": 42,
    "phone_masked": "*******5678",
    "scheduled_time": "2026-10-30T10:30:00Z",
    "timezone": "Asia/Kolkata",
    "reason": "Customer busy in meeting",
    "context_summary": "Customer acknowledged EMI reminder and asked for morning callback."
  }
}
```

### `campaign.completed`
Dispatched when an outbound campaign finishes all leads:
```json
{
  "id": "c3d4e5f6-a7b8-9012-cdef-0123456789ab",
  "event": "campaign.completed",
  "timestamp": 1730205000,
  "agent_id": "telecaller_sales",
  "call_id": null,
  "data": {
    "campaign_id": "camp_oct29_telecaller",
    "name": "SwiftTel 5G Promo",
    "total_contacts": 200,
    "completed": 165,
    "failed": 25,
    "dnd_blocked": 10,
    "total_cost_usd": 7.42
  }
}
```

---

## 3. Fallback Polling Endpoints

If your server cannot receive external webhooks (e.g. firewall or development localhost), use the polling API:

- **List Recent Webhook Events:**
  `GET /webhooks/events?status=delivered&limit=50`
- **View Dead-Letter Failed Events:**
  `GET /webhooks/dead-letter`
- **Trigger Manual Dead-Letter Replay:**
  `POST /webhooks/dead-letter/replay`
  CLI Tool:
  `python scripts/replay_webhooks.py --limit 50`
