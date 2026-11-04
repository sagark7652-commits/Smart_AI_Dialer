"""Pre-generate Cartesia cloned voice zero-latency audio for all calling agent modes."""

import asyncio
from pathlib import Path
import sys
import wave

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.tts.factory import get_tts_provider

CACHE_DIR = Path("locales/cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

PRESET_GREETINGS = {
    "credit_card_offer": {
        "en": "Hello! This is Ananya from Apex Bank calling regarding your pre-approved lifetime free credit card offer. Do you have a quick minute?",
        "hi": "नमस्ते! मैं अपेक्स बैंक से अनन्या बात कर रही हूँ। आपके लिए हमारा लाइफटाइम फ्री क्रेडिट कार्ड अप्रूव हुआ है, क्या मैं 1 मिनट बात कर सकती हूँ?",
        "mr": "नमस्कार! मी अपेक्स बँकेतून अनन्या बोलत आहे. आपल्यासाठी आमचे लाइफटाइम फ्री क्रेडिट कार्ड मंजूर झाले आहे, मी 1 मिनिट बोलू शकते का?",
    },
    "bill_emi_reminder": {
        "en": "Hello! This is Aarti from EasyFinance calling with a courtesy reminder regarding your upcoming EMI. Do you have a moment to talk?",
        "hi": "नमस्ते! मैं EasyFinance से आरती बोल रही हूँ। यह आपकी आगामी ईएमआई के संदर्भ में एक शिष्टता कॉल है, क्या मैं 1 मिनट बात कर सकती हूँ?",
        "mr": "नमस्कार! मी इजीफायनान्स मधून आरती बोलत आहे. हा आपल्या आगामी ईएमआय संदर्भातील कॉल आहे, मी 1 मिनिट बोलू शकते का?",
    },
    "clinic_booking": {
        "en": "Hello and welcome to Aarogya Dental Care. This is Priya speaking, how may I assist you today?",
        "hi": "नमस्ते! आरोग्य डेंटल केयर में आपका स्वागत है। मैं प्रिया बात कर रही हूँ, मैं आपकी क्या सहायता कर सकती हूँ?",
        "mr": "नमस्कार! आरोग्य डेंटल केअर मध्ये आपले स्वागत आहे. मी प्रिया बोलतेय, मी आपली काय मदत करू शकते?",
    },
    "lead_qualification": {
        "en": "Hello! This is Kavita from TechSolutions reaching out regarding your enterprise inquiry. How can I assist you today?",
        "hi": "नमस्ते! मैं टेकसॉल्यूशंस से कविता बात कर रही हूँ। आपके क्लाउड प्लेटफॉर्म पूछताछ के संबंध में यह कॉल है, क्या मैं जानकारी दे सकती हूँ?",
        "mr": "नमस्कार! मी टेकसोल्युशन्स मधून कविता बोलत आहे. आपल्या चौकशी संदर्भात हा कॉल आहे, मी आपली काय मदत करू शकते?",
    },
    "support_faq": {
        "en": "Hello! Welcome to CareDesk Support. I am Pooja, how may I assist you today?",
        "hi": "नमस्ते! केयरडेस्क सपोर्ट में आपका स्वागत है। मैं पूजा हूँ, बताइए मैं आपकी क्या सहायता कर सकती हूँ?",
        "mr": "नमस्कार! केअरडेस्क सपोर्ट मध्ये आपले स्वागत आहे. मी पूजा बोलत आहे, बोला मी आपली काय मदत करू शकते?",
    },
    "feedback_survey": {
        "en": "Hello! This is Sneha calling for Customer Insights. I would appreciate thirty seconds of your feedback on our service today.",
        "hi": "नमस्ते! मैं स्नेहा बात कर रही हूँ। हमारी हालिया सर्विस के बारे में आपकी राय जानने के लिए यह छोटा कॉल है, क्या आप 30 सेकंड दे सकते हैं?",
        "mr": "नमस्कार! मी स्नेहा बोलत आहे. आमच्या सेवेबद्दल आपले मत जाणून घेण्यासाठी हा एक छोटा कॉल आहे, आपण 30 सेकंद वेळ देऊ शकता का?",
    },
    "announcement_ad": {
        "en": "Hello! This is Neha from Great Indian Sale bringing you exclusive festive offers and discounts today. Can I share the highlights?",
        "hi": "नमस्ते! मैं ग्रेट इंडियन सेल से नेहा बोल रही हूँ, आज आपके लिए खास फेस्टिव ऑफर्स और डिस्काउंट लेकर आई हूँ। क्या मैं मुख्य डील्स बता सकती हूँ?",
        "mr": "नमस्कार! मी ग्रेट इंडियन सेल मधून नेहा बोलत आहे, आज आपल्यासाठी खास फेस्टिव्ह ऑफर्स आणि डिस्काउंट घेऊन आले आहे. मी मुख्य ऑफर्स सांगू का?",
    },
}

async def generate_all():
    tts = get_tts_provider()
    sr = getattr(tts, "SAMPLE_RATE", 24000)
    print(f"Using TTS: {type(tts).__name__} at {sr}Hz")

    for preset, lang_dict in PRESET_GREETINGS.items():
        for lang, text in lang_dict.items():
            cache_file = CACHE_DIR / f"{lang}_cartesia_{preset}_greeting.wav"
            if cache_file.exists() and cache_file.stat().st_size > 1000:
                print(f"[EXISTS] {cache_file.name}")
                continue
            print(f"[GENERATING] {cache_file.name} -> '{text[:40]}...'")
            chunks = []
            try:
                async for chunk in tts.generate_audio_stream(text, language=lang):
                    chunks.append(chunk)
                if chunks:
                    all_pcm = b"".join(chunks)
                    with wave.open(str(cache_file), "wb") as wf:
                        wf.setnchannels(1)
                        wf.setsampwidth(2)
                        wf.setframerate(sr)
                        wf.writeframes(all_pcm)
                    print(f"  --> Saved {cache_file.name} ({len(all_pcm)} bytes)")
            except Exception as e:
                print(f"  [ERROR] {cache_file.name}: {e}")

if __name__ == "__main__":
    asyncio.run(generate_all())
