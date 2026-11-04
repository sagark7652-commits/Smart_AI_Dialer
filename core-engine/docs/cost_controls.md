# Cost Controls & Budget Enforcement

## Overview
The engine features real-time cost tracking, hard duration caps, budget enforcement, and tiered alerts to prevent runaway cloud expenses across STT, LLM, TTS, and Telephony.

---

## 1. Per-Call Hard Guardrails
Configured in `agent/pipeline.py`:
- **Max Duration Limit:** Default `600 seconds` (10 minutes).
- **Max Estimated Cost Limit:** Default `5.00 INR` (~$0.06 USD).
- **Graceful Verbal Wrap-up:** Before hard disconnection, the agent speaks a polite wrap-up:
  - Hindi: *"समय सीमा समाप्त होने के कारण यह कॉल समाप्त की जा रही है। सहायता के लिए धन्यवाद!"*
  - English: *"This call has reached its maximum scheduled time limit. Thank you for your time!"*

---

## 2. API Key Quotas & Tiered Rate Limiting
Configured on each API key in the database:
- `daily_call_limit`: Maximum calls per day (e.g., 500)
- `monthly_minute_limit`: Total billed minutes allowed per calendar month
- `monthly_cost_limit_usd`: Hard financial limit in USD

### Threshold Actions:
1. **At 80% Utilization:** Emits an asynchronous warning alert log/event (`QUOTA_WARNING_80_PERCENT`). Calls proceed normally.
2. **At 100% Utilization:** Enforces immediate hard rejection. Any new outbound call request receives HTTP `429 Too Many Requests`:
   ```json
   {
     "detail": "API key usage limit exceeded: monthly_cost_limit_usd reached ($50.00 / $50.00)."
   }
   ```

---

## 3. Campaign Budget Caps
- Each campaign supports `budget_usd` or `budget_inr`.
- When the accrued spend reaches 100% of the campaign budget:
  - New pending dials are halted immediately with status `budget_exceeded`.
  - In-flight active calls are permitted to complete cleanly without abrupt termination.

---

## 4. Usage Analytics Endpoint
Endpoint: `GET /usage`

Returns comprehensive usage data:
```json
{
  "status": "ok",
  "summary": {
    "total_calls": 142,
    "total_duration_minutes": 284.5,
    "total_cost_usd": 3.42,
    "total_cost_inr": 283.86
  },
  "breakdown_by_provider": {
    "twilio": {"calls": 100, "cost_usd": 2.50},
    "exotel": {"calls": 42, "cost_usd": 0.92}
  },
  "breakdown_by_mode": {
    "telecaller_sales": {"calls": 80, "cost_usd": 1.95},
    "reminder_collection": {"calls": 62, "cost_usd": 1.47}
  },
  "breakdown_by_day": [
    {"date": "2026-10-29", "calls": 142, "cost_usd": 3.42}
  ]
}
```
