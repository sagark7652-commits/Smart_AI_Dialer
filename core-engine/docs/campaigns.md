# Outbound Telecalling Campaigns Guide

## Overview
The Campaign Runner handles high-throughput, compliant outbound calling batches with concurrency throttling, automated retries, DND scrubbing, and crash-safe idempotency.

---

## 1. CSV Lead Upload & Validation
Endpoint: `POST /campaigns` (multipart or JSON payload)

### CSV Format Requirements
```csv
phone,customer_name,amount_due,due_date
+919876543210,Rahul Sharma,4850,2026-11-05
+919123456789,Priya Verma,1999,2026-11-02
```

### Validation Rules
- **Phone Validation:** Strictly validated against E.164 international format (e.g., `+91XXXXXXXXXX`).
- **Deduplication:** Repeated phone numbers within the same campaign CSV are automatically deduplicated.
- **Malformed Rows:** Malformed or invalid phone numbers are rejected immediately with row-by-row error logs and count metrics.

---

## 2. Campaign Configuration Parameters
| Parameter | Default | Description |
|---|---|---|
| `agent_id` | `default` | Calling agent profile and operational mode to dial with |
| `provider` | `twilio` | Telephony carrier (`twilio` or `exotel`) |
| `max_concurrency` | `5` | Concurrency limit (hard ceiling: 20 per engine instance) |
| `allowed_calling_hours` | `09:00 - 21:00` | Calling window enforced strictly in Indian Standard Time (IST) |
| `max_attempts` | `3` | Maximum redial attempts for busy, failed, or unanswered calls |
| `retry_gap_seconds` | `1800` | Delay between retry attempts (default: 30 minutes) |
| `max_calls_per_day` | `500` | Hard cap on total calls per 24-hour cycle |
| `budget_usd` / `budget_inr`| `None` | Optional spending ceiling; halts new dials once reached |

---

## 3. Pre-Call Verification & Compliance
Before any number is dialed, the engine executes mandatory pre-flight checks:
1. **IST Calling Window:** Must be between 09:00 and 21:00 IST. Outside this window, the call is deferred to the next allowed morning slot.
2. **Do-Not-Call (DND) Registry:** Phone numbers listed in internal DND or external NDNC lists are blocked with reason `DND_REGISTERED`.
3. **Concurrency Throttling:** Calls wait in `pending` queue until an active dial slot becomes available.

---

## 4. Crash-Safe Resume & Idempotency
- **State Machine:** `pending` -> `dialing` -> `answered` -> `completed` / `failed` / `blocked`
- **Double-Dial Prevention:** Every record maintains a unique `idempotency_key`.
- **Worker Recovery:** If the service restarts during a campaign, stale `dialing` jobs are audited against provider status rather than being blindly redialed.

---

## 5. REST API Endpoints
- `POST /campaigns`: Create and initiate campaign.
- `GET /campaigns/{id}`: Live progress metrics (answered count, connected count, average duration, outcomes breakdown, cost so far).
- `POST /campaigns/{id}/pause`: Temporarily halt outbound dialing.
- `POST /campaigns/{id}/resume`: Resume outbound dialing.
- `POST /campaigns/{id}/cancel`: Abort remaining calls.
- `GET /campaigns/{id}/results`: Export full results as CSV (lead phone, final outcome, call duration, collected fields, summary).
