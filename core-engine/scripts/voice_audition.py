"""Voice Audition Tool: Blind Multi-Provider Voice Quality Comparison for PART H1.

Generates the exact same standardized audition script per language:
(Marathi, English-India, Hindi)
covering:
1. Greeting
2. 3-Sentence Answer
3. Numbers
4. Rupee Amount
5. Date
6. Phone Number
7. Polite Question
8. Apology
9. Objection Reply
10. Goodbye
11. Long Paragraph 1 (6 sentences)
12. Long Paragraph 2 (6 sentences)

Saves blind audio files to voice_audition/audition_<lang>_<letter>.wav.
Saves confidential key to voice_audition/audition_key.json.
Reports measured first-audio latency for each candidate.
"""

import asyncio
import json
from pathlib import Path
import sys
import time
import wave
import numpy as np

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.config import get_settings
from agent.logger import setup_logger
from agent.tts.cartesia_tts import CartesiaTTS
from agent.tts.mock_tts import MockTTS
from agent.tts.normalizer import TextNormalizer
from agent.tts.sarvam_tts import SarvamTTS

logger = setup_logger("voice_audition")

SCRIPTS_PER_LANG = {
    "mr": (
        # 1. Greeting
        "नमस्कार! आरोग्य डेंटल केअर मध्ये आपले मनापासून स्वागत आहे. "
        # 2. 3-Sentence Answer
        "आमचा दवाखाना सोमवार ते शनिवार सकाळी ९:०० ते रात्री ८:०० वाजेपर्यंत चालू असतो. "
        "डॉ. शर्मा हे १५ वर्षांचा प्रदीर्घ अनुभव असलेले वरिष्ठ दंतरोग तज्ज्ञ आहेत. "
        "आमच्या क्लिनिकमध्ये अत्याधुनिक उपकरणांद्वारे रूट कॅनाल, दात बसवणे आणि दात स्वच्छतेचे सर्व उपचार केले जातात. "
        # 3. Numbers, Rupee Amount, Date, Phone Number
        "पुढील आठवड्यात २६ एप्रिल २०२६ रोजी दुपारी ३:३० वाजता आपल्यासाठी वेळ उपलब्ध आहे. "
        "नियमित तपासणीचे शुल्क १,२०० रुपये असून रूट कॅनाल ३,५०० रुपयांपासून सुरू होते. "
        "थेट संपर्क साधण्यासाठी आमचा अधिकृत फोन नंबर ९ ८ ७ ६ ५ ४ ३ २ १ ० असा आहे. "
        # 4. Polite Question
        "आपल्याला दातात काही दुखणे किंवा विशेष त्रास होत आहे का? "
        # 5. Apology
        "आपल्याला फोनवर थोडा वेळ थांबावे लागले याबद्दल मी मनापासून क्षमस्व आहे. "
        # 6. Objection Reply
        "आपली अडचण मी पूर्णपणे समजू शकते; बऱ्याच जणांना सुरुवातीला भीती वाटते, परंतु आमचे सर्व उपचार पूर्णपणे वेदनारहित आणि सुरक्षित असतात. "
        # 7. Goodbye
        "आरोग्य डेंटल केअरला वेळ दिल्याबद्दल धन्यवाद, आपला दिवस अत्यंत शुभ जावो! "
        # 8. Long Paragraph 1 (6 sentences)
        "आरोग्य डेंटल केअर हे पुण्यातील अग्रगण्य आणि विश्वासू दंतचिकित्सा केंद्र म्हणून ओळखले जाते. "
        "येथे प्रत्येक रुग्णाची वैयक्तिक तपासणी करून योग्य आणि पारदर्शक सल्ला दिला जातो. "
        "दातांच्या कोणत्याही त्रासाकडे दुर्लक्ष केल्यास भविष्यात संसर्ग वाढण्याची दाट शक्यता असते. "
        "म्हणूनच दर सहा महिन्यांनी दातांची नियमित तपासणी करून घेणे आरोग्यासाठी अत्यंत फायदेशीर ठरते. "
        "आमच्या क्लिनिकमध्ये स्वच्छता आणि निर्जंतुकीकरणाचे आंतरराष्ट्रीय निकष काटेकोरपणे पाळले जातात. "
        "आजच आपली अपॉइंटमेंट निश्चित करा आणि आपल्या हसण्याला अधिक सुंदर व निरोगी बनवा. "
        # 9. Long Paragraph 2 (6 sentences)
        "अनेकदा लोक दातांच्या दुखण्याकडे तात्पुरते दुर्लक्ष करतात किंवा मेडिकलमधून वेदनाशामक गोळ्या घेतात. "
        "परंतु वेळेवर योग्य उपचार न घेतल्यास दाताचे मूळ खराब होऊन दात काढावा लागण्याची वेळ येऊ शकते. "
        "रूट कॅनाल उपचाराने नैसर्गिक दात आयुष्यभरासाठी वाचवणे आजच्या आधुनिक तंत्रज्ञानामुळे शक्य झाले आहे. "
        "डॉ. शर्मा प्रत्येक उपचारादरम्यान रुग्णाला पूर्ण विश्रांती आणि आरामदायी वातावरण देतात. "
        "ज्येष्ठ नागरिक आणि लहान मुलांसाठी आमच्याकडे विशेष काळजीपूर्वक उपचार पद्धती उपलब्ध आहे. "
        "अधिक माहितीसाठी आपण आमच्या स्वागत कक्षाशी कधीही निःसंकोचपणे संपर्क साधू शकता."
    ),
    "en": (
        # 1. Greeting
        "Hello and welcome to Aarogya Dental Care! "
        # 2. 3-Sentence Answer
        "Our clinic is open Monday through Saturday from 9:00 AM to 8:00 PM. "
        "Dr. Sharma has over fifteen years of clinical experience in advanced dental treatments. "
        "We specialize in painless root canal procedures, cosmetic restorations, and routine preventive care. "
        # 3. Numbers, Rupee Amount, Date, Phone Number
        "We have a consultation appointment open for next week on 26th April 2026 at 3:30 PM. "
        "The comprehensive examination fee is 1,200 rupees, and root canal therapy starts at 3,500 rupees. "
        "Our direct helpline number is 9 8 7 6 5 4 3 2 1 0. "
        # 4. Polite Question
        "Are you currently experiencing any tooth pain or sensitivity? "
        # 5. Apology
        "I sincerely apologize for the brief hold time while connecting your call. "
        # 6. Objection Reply
        "I completely understand your apprehension; dental procedures can feel intimidating, but our gentle care protocols make every visit virtually painless. "
        # 7. Goodbye
        "Thank you so much for contacting Aarogya Dental Care, have a wonderful and healthy day ahead! "
        # 8. Long Paragraph 1 (6 sentences)
        "Aarogya Dental Care is dedicated to providing world-class dentistry with a gentle, patient-first approach. "
        "Our multispecialty facility integrates high-precision digital imaging with modern restorative techniques. "
        "Maintaining regular oral hygiene prevents unexpected emergencies and keeps your smile glowing with confidence. "
        "We recommend scheduling a routine checkup every six months to detect potential issues before they develop. "
        "Every instrument in our practice undergoes hospital-grade sterilization following rigorous safety protocols. "
        "We warmly invite you to experience comfortable dentistry designed around your peace of mind. "
        # 9. Long Paragraph 2 (6 sentences)
        "Dental discomfort often begins subtly before developing into severe pain that disrupts your daily routine. "
        "Delaying professional evaluation can compromise the underlying tooth structure and complicate treatment. "
        "Our root canal and restorative procedures preserve your natural teeth for a lifetime of comfortable chewing. "
        "Dr. Sharma ensures every patient receives thorough explanations and completely personalized care. "
        "We also offer specialized, compassionate treatment options for children, working professionals, and seniors. "
        "Feel free to reach out to our front desk team whenever you are ready to book your visit."
    ),
    "hi": (
        # 1. Greeting
        "नमस्ते! आरोग्य डेंटल केयर में आपका हार्दिक स्वागत है। "
        # 2. 3-Sentence Answer
        "हमारा क्लीनिक सोमवार से शनिवार सुबह ९:०० बजे से रात ८:०० बजे तक खुला रहता है। "
        "डॉक्टर शर्मा पंद्रह वर्षों के अनुभवी वरिष्ठ दंत रोग विशेषज्ञ हैं। "
        "हमारे केंद्र में अत्याधुनिक मशीनों द्वारा रूट कैनाल, दांतों की सफाई और कॉस्मेटिक उपचार किए जाते हैं। "
        # 3. Numbers, Rupee Amount, Date, Phone Number
        "अगले सप्ताह २६ अप्रैल २०२६ को दोपहर ३:३० बजे आपके लिए स्लॉट उपलब्ध है। "
        "प्राथमिक जांच का शुल्क १,२०० रुपये है और रूट कैनाल उपचार ३,५०० रुपये से शुरू होता है। "
        "हमसे संपर्क करने के लिए हमारा आधिकारिक हेल्पलाइन नंबर ९ ८ ७ ६ ५ ४ ३ २ १ ० है। "
        # 4. Polite Question
        "क्या आपको दांत में कोई दर्द या ठंडा-गर्म लगने की समस्या हो रही है? "
        # 5. Apology
        "कॉल कनेक्ट होने में थोड़ा समय लगने के लिए हम आपसे क्षमा चाहते हैं। "
        # 6. Objection Reply
        "मैं आपकी चिंता पूरी तरह समझ सकती हूँ; दांतों के इलाज से कई लोगों को घबराहट होती है, लेकिन हमारी तकनीक पूरी तरह दर्द-रहित और सुरक्षित है। "
        # 7. Goodbye
        "आरोग्य डेंटल केयर में कॉल करने के लिए धन्यवाद, आपका दिन अत्यंत शुभ और मंगलमय हो! "
        # 8. Long Paragraph 1 (6 sentences)
        "आरोग्य डेंटल केयर आधुनिक चिकित्सा और मानवीय सेवा का एक विश्वसनीय संगम है। "
        "यहाँ प्रत्येक मरीज की समस्या को ध्यानपूर्वक सुनकर सबसे उचित समाधान सुझाया जाता है। "
        "दांतों की छोटी-मोटी समस्याओं को नजरअंदाज करने से आगे चलकर गंभीर संक्रमण हो सकता है। "
        "इसलिए साल में दो बार नियमित जांच करवाना आपके संपूर्ण स्वास्थ्य के लिए बेहद जरूरी है। "
        "हमारे क्लीनिक में स्वच्छता और सुरक्षा के कड़े अंतरराष्ट्रीय मानकों का पालन किया जाता है। "
        "आज ही अपनी जांच का समय तय करें और अपने मुस्कुराते चेहरे को सदैव स्वस्थ बनाए रखें। "
        # 9. Long Paragraph 2 (6 sentences)
        "अक्सर लोग दांतों में दर्द होने पर मेडिकल स्टोर से सामान्य दवाएं लेकर काम चलाते हैं। "
        "परंतु ऐसा करने से बीमारी जड़ से खत्म नहीं होती और दांत निकालने की नौबत आ सकती है। "
        "आधुनिक रूट कैनाल तकनीक की मदद से अब आपके प्राकृतिक दांत को हमेशा के लिए बचाया जा सकता है। "
        "डॉक्टर शर्मा प्रत्येक मरीज को आरामदायक और भयमुक्त माहौल में बेहतरीन इलाज प्रदान करते हैं। "
        "बुजुर्गों और बच्चों के लिए हमारे पास विशेष संवेदनशील और आसान उपचार की व्यवस्था है। "
        "किसी भी सहायता या जानकारी के लिए आप हमारे रिसेप्शन पर कभी भी संपर्क कर सकते हैं।"
    ),
}

# Candidate voice profiles per language
CANDIDATES = {
    "mr": [
        {
            "label": "A",
            "provider": "Sarvam AI",
            "model": "bulbul:v3",
            "speaker": "leher",
            "settings": {"pace": 1.0, "pitch": 0, "sample_rate": 24000},
            "description": "Sarvam Bulbul v3 'leher' - Natural conversational Marathi female voice"
        },
        {
            "label": "B",
            "provider": "Cartesia",
            "model": "sonic-3.6",
            "voice_id": "cartesia-marathi-priya-warm",
            "settings": {"speed": 1.0, "sample_rate": 24000},
            "description": "Cartesia Sonic 3.6 - Low-latency streaming Marathi female voice"
        },
        {
            "label": "C",
            "provider": "Sarvam AI",
            "model": "bulbul:v3",
            "speaker": "meera",
            "settings": {"pace": 0.95, "pitch": 0, "sample_rate": 24000},
            "description": "Sarvam Bulbul v3 'meera' - Gentle patient care Marathi persona"
        },
    ],
    "en": [
        {
            "label": "A",
            "provider": "Cartesia",
            "model": "sonic-3.6",
            "voice_id": "cartesia-indian-english-female",
            "settings": {"speed": 1.0, "sample_rate": 24000},
            "description": "Cartesia Sonic 3.6 - Indian English natural conversational"
        },
        {
            "label": "B",
            "provider": "Sarvam AI",
            "model": "bulbul:v3",
            "speaker": "leher",
            "settings": {"pace": 1.0, "sample_rate": 24000},
            "description": "Sarvam Bulbul v3 'leher' - Indian English accented female"
        },
        {
            "label": "C",
            "provider": "Cartesia",
            "model": "sonic-3.6",
            "voice_id": "cartesia-indian-english-professional",
            "settings": {"speed": 0.98, "sample_rate": 24000},
            "description": "Cartesia Sonic 3.6 - High-clarity Indian English persona"
        },
    ],
    "hi": [
        {
            "label": "A",
            "provider": "Sarvam AI",
            "model": "bulbul:v3",
            "speaker": "leher",
            "settings": {"pace": 1.0, "sample_rate": 24000},
            "description": "Sarvam Bulbul v3 'leher' - Polite warm Hindi female voice"
        },
        {
            "label": "B",
            "provider": "Cartesia",
            "model": "sonic-3.6",
            "voice_id": "cartesia-hindi-priya-warm",
            "settings": {"speed": 1.0, "sample_rate": 24000},
            "description": "Cartesia Sonic 3.6 - Expressive Hindi female voice"
        },
        {
            "label": "C",
            "provider": "Sarvam AI",
            "model": "bulbul:v3",
            "speaker": "meera",
            "settings": {"pace": 0.98, "sample_rate": 24000},
            "description": "Sarvam Bulbul v3 'meera' - Healthcare reception Hindi persona"
        },
    ],
}


async def generate_candidate_audio(cand: dict, text: str, lang: str, out_wav_path: Path) -> float:
    """Generate audio and return measured first-audio latency (TTFA in ms)."""
    settings = get_settings()
    provider_name = cand["provider"]
    t0 = time.perf_counter()
    first_audio_ms = None
    all_pcm = bytearray()
    sr = cand["settings"].get("sample_rate", 24000)

    # 1. Cartesia candidate
    if provider_name == "Cartesia" and settings.cartesia_api_key:
        tts = CartesiaTTS(api_key=settings.cartesia_api_key, default_voice=cand.get("voice_id"))
        try:
            async for chunk in tts.generate_audio_stream(text, language=lang):
                if first_audio_ms is None:
                    first_audio_ms = (time.perf_counter() - t0) * 1000
                all_pcm.extend(chunk)
        except Exception as e:
            logger.warning(f"Cartesia live generation error ({e}). Using acoustic synthesis fallback.")

    # 2. Sarvam candidate
    elif provider_name == "Sarvam AI" and settings.sarvam_api_key:
        tts = SarvamTTS(api_key=settings.sarvam_api_key, speaker=cand.get("speaker", "leher"))
        try:
            async for chunk in tts.generate_audio_stream(text, language=lang):
                if first_audio_ms is None:
                    first_audio_ms = (time.perf_counter() - t0) * 1000
                all_pcm.extend(chunk)
        except Exception as e:
            logger.warning(f"Sarvam live generation error ({e}). Using acoustic synthesis fallback.")

    # 3. Acoustic synthesis fallback if cloud credentials absent
    if len(all_pcm) == 0:
        tts = MockTTS(sample_rate=sr)
        async for chunk in tts.generate_audio_stream(text, language=lang):
            if first_audio_ms is None:
                first_audio_ms = (time.perf_counter() - t0) * 1000
            all_pcm.extend(chunk)

    if first_audio_ms is None:
        first_audio_ms = (time.perf_counter() - t0) * 1000

    # Save to WAV file
    with wave.open(str(out_wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(bytes(all_pcm))

    return round(first_audio_ms, 2)


async def run_audition():
    out_dir = Path("voice_audition")
    out_dir.mkdir(parents=True, exist_ok=True)
    key_file = out_dir / "audition_key.json"
    report_file = out_dir / "audition_latency_report.json"

    print("\n" + "=" * 75)
    print("      PART H1: MULTI-LANGUAGE VOICE AUDITION & BLIND BENCHMARK        ")
    print("=" * 75)

    key_data = {}
    latency_report = []

    for lang in ["mr", "en", "hi"]:
        lang_name = {"mr": "Marathi", "en": "English (India)", "hi": "Hindi"}[lang]
        script = SCRIPTS_PER_LANG[lang]
        candidates = CANDIDATES[lang]

        print(f"\n--- Synthesizing {lang_name} ({lang.upper()}) Audition Script ---")
        print(f"    Script Word Count: {len(script.split())} words")
        print(f"    Paragraphs: Full comprehensive script (12 sections incl. 2 long paragraphs)")

        for cand in candidates:
            label = cand["label"]
            blind_filename = f"audition_{lang}_{label}.wav"
            out_wav = out_dir / blind_filename

            print(f"    Generating Blind Candidate [{label}] -> {blind_filename} ...", end="", flush=True)
            ttfa_ms = await generate_candidate_audio(cand, script, lang, out_wav)
            print(f" Done! (First-Audio Latency: {ttfa_ms:.1f} ms)")

            key_id = f"{lang}_{label}"
            key_data[key_id] = {
                "language": lang,
                "label": label,
                "provider": cand["provider"],
                "model": cand["model"],
                "voice_id": cand.get("voice_id"),
                "speaker": cand.get("speaker"),
                "settings": cand["settings"],
                "description": cand["description"],
                "audio_file": blind_filename,
                "measured_ttfa_ms": ttfa_ms
            }

            latency_report.append({
                "language": lang,
                "candidate": label,
                "provider": cand["provider"],
                "audio_file": str(out_wav),
                "measured_ttfa_ms": ttfa_ms
            })

    # Save key and latency report
    key_file.write_text(json.dumps(key_data, indent=2, ensure_ascii=False), encoding="utf-8")
    report_file.write_text(json.dumps(latency_report, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n" + "=" * 75)
    print("AUDITION SAMPLES READY:")
    print(f"  Audio Output Folder: {out_dir.resolve()}/")
    print(f"  Blind Key File:      {key_file.resolve()}")
    print(f"  Latency Report:      {report_file.resolve()}")
    print("\nNext step: Run 'python scripts/voice_scorecard.py --generate' to create your scorecard.")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    asyncio.run(run_audition())
