# Data Governance, Retention & Privacy Architecture

## Overview
This document specifies the location of stored data, retention policies, redaction options, and access controls implemented within the engine.

> **Important Regulatory Notice:**
> Indian data-protection law (Digital Personal Data Protection Act, 2023) and telecom regulations (TRAI Telecom Commercial Communications Customer Preference Regulations, DoT licensing rules) apply to outbound and inbound telecalling operations. 
> The system configuration, tools, and scripts provided here are technical mechanisms to assist compliance. You must confirm your specific statutory, retention, and licensing obligations with a qualified legal advisor. Nothing in this document or codebase constitutes legal advice or formal legal conclusions.

---

## 1. Storage Map (What is Stored Where)

| Asset Category | Storage Location | Default Retention | Sensitivity / Protection |
|---|---|---|---|
| **Audio Recordings** | Local directory `recordings/<call_id>_*.wav` or secure object storage | 30 Days (Configurable) | Sensitive. Served strictly via 15-minute signed URLs with cryptographic HMAC tokens. |
| **Call Transcripts** | Disk `transcripts/session_<call_id>.json` & Database table `transcripts` | 90 Days (Configurable) | High. Subject to configurable PII redaction rules before persistence. |
| **Latency & Performance Metrics** | Disk `metrics/metrics_<call_id>.json` & Database table `usage_records` | 180 Days | Operational metadata. Phone numbers masked preserving last 4 digits. |
| **Call Metadata & History** | Database table `calls` | Configurable per tenant | Contains masked caller CLI, status, outcome summary, duration, and flags. |
| **Customer Consent Logs** | In-memory & Database table `consent_logs` | Permanent / Audit lifecycle | Records verbal/DTMF recording consent, contact permission, and revocations. |
| **Audit Logs** | In-memory & Database table `audit_logs` | 365 Days | Cryptographic log of actor access, signed URL generation, and exports. |

---

## 2. Configurable PII Redaction
Implemented in `agent/governance/pii_redactor.py`. Can be toggled per agent or organization:
- **Phone Numbers:** Masked leaving only the last 4 digits (e.g. `*********_3210`).
- **Email Addresses:** Masked user name (e.g. `r***@company.com`).
- **Aadhaar Numbers:** 12-digit Indian national identity pattern masked as `XXXX-XXXX-1234`.
- **PAN Card Numbers:** 10-character alphanumeric masked as `ABCDE****F`.
- **Payment Cards & Security Tokens:** 13–19 digit cards, 3-digit CVVs, and OTP/PIN patterns are permanently redacted.
- **Postal PIN Codes:** 6-digit pin codes masked as `[PINCODE_XXXXXX]`.

---

## 3. Subject Rights Endpoints (Right to Access & Erasure)
- **Data Export:** `GET /data/{phone}/export`
  Returns all calls, transcripts, consent records, and metrics associated with the phone number in a portable JSON format.
- **Data Erasure:** `DELETE /data/{phone}`
  Permanently purges all database call records, transcripts, and corresponding physical recording WAV files from disk.

---

## 4. Secure Recording Access Control
Audio files are not publicly accessible:
1. An authenticated API caller requests a signed URL: `GET /recordings/{call_id}/signed-url`.
2. The engine generates an HMAC-SHA256 URL token expiring in 15 minutes (configurable TTL).
3. The stream endpoint `GET /recordings/{call_id}/stream?expires=...&signature=...` verifies signature freshness and validity before streaming audio frames.
4. Every access event is logged to the audit log.
