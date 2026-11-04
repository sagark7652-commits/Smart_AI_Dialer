# Voice Recording & Custom Cloning Guide

**Goal:** Create studio-grade custom cloned AI voices for Marathi, Indian English, and Hindi that maintain natural accent, emotional warmth, and seamless prosody.

---

## 1. Provider Recording & Duration Requirements (From Official Docs)

| Provider | Cloning Type | Audio Duration Required | Format & Spec | Primary Strengths |
|---|---|---|---|---|
| **Cartesia** | **Instant Voice Cloning (IVC)** | 10–30 seconds | 24kHz or 44.1kHz, 16-bit mono WAV | Rapid turnaround, sub-90ms streaming latency |
| **Cartesia** | **Pro Voice Cloning (PVC)** | 30+ minutes | 44.1kHz / 48kHz, 24-bit/16-bit uncompressed WAV | High dynamic range, identical vocal timbre, no artifacts |
| **Sarvam AI** | **Instant Cloning** | 30–60 seconds | 24kHz / 48kHz WAV | Authentic Indian accents, colloquial Hindi/Marathi phonetics |
| **ElevenLabs** | **Instant Voice Clone (IVC)** | 30 seconds – 2 minutes | 44.1kHz WAV / MP3 | Fast setup, wide emotional expressiveness |
| **ElevenLabs** | **Professional Voice Clone (PVC)**| 10–30 minutes | 44.1kHz WAV, studio SNR > 30dB | Nuanced speech, multiple emotional registers |

---

## 2. Studio Recording Setup & Best Practices

### Acoustic Environment
- **Quiet Room:** Choose an interior room with minimal outside traffic noise. Soft furnishings (carpets, curtains, foam panels, bookshelf) help absorb reflections.
- **Eliminate Background Hiss:** Turn off ceiling fans, air conditioners, and computer cooling fans near the microphone.
- **Zero Echo / Reverb:** Avoid bathrooms, large empty halls, or tiled rooms. If a recording booth is unavailable, a walk-in wardrobe with hanging clothes provides excellent acoustic damping.

### Hardware & Placement
- **Microphone:** Dedicated cardioid condenser microphone (e.g. Rode NT1, Shure MV7, or Audio-Technica AT2020) or high-grade USB microphone with pop filter.
- **Distance:** Keep mouth 12 to 15 cm (5 to 6 inches) from the microphone capsule.
- **Pop Filter:** Mandatory to prevent plosives (*p*, *b*, *t*, *ph*) from distorting audio.
- **Gain & Levels:** Set input gain so average speaking peaks hit between **-18 dBFS and -12 dBFS**. Never exceed -6 dBFS (prevents digital clipping).
- **Format:** Uncompressed 24-bit or 16-bit PCM WAV, 44,100 Hz or 48,000 Hz, Mono.

### Performance & Cadence
- **Posture:** Sit upright or stand comfortably. Keep water nearby to avoid mouth dryness or lip smacks.
- **Pacing:** Speak at a natural conversational speed (approx. 140–155 words per minute). Do not rush or artificially slow down.
- **Consistency:** Keep the exact same distance and speaking energy throughout the recording session.

### What to Avoid
- ❌ Built-in laptop microphones or Bluetooth wireless headsets (compression artifacts degrade cloning quality).
- ❌ Heavy aggressive digital noise reduction (destroys voice timbre and high-frequency harmonics).
- ❌ Sudden volume shifts or leaning in and out of the microphone.
- ❌ Background keystrokes, paper rustling, or table thumps.

---

## 3. Phonetically Rich Recording Scripts

The speaker should read the scripts below at a comfortable, natural, and expressive conversational pace.

### A. Marathi (मराठी) Recording Script (Devanagari)
```text
[Section 1: Greeting & Hospitality]
नमस्कार! आरोग्य डेंटल केअर मध्ये आपले मनःपूर्वक स्वागत आहे. मी प्रिया बोलत आहे, सांगा मी आज आपल्याला कशी मदत करू शकते?

[Section 2: Numbers, Amounts & Dates]
आमचा दवाखाना सकाळी ९:०० ते रात्री ८:०० वाजेपर्यंत उघडा असतो. पुढील मंगळवारी, २६ एप्रिल रोजी दुपारी ३:३० वाजता डॉ. शर्मा यांच्याकडे वेळ उपलब्ध आहे. प्राथमिक सल्ला शुल्क ५०० रुपये आहे, तर दात स्वच्छतेचा खर्च १,२०० रुपयांपासून सुरू होतो. रूट कॅनाल उपचारासाठी ३,५०० ते ५,००० रुपये खर्च येऊ शकतो. काही तातडीची अडचण असल्यास आमचा हेल्पलाइन नंबर ९ ८ ७ ६ ५ ४ ३ २ १ ० असा आहे.

[Section 3: Phonetic Coverage (Consonants, Vowels, Aspirates & Nasals)]
ज्ञानेश्वर, ओंकार आणि ऋषिकेश यांनी काल सकाळी क्लिनिकला भेट दिली. कडक, खमंग, गंध, घड्याळ, चहा, छत्री, जहाज, झोपडी, टोपी, ठसा, डबा, ढग, बाण, तलवार, थाळी, दरवाजा, धनुष्य, नळ, पतंग, फळ, बदक, भटजी, मका, यज्ञ, रथ, लसूण, वजन, शहर, षटकोन, ससा, हत्ती, आणि ळ हे सर्व वर्ण मराठीच्या उच्चारात महत्त्वाचे आहेत.

[Section 4: Empathy, Clarification & Reassurance]
आपल्याला दातात अचानक कळ येते का, की थंड पाणी पिताना त्रास होतो? काळजी करू नका, डॉ. शर्मा अतिशय काळजीपूर्वक आणि वेदनारहित उपचार करतात. आपल्याला फोनवर थांबावे लागले याबद्दल मला मनापासून वाईट वाटते.

[Section 5: Objection Handling & Closing]
आपली भीती मी समजू शकते, परंतु आधुनिक तंत्रज्ञानामुळे आता कसलाही त्रास होत नाही. आपला वेळ दिल्याबद्दल धन्यवाद. काळजी घ्या आणि आपला दिवस आनंदात जावो!
```

### B. Indian English Recording Script
```text
[Section 1: Warm Welcome]
Hello and welcome to Aarogya Dental Care. My name is Priya, and I am glad to assist you today.

[Section 2: Numbers, Dates & Financials]
Our clinic is open Monday through Saturday from 9:00 AM to 8:00 PM. We have a consultation slot available on Wednesday, 26th April 2026, at 3:30 PM. The standard consultation fee is 500 rupees, and comprehensive teeth cleaning is 1,200 rupees. Advanced root canal treatments start at 3,500 rupees. You can reach our front desk directly at 9 8 7 6 5 4 3 2 1 0.

[Section 3: Phonetic Articulation & Loanwords]
Dr. Sharma combines fifteen years of clinical dentistry with digital X-ray diagnostics. Whether you need routine scaling, dental implants, orthodontic braces, or an emergency appointment, our team ensures gentle and hygienic treatment. The quick brown fox jumps over the lazy dog. Exceptional pediatric and geriatric dental care requires patience, precision, and empathy.

[Section 4: Empathy & Understanding]
I completely understand that visiting a dentist can feel stressful. Please rest assured that our clinic uses gentle numbing techniques and hospital-grade sterilization. I sincerely apologize for keeping you on hold for a brief moment.

[Section 5: Closing & Reassurance]
Would you like me to reserve the afternoon slot for you right now? Thank you for contacting Aarogya Dental Care. Have a fantastic day ahead!
```

### C. Hindi (हिन्दी) Recording Script (Devanagari)
```text
[Section 1: Greeting & Intro]
नमस्ते! आरोग्य डेंटल केयर में आपका हार्दिक स्वागत है। मैं प्रिया बोल रही हूँ, बताइए आज मैं आपकी क्या सहायता कर सकती हूँ?

[Section 2: Numbers, Currency & Dates]
हमारा क्लीनिक सोमवार से शनिवार सुबह ९:०० बजे से रात ८:०० बजे तक खुला रहता है। डॉक्टर शर्मा २६ अप्रैल को दोपहर ३:३० बजे उपलब्ध हैं। परामर्श शुल्क ५०० रुपये है, और दांतों की सफाई का खर्च १,२०० रुपये है। रूट कैनाल का उपचार ३,५०० रुपये से शुरू होता है। किसी भी सवाल के लिए हमारा संपर्क नंबर ९ ८ ७ ६ ५ ४ ३ २ १ ० है।

[Section 3: Phonetic Nuances (ख़, ग़, ज़, फ़, ड़, ढ़, ण)]
ऋतु, ज्ञान, क्षमा, और त्रिशूल जैसे शब्दों का उच्चारण शुद्ध होना चाहिए। बाज़ार, ज़िंदगी, फ़ैसला, ग़रीब, और ख़ास शब्दों में नुक्ते का ध्यान रखा जाता है। सड़क और चढ़ाई दोनों में ड़ और ढ़ का अंतर स्पष्ट सुनाई देना चाहिए।

[Section 4: Empathy & Medical Care]
क्या आपको मीठा खाने या ठंडा-गर्म पीने पर झनझनाहट महसूस होती है? बिल्कुल चिंता मत कीजिए, डॉक्टर शर्मा बहुत ही कोमल और दर्द-रहित तरीके से इलाज करते हैं। कॉल कनेक्ट होने में हुई देरी के लिए हमें अत्यंत खेद है।

[Section 5: Reassurance & Sign-off]
हम आपके पूरे आराम और सुरक्षा का ध्यान रखेंगे। आरोग्य डेंटल केयर पर भरोसा जताने के लिए बहुत-बहुत धन्यवाद। आपका दिन मंगलमय हो!
```

---

## 4. Speaker Consent Agreement Template (Mandatory Legal Pre-requisite)

> [!IMPORTANT]
> **LEGAL NOTICE:** You **MUST** have this agreement reviewed and customized by a qualified legal advisor in your jurisdiction before executing it. You must **ONLY** clone voices of individuals who have given explicit, informed, written consent. Never clone unauthorized voices or third-party recordings.

```text
================================================================================
                    VOICE TALENT CONSENT & RELEASE AGREEMENT
                      FOR AI VOICE SYNTHESIS AND CLONING
================================================================================

This Voice Talent Consent and Release Agreement ("Agreement") is entered into as
of [Date] ("Effective Date"), by and between:

SPEAKER / VOICE TALENT:
Full Name: __________________________________________________________________
Government ID / Passport No.: _______________________________________________
Address: ___________________________________________________________________
Email: ________________________________ Phone: ______________________________

AND

COMPANY / CLIENT:
Company Name: ______________________________________________________________
Registration No.: ___________________________________________________________
Address: ___________________________________________________________________
Contact Person: ____________________________________________________________

1. PURPOSE AND SCOPE OF USE
The Speaker grants the Company the worldwide, non-exclusive right and license
to record the Speaker's voice, audio performances, and vocal characteristics
("Voice Recordings") for the sole purpose of training, synthesizing, generating,
and operating an artificial intelligence (AI) text-to-speech voice model
("Synthetic Voice").

2. AUTHORIZED APPLICATION
The Synthetic Voice will be used exclusively within:
[X] Automated customer service and conversational AI phone agents
[X] Marketing and informative outbound telephony calls
[X] Web and mobile interactive customer voice assistance
Product/Brand Name: ________________________________________________________

3. PROHIBITED USES
The Company agrees that the Synthetic Voice shall NOT be used for:
a. Defamatory, obscene, unlawful, fraudulent, or harassing content.
b. Political campaigning or unauthorized endorsements.
c. Impersonation of the Speaker for fraudulent verification (e.g. biometric voice banking).

4. DURATION & REVOCATION / WITHDRAWAL
This license remains valid for a period of [e.g. 2 years / Until written notice],
unless terminated earlier by mutual written agreement. The Speaker may request
in writing the deletion and decommissioning of the trained AI voice model with
a minimum notice period of [30] days.

5. COMPENSATION
In full consideration for the rights granted herein, the Company agrees to pay
the Speaker: [Specify fixed fee / hourly rate / royalties].

6. CONFIRMATION OF VOLUNTARY CONSENT
The Speaker explicitly acknowledges and confirms:
a. I am 18 years of age or older.
b. I have voluntarily recorded the audio samples provided.
c. I understand my voice will be synthesized using generative artificial intelligence.
d. I have reviewed this agreement and understand my rights.

SPEAKER SIGNATURE:                           COMPANY REPRESENTATIVE SIGNATURE:

________________________________________     ________________________________________
Name:                                        Name:
Title:                                       Title:
Date:                                        Date:
================================================================================
```

---

## 5. Official Provider Voice Cloning Upload Process

Once consent is executed and audio WAV files are recorded:

1. **For Cartesia:**
   - Log into the Cartesia Console (`https://play.cartesia.ai/voices/custom`).
   - Click **Create Voice** -> **Clone Voice**.
   - Upload the consent-signed WAV file (10s–30s for IVC, 30m for PVC).
   - Label the voice (e.g., `aarogya-priya-mr-custom`).
   - Copy the generated `voice_id` UUID into `agent_config.yaml`.
2. **For Sarvam AI:**
   - Submit audio via Sarvam Voice Cloning endpoint (`POST /voice-cloning`).
   - Attach sample WAV and metadata.
   - Retrieve the resulting `speaker` ID.
3. **Audition and Benchmarking:**
   - Run `python scripts/voice_audition.py` to synthesize the standardized 12-part script.
   - Rate using `python scripts/voice_scorecard.py --evaluate` to ensure the cloned voice scores >= 4.0 in naturalness and clarity.
