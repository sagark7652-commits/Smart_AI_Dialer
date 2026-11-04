"""Compare TTS providers on 10 benchmark sentences across EN, HI, MR, and Hinglish.

Generates WAV samples to tts_samples/ and produces an honest measurement report.
If API keys are not present in .env, clearly labels metrics as NOT MEASURED / MOCK.
"""

import asyncio
import os
from pathlib import Path
import sys
import time
import wave
from typing import Dict, List, Optional

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.config import get_settings
from agent.tts.mock_tts import MockTTS
from agent.tts.normalizer import TextNormalizer

BENCHMARK_LINES = [
    {
        "id": "LINE-01",
        "lang": "en",
        "text": "Hello, welcome to Aarogya Dental Care. How may I help you today?",
    },
    {
        "id": "LINE-02",
        "lang": "en",
        "text": "Doctor Sharma will be available for consultations tomorrow from 10 AM to 8 PM.",
    },
    {
        "id": "LINE-03",
        "lang": "en",
        "text": "The consultation fee is 500 rupees, and root canal treatment starts from 4500 rupees.",
    },
    {
        "id": "LINE-04",
        "lang": "hi",
        "text": "नमस्ते! आरोग्य डेंटल केयर में आपका स्वागत है। मैं आपकी क्या मदद कर सकती हूँ?",
    },
    {
        "id": "LINE-05",
        "lang": "hi",
        "text": "डॉक्टर शर्मा की कंसल्टेशन फीस पांच सौ रुपये है और क्लिनिक शाम आठ बजे तक खुला है।",
    },
    {
        "id": "LINE-06",
        "lang": "hi",
        "text": "अगर आपके दांत में बहुत तेज दर्द है, तो आप तुरंत क्लिनिक आ सकते हैं।",
    },
    {
        "id": "LINE-07",
        "lang": "mr",
        "text": "नमस्कार! आरोग्य डेंटल केअरमध्ये आपले स्वागत आहे. मी आपल्याला कशी मदत करू शकते?",
    },
    {
        "id": "LINE-08",
        "lang": "mr",
        "text": "डॉक्टरांची तपासणी फी पाचशे रुपये आहे आणि दवाखाना संध्याकाळी आठ वाजेपर्यंत सुरू असतो.",
    },
    {
        "id": "LINE-09",
        "lang": "mr",
        "text": "दातदुखी खूप जास्त असेल तर लगेच दवाखान्यात येऊन डॉक्टरांना दाखवा.",
    },
    {
        "id": "LINE-10",
        "lang": "hi",
        "text": "Aapka appointment kal dopahar do baje fix kar diya gaya hai, thank you!",
    },
]


def save_wav(filepath: Path, pcm_bytes: bytes, sample_rate: int = 24000) -> float:
    """Save raw 16-bit PCM bytes to WAV file and return duration in seconds."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(filepath), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return len(pcm_bytes) / (sample_rate * 2)


async def run_comparison() -> None:
    settings = get_settings()
    output_dir = Path("tts_samples")
    output_dir.mkdir(parents=True, exist_ok=True)

    has_cartesia = bool(settings.cartesia_api_key)
    has_sarvam = bool(settings.sarvam_api_key)

    print(f"TTS Providers Status: Cartesia={'PRESENT' if has_cartesia else 'ABSENT'}, Sarvam={'PRESENT' if has_sarvam else 'ABSENT'}")

    results: List[Dict] = []
    mock_tts = MockTTS(sample_rate=24000)

    # Process all benchmark lines
    for item in BENCHMARK_LINES:
        line_id = item["id"]
        lang = item["lang"]
        raw_text = item["text"]
        norm_text = TextNormalizer.normalize(raw_text, language=lang)

        # 1. Mock / Local baseline
        t0 = time.perf_counter()
        pcm_chunks = []
        async for chunk in mock_tts.generate_audio_stream(norm_text, language=lang):
            pcm_chunks.append(chunk)
        mock_pcm = b"".join(mock_chunks if 'mock_chunks' in locals() else pcm_chunks)
        duration = save_wav(output_dir / f"mock_{line_id}_{lang}.wav", mock_pcm, 24000)

        results.append({
            "line_id": line_id,
            "lang": lang,
            "text": raw_text,
            "normalized": norm_text,
            "provider": "MockTTS (Synthetic Baseline)",
            "file": f"tts_samples/mock_{line_id}_{lang}.wav",
            "sample_rate": 24000,
            "duration_s": round(duration, 2),
            "ttfb_ms": "NOT MEASURED (Mock generator)",
            "measured": False,
        })

        # 2. Cartesia (if key available)
        if has_cartesia:
            try:
                from agent.tts.cartesia_tts import CartesiaTTS
                c_tts = CartesiaTTS()
                t0 = time.perf_counter()
                first_chunk_time = None
                c_chunks = []
                async for chunk in c_tts.generate_audio_stream(norm_text, language=lang):
                    if first_chunk_time is None:
                        first_chunk_time = (time.perf_counter() - t0) * 1000
                    c_chunks.append(chunk)
                c_pcm = b"".join(c_chunks)
                c_dur = save_wav(output_dir / f"cartesia_{line_id}_{lang}.wav", c_pcm, 24000)
                results.append({
                    "line_id": line_id,
                    "lang": lang,
                    "text": raw_text,
                    "normalized": norm_text,
                    "provider": "Cartesia Sonic Multilingual",
                    "file": f"tts_samples/cartesia_{line_id}_{lang}.wav",
                    "sample_rate": 24000,
                    "duration_s": round(c_dur, 2),
                    "ttfb_ms": f"{round(first_chunk_time, 1)} ms",
                    "measured": True,
                })
            except Exception as e:
                print(f"Cartesia error on {line_id}: {e}")
        else:
            results.append({
                "line_id": line_id,
                "lang": lang,
                "text": raw_text,
                "normalized": norm_text,
                "provider": "Cartesia Sonic Multilingual",
                "file": "NOT GENERATED (CARTESIA_API_KEY absent)",
                "sample_rate": 24000,
                "duration_s": "NOT MEASURED",
                "ttfb_ms": "NOT MEASURED (No API Key)",
                "measured": False,
            })

        # 3. Sarvam (if key available)
        if has_sarvam:
            try:
                from agent.tts.sarvam_tts import SarvamTTS
                s_tts = SarvamTTS()
                t0 = time.perf_counter()
                first_chunk_time = None
                s_chunks = []
                async for chunk in s_tts.generate_audio_stream(norm_text, language=lang):
                    if first_chunk_time is None:
                        first_chunk_time = (time.perf_counter() - t0) * 1000
                    s_chunks.append(chunk)
                s_pcm = b"".join(s_chunks)
                s_dur = save_wav(output_dir / f"sarvam_{line_id}_{lang}.wav", s_pcm, 8000)
                results.append({
                    "line_id": line_id,
                    "lang": lang,
                    "text": raw_text,
                    "normalized": norm_text,
                    "provider": "Sarvam Bulbul (Indic)",
                    "file": f"tts_samples/sarvam_{line_id}_{lang}.wav",
                    "sample_rate": 8000,
                    "duration_s": round(s_dur, 2),
                    "ttfb_ms": f"{round(first_chunk_time, 1)} ms",
                    "measured": True,
                })
            except Exception as e:
                print(f"Sarvam error on {line_id}: {e}")
        else:
            results.append({
                "line_id": line_id,
                "lang": lang,
                "text": raw_text,
                "normalized": norm_text,
                "provider": "Sarvam Bulbul (Indic)",
                "file": "NOT GENERATED (SARVAM_API_KEY absent)",
                "sample_rate": 8000,
                "duration_s": "NOT MEASURED",
                "ttfb_ms": "NOT MEASURED (No API Key)",
                "measured": False,
            })

    # Generate Markdown Report
    report_path = output_dir / "tts_comparison_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# TTS Provider Comparison & Audio Quality Report\n\n")
        f.write("Generated per Part C evaluation requirements.\n\n")
        f.write("## 1. Provider Status\n")
        f.write(f"- **Cartesia Sonic**: `{'CONFIGURED (API Key Present)' if has_cartesia else 'NOT CONFIGURED (CARTESIA_API_KEY absent in .env)'}`\n")
        f.write(f"- **Sarvam Bulbul**: `{'CONFIGURED (API Key Present)' if has_sarvam else 'NOT CONFIGURED (SARVAM_API_KEY absent in .env)'}`\n")
        f.write("- **MockTTS (Local Audio Baseline)**: `ACTIVE (16-bit Linear PCM, 24,000 Hz)`\n\n")

        f.write("## 2. Benchmark Lines Evaluation (10 Sentences)\n\n")
        f.write("| Line ID | Lang | Provider | Sample Rate | Duration | TTFB Latency | Status |\n")
        f.write("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n")
        for r in results:
            stat = "MEASURED" if r["measured"] else "NOT MEASURED / MOCK"
            f.write(f"| {r['line_id']} | {r['lang']} | {r['provider']} | {r['sample_rate']} Hz | {r['duration_s']} | {r['ttfb_ms']} | {stat} |\n")

        f.write("\n## 3. Telephony Direct $\\mu$-law 8000Hz vs Resampling\n\n")
        f.write("### Implementation Notes:\n")
        f.write("- **Twilio Media Streams**: Requires 8,000 Hz, 8-bit G.711 $\\mu$-law audio chunked in 20ms frames (160 samples = 160 bytes Base64-encoded).\n")
        f.write("- **Direct 8kHz $\\mu$-law Request**: In Cartesia, audio can be requested directly in `mulaw_8000` encoding. When requested directly, it avoids client-side high-to-low downsampling and ITU-T quantization CPU overhead entirely.\n")
        f.write("- **Exotel Media Streams**: Uses 16-bit Linear PCM (`slin`) at 8,000 Hz, 320 bytes per 20ms frame.\n")
        f.write("- **Audio Subsystem Verification**: The engine uses bit-exact standard ITU-T G.711 conversion lookup tables (`_LIN2U_TABLE`, `_U2LIN_TABLE`) and polyphase rational resampling (`scipy.signal.resample_poly`), preventing integer-ratio distortion.\n\n")

        f.write("## 4. Honest Phone Quality Ceiling (PSTN Codec Limitations)\n\n")
        f.write("Regardless of how high-fidelity the TTS model is (e.g. 24kHz or 44.1kHz studio grade), real telephone calls over PSTN/cellular carriers have hard acoustic boundaries:\n")
        f.write("1. **Bandpass Filter (300 Hz – 3,400 Hz)**: Traditional PSTN networks apply a strict analog bandpass filter. Frequencies below 300 Hz (deep chest resonance) and above 3,400 Hz (vocal air, sibilance, consonant clarity) are completely eliminated.\n")
        f.write("2. **Nyquist Frequency (4,000 Hz)**: Because PSTN samples at 8,000 Hz, the theoretical Nyquist ceiling is 4,000 Hz. High-frequency micro-details of human speech (such as fricatives 's', 'sh', 'f' which typically sit between 4,500 Hz and 8,000 Hz) cannot physically travel over a standard phone call.\n")
        f.write("3. **Dynamic Range Compression (G.711 8-bit Logarithmic)**: $\\mu$-law uses logarithmic non-linear companding to fit audio into 64 kbps (8 bits per sample). Whispers and gentle volume modulations are flattened.\n")
        f.write("4. **Takeaway**: Spending excess compute or bandwidth on >24kHz audio or complex neural upsamplers does not translate to caller ears over phone lines. Conversational pacing, natural Indic word choice, short 1-2 sentence phrasing, and sub-1.5s latency have a far higher impact on perceived quality than studio acoustic bitrate.\n")

    print(f"Comparison report written to: {report_path}")


if __name__ == "__main__":
    asyncio.run(run_comparison())
