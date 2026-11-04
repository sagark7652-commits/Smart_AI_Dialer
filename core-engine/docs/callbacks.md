# Callback Scheduler Guide

## Overview
The Callback Scheduler allows callers to schedule future calls through the LLM tool `schedule_callback`, or via REST API endpoints. Scheduled callbacks preserve context from the previous interaction so the agent starts with full customer background.

---

## 1. Tool-Driven Callback Execution
When a caller says:
- *"I am driving right now, call me tomorrow at 4 PM"*
- *"Abhi busy hoon, kal dopahar me baat karte hain"*

The LLM executes the `schedule_callback` tool:
```json
{
  "name": "schedule_callback",
  "arguments": {
    "preferred_time": "tomorrow at 4:00 PM",
    "timezone": "Asia/Kolkata",
    "reason": "Customer driving during initial call"
  }
}
```

### Automatic Calling Hours Slot Adjustment
If the caller requests a time outside legal calling hours (e.g., 23:00 IST):
1. The scheduler moves the callback to the next allowable calling slot (e.g., 09:30 AM IST the next business morning).
2. The agent explains this verbally to the caller: *"नियमों के अनुसार हम रात को कॉल नहीं कर सकते, इसलिए मैंने आपका कॉलबैक कल सुबह 9:30 बजे शेड्यूल कर दिया है।"*

---

## 2. Context Injection
When the scheduled time arrives:
1. The scheduler checks DND and current calling hours.
2. The outbound call is triggered.
3. The previous call summary, customer name, and previously collected fields are injected into the agent prompt:
   ```text
   === PREVIOUS CALL CONTEXT ===
   Previous Call Date: 2026-10-29
   Reason for Callback: Customer was driving
   Outcome: Rescheduled
   Notes: Interested in 5G Super Annual Plan, wanted price breakdown.
   =============================
   ```
4. The agent starts naturally: *"नमस्ते राहुल जी! जैसा कि हमने तय किया था, मैं 5G प्लान की जानकारी देने के लिए वापस कॉल कर रही हूँ।"*

---

## 3. Policy Limits
- **Max Callback Attempts:** 3 attempts per scheduled callback job.
- **Auto-Cancellation:** If the lead calls inbound before the scheduled callback time, the pending callback is resolved.

---

## 4. REST API Endpoints
- `GET /callbacks?status=pending`: List active or pending callbacks.
- `POST /callbacks`: Manually schedule an outbound callback.
- `POST /callbacks/{id}/cancel`: Cancel a pending callback.
