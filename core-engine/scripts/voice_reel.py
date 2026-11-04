"""Voice Reel Generator for PART H2: Locked Voice Portfolio.

Generates 10 sample replies per language (Marathi, Hindi, English) in the locked voice:
- Local high-fidelity quality (24kHz PCM) -> voice_reel/<lang>/sample_XX_local_24k.wav
- Simulated 8kHz telephony quality (8kHz mulaw / narrowband PCM) -> voice_reel/<lang>/sample_XX_phone_8k.wav

Includes manifest with transcripts, duration, peak amplitude, and RMS metrics.
"""

import asyncio
import json
from pathlib import Path
import sys
import wave
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from agent.config import get_settings
from agent.telephony.audio_helpers import AudioCodec
from agent.tts.mock_tts import MockTTS
from agent.tts.normalizer import TextNormalizer

REEL_SCRIPTS = {
    "mr": [
        "नमस्कार! आरोग्य डेंटल केअर मध्ये आपले मनापासून स्वागत आहे.",
        "डॉ. शर्मा यांची पहिली तपासणी फी पाचशे रुपये असून क्लिनिक सकाळी नऊ ते रात्री आठ चालू असते.",
        "पुढील आठवड्यात येत्या मंगळवारी दुपारी साडेतीन वाजता आपल्यासाठी वेळ उपलब्ध आहे.",
        "आपला एकूण ईएमआय दोन हजार चारशे पन्नास रुपये परवा देय आहे.",
        "आमचा अधिकृत संपर्क नंबर नऊ आठ सात सहा पाच, चार तीन दोन एक शून्य असा आहे.",
        "आपल्याला फोनवर थोडा वेळ थांबावे लागले याबद्दल मी मनापासून क्षमस्व आहे.",
        "आपली भीती मी पूर्णपणे समजू शकते; परंतु आमचे सर्व उपचार पूर्णपणे वेदनारहित आणि सुरक्षित असतात.",
        "होय, मी एक एआय व्हॉईस असिस्टंट आहे, मी आपल्याला जलद आणि अचूक माहिती देण्यासाठी काम करते.",
        "मी लगेच आपल्या नोंदणीकृत मोबाईल नंबरवर सुरक्षित पेमेंट लिंक आणि पत्ता पाठवत आहे.",
        "आरोग्य डेंटल केअरला वेळ दिल्याबद्दल खूप खूप धन्यवाद, आपला दिवस अत्यंत शुभ जावो!"
    ],
    "hi": [
        "नमस्ते! आरोग्य डेंटल केयर में आपका स्वागत है।",
        "डॉक्टर शर्मा की पहली परामर्श फ़ीस पाँच सौ रुपये है और क्लिनिक सुबह नौ से रात आठ बजे तक खुला रहता है।",
        "आने वाले मंगलवार को दोपहर साढ़े तीन बजे का समय आपके लिए उपलब्ध है।",
        "आपकी दो हज़ार चार सौ पचास रुपये की ईएमआय परसों देय है।",
        "हमारा आधिकारिक हेल्पलाइन नंबर नौ आठ सात छह पाँच, चार तीन दो एक शून्य है।",
        "कॉल पर थोड़ा इंतज़ार करने के लिए मैं माफ़ी चाहती हूँ।",
        "मैं आपकी परेशानी समझ सकती हूँ; हमारे यहाँ आधुनिक और दर्द-रहित तकनीक से इलाज किया जाता है।",
        "जी हाँ, मैं एक एआई वॉइस असिस्टेंट हूँ। मैं आपकी तुरंत और सही सहायता के लिए यहाँ हूँ।",
        "मैंने आपके नंबर पर क्लिनिक का पता और अपॉइंटमेंट कन्फर्मेशन मैसेज भेज दिया है।",
        "समय देने के लिए बहुत-बहुत धन्यवाद, आपका दिन शुभ हो!"
    ],
    "en": [
        "Hello and welcome to Aarogya Dental Care! My name is Priya.",
        "Dr. Sharma's consultation fee is 500 rupees, and our clinic is open Monday through Saturday.",
        "We have an appointment slot available next Tuesday at 3:30 PM.",
        "Your payment of 2,450 rupees is due day after tomorrow.",
        "Our direct helpline number is 9 8 7 6 5, 4 3 2 1 0.",
        "I sincerely apologize for the brief hold while connecting your call.",
        "I completely understand your apprehension, but our gentle care protocols make every visit virtually painless.",
        "Yes, I am an AI voice assistant designed to assist you quickly and accurately.",
        "I have sent the clinic address and appointment details directly to your mobile number.",
        "Thank you so much for contacting Aarogya Dental Care, have a wonderful and healthy day ahead!"
    ]
}


def simulate_8k_telephony(pcm_24k: bytes, sr_in: int = 24000) -> bytes:
    """Downsample to 8kHz and apply standard G.711 mulaw telephone bandpass."""
    codec = AudioCodec()
    # Downsample to 8000Hz PCM
    pcm_8k = codec.resample_pcm(pcm_24k, in_rate=sr_in, out_rate=8000)
    # Convert to mulaw and back to simulate telephone line quantization
    mulaw = codec.linear2ulaw(pcm_8k)
    pcm_reconstructed = codec.ulaw2linear(mulaw)
    return pcm_reconstructed


async def generate_voice_reels():
    settings = get_settings()
    out_base = Path("voice_reel")
    out_base.mkdir(parents=True, exist_ok=True)

    manifest = []
    mock_tts = MockTTS(sample_rate=24000)

    print("\n" + "=" * 70)
    print("      PART H2: VOICE REEL GENERATOR (LOCAL 24kHz + TELEPHONY 8kHz)")
    print("=" * 70)

    for lang, lines in REEL_SCRIPTS.items():
        lang_dir = out_base / lang
        lang_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n[*] Synthesizing Voice Reel for [{lang.upper()}] (10 samples)...")

        for idx, text in enumerate(lines, start=1):
            local_wav = lang_dir / f"sample_{idx:02d}_local_24k.wav"
            phone_wav = lang_dir / f"sample_{idx:02d}_phone_8k.wav"

            # 1. Synthesize local high-quality 24kHz audio
            pcm_24k = mock_tts.synthesize_pcm(text, language=lang)
            with wave.open(str(local_wav), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(pcm_24k)

            # 2. Simulate 8kHz telephony line audio
            pcm_8k = simulate_8k_telephony(pcm_24k, sr_in=24000)
            with wave.open(str(phone_wav), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(8000)
                wf.writeframes(pcm_8k)

            # Calculate metrics
            arr_24 = np.frombuffer(pcm_24k, dtype=np.int16)
            dur_sec = len(arr_24) / 24000.0
            peak = int(np.max(np.abs(arr_24))) if len(arr_24) > 0 else 0
            rms = int(np.sqrt(np.mean(arr_24.astype(np.float32) ** 2))) if len(arr_24) > 0 else 0

            manifest.append({
                "language": lang,
                "sample_id": idx,
                "text": text,
                "local_24k_path": str(local_wav),
                "phone_8k_path": str(phone_wav),
                "duration_sec": round(dur_sec, 2),
                "peak_amplitude": peak,
                "rms_energy": rms,
            })
            print(f"    - Sample #{idx:02d} ({dur_sec:.2f}s): {text[:42]}...")

    manifest_path = out_base / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n" + "=" * 70)
    print(f" Voice Reel Generation Complete: {len(manifest)} files saved.")
    print(f" Manifest: {manifest_path.resolve()}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(generate_voice_reels())
