# Auto-Flag Bad Calls & Triage Review Queue

## Overview
Automated post-call analysis inspects completed calls for anomalies, latency spikes, prompt injection attempts, caller frustration, and policy violations. Flawed calls are tagged with `needs_review=true` and specific flag reasons for human supervision.

---

## 1. Anomaly Flagging Criteria
Analyzed by `agent.analytics.compute_call_flags`:

| Flag | Trigger Condition |
|---|---|
| `loop_detected` | Consecutive repeated agent replies or high similarity (>80%) |
| `many_reprompts` | 3 or more silence reprompts issued during the call |
| `long_silence` | Turn gap exceeding 12 seconds with no caller speech |
| `low_stt_confidence` | Average STT confidence below 0.60 |
| `high_latency_turns` | Turn latency exceeding 2500ms (p95 spike) |
| `caller_hung_up_early` | Call duration under 10 seconds or early disconnect |
| `tool_error` | Any backend tool failure during active call |
| `negative_sentiment` | Frustrated keywords (*"bakwas"*, *"useless"*, *"manager ko bulao"*, etc.) |
| `transfer_requested` | Caller requested a live human operator |
| `wrong_language` | Caller spoke an unconfigured regional language |
| `injection_attempt` | Prompt injection attack intercepted and blocked |

---

## 2. CLI Triage Tool
Run the review tool to inspect queued calls:
```bash
python scripts/review_queue.py --limit 20
```

### JSON Mode (for CI/CD or automation):
```bash
python scripts/review_queue.py --json
```

Output includes:
- Masked phone number (preserving only the last 4 digits per compliance, e.g. `*********3210`)
- Detailed list of flagged anomaly reasons
- Exact local file paths to `caller.wav`, `agent.wav`, and `transcript.json`

---

## 3. Review Queue REST API
Filter calls requiring supervisor attention:
```http
GET /calls?needs_review=true&limit=50
```
Returns calls ordered newest first, with reasons and resource links.
