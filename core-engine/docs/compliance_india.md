# India Telecalling Regulatory Compliance Checklist (TRAI / DoT)

## Overview
Outbound automated calling in India is strictly governed by the Telecom Regulatory Authority of India (TRAI), the Department of Telecommunications (DoT), and Telecom Commercial Communications Customer Preference Regulations (TCCCPR, 2018).

---

## 1. TRAI / DLT Registration
- [ ] **Principal Entity (PE) Registration:** The business entity running outbound calling campaigns must be registered as a Principal Entity on a telecom DLT portal (e.g., Jio, Airtel, Vodafone Idea, or BSNL DLT).
- [ ] **Telemarketer (TM) Registration:** If dialing on behalf of clients, ensure registration under the Registered Telemarketer (RTM) category.
- [ ] **Consent Template Registration:** Voice consent scripts must be registered and approved under DLT Consent Management.

---

## 2. Dedicated Number Series (140-Series & SIP Trunks)
- [ ] **Promotional Calls (140-series):** In India, promotional telemarketing calls MUST originate strictly from dedicated `140-series` CLI numbers assigned by licensed access service providers.
- [ ] **Service / Transactional Calls:** Transactional and informational calls (such as loan EMI reminders, OTPs, doctor appointments) may originate from transactional SIP headers or 160-series numbers as allocated by DoT.
- [ ] **No Calling Identity Spoofing:** Dynamic Caller ID spoofing is illegal under the Indian Telegraph Act. CLI must match the verified telecom trunk.

---

## 3. National Do Not Call (NDNC / DND) Scrubbing
- [ ] **Pre-Dial DND Scrubbing:** All promotional campaign lists must be scrubbed against TRAI’s National Customer Preference Register (NCPR) within 24 hours prior to dialing.
- [ ] **Opt-Out / Internal DND:** The system must immediately honor verbal opt-outs (*"mujhe call mat karo"*, *"remove my number"*) and persist them to the internal blacklist.
- [ ] **Customer Preferences:** Honor customer-selected preference categories (e.g., Banking/Real Estate/Education) registered in their TRAI preference profile.

---

## 4. Permitted Calling Hours (IST)
- [ ] **Strict 09:00 to 21:00 IST Window:** Under TRAI guidelines, promotional calls are strictly prohibited before 09:00 AM IST and after 09:00 PM IST.
- [ ] **Engine Enforcement:** Our `agent/compliance.py` and `agent/campaign.py` enforce this automatically, rejecting or deferring calls scheduled outside 09:00-21:00 IST.

---

## 5. Explicit AI & Recording Disclosure
- [ ] **Recording Consent:** Callers must be informed at the beginning of the call if the audio is being recorded for quality and training purposes.
- [ ] **Right to Revoke:** If a caller states *"recording band karo"*, the system must immediately stop audio capture.
- [ ] **Truth in AI Identity:** If a caller asks if they are speaking to an AI or robot, the system must truthfully disclose its automated identity.

---

## 6. Data Privacy & Financial Security (DPDP Act & RBI)
- [ ] **PCI-DSS Compliance:** Never solicit, store, or process Credit/Debit card numbers, CVVs, expiration dates, UPI PINs, or net banking passwords over the voice channel.
- [ ] **Phone Number Masking:** Transcripts, logs, and public dashboards must mask phone numbers preserving only the last 4 digits (e.g., `*********3210`).
- [ ] **Data Retention & Encryption:** Transcripts and audio recordings on disk must be encrypted and retained only as long as permitted under the Digital Personal Data Protection (DPDP) Act.
