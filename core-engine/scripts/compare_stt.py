"""Compare STT Providers (Deepgram vs Sarvam) on a recorded WAV file.

Measures:
- Transcription accuracy (Word Error Rate - WER) against reference text
- API processing latency
- Side-by-side transcript comparison

Usage:
  python scripts/compare_stt.py <audio.wav> [--ref "reference text" | --ref-file ref.txt] [--lang hi]
"""

import argparse
import asyncio
from pathlib import Path
import re
import sys
import time
from typing import List, Tuple

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.config import get_settings
from agent.stt.deepgram_stt import DeepgramSTT
from agent.stt.sarvam_stt import SarvamSTT

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def calculate_wer(reference: str, hypothesis: str) -> float:
    """Calculate Word Error Rate (WER) between reference and hypothesis text."""
    ref_words = re.findall(r"\w+", reference.lower())
    hyp_words = re.findall(r"\w+", hypothesis.lower())

    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    if not hyp_words:
        return 1.0

    # Dynamic programming Levenshtein distance
    r_len = len(ref_words)
    h_len = len(hyp_words)
    dp = [[0] * (h_len + 1) for _ in range(r_len + 1)]

    for i in range(r_len + 1):
        dp[i][0] = i
    for j in range(h_len + 1):
        dp[0][j] = j

    for i in range(1, r_len + 1):
        for j in range(1, h_len + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])

    return dp[r_len][h_len] / float(r_len)


async def transcribe_deepgram(wav_bytes: bytes, lang: str) -> Tuple[str, float]:
    """Transcribe audio bytes using Deepgram REST API."""
    import httpx
    settings = get_settings()
    if not settings.deepgram_api_key:
        return "[Error: DEEPGRAM_API_KEY missing]", 0.0

    url = "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true"
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": "audio/wav",
    }
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, content=wav_bytes)
            latency = (time.perf_counter() - start) * 1000.0
            if resp.status_code == 200:
                data = resp.json()
                t = data["results"]["channels"][0]["alternatives"][0]["transcript"]
                return t.strip(), latency
            return f"[Error {resp.status_code}: {resp.text}]", latency
    except Exception as e:
        return f"[Exception: {e}]", 0.0


async def transcribe_sarvam(wav_bytes: bytes, lang: str) -> Tuple[str, float]:
    """Transcribe audio bytes using Sarvam STT."""
    stt = SarvamSTT()
    start = time.perf_counter()
    try:
        t = await stt.transcribe_wav_bytes(wav_bytes, language=lang)
        latency = (time.perf_counter() - start) * 1000.0
        return t, latency
    except Exception as e:
        return f"[Error/Exception: {e}]", 0.0


async def main():
    parser = argparse.ArgumentParser(description="STT Provider Benchmark & Comparison")
    parser.add_argument("wav_file", help="Path to input .wav audio file")
    parser.add_argument("--ref", help="Reference ground-truth text string")
    parser.add_argument("--ref-file", help="Path to reference text file")
    parser.add_argument("--lang", default="hi", choices=["hi", "en", "mr"], help="Audio spoken language")
    args = parser.parse_args()

    wav_path = Path(args.wav_file)
    if not wav_path.is_file():
        print(f"[!] WAV file not found: {args.wav_file}")
        sys.exit(1)

    wav_bytes = wav_path.read_bytes()

    ref_text = ""
    if args.ref:
        ref_text = args.ref.strip()
    elif args.ref_file and Path(args.ref_file).is_file():
        ref_text = Path(args.ref_file).read_text(encoding="utf-8").strip()

    print("\n" + "=" * 75)
    print("                 STT PROVIDER COMPARISON & ACCURACY BENCHMARK             ")
    print("=" * 75)
    print(f"Input Audio File : {wav_path.name} ({len(wav_bytes)/1024:.1f} KB)")
    print(f"Language         : {args.lang.upper()}")
    if ref_text:
        print(f"Reference Text   : \"{ref_text}\"")
    print("-" * 75)

    print("[*] Querying Deepgram (Nova-3)...")
    dg_text, dg_lat = await transcribe_deepgram(wav_bytes, args.lang)

    print("[*] Querying Sarvam (Saaras:v2)...")
    sarvam_text, sarvam_lat = await transcribe_sarvam(wav_bytes, args.lang)

    print("\n" + "=" * 75)
    print("                                RESULTS                                  ")
    print("=" * 75)
    print(f"[1] DEEPGRAM NOVA-3")
    print(f"    Transcript : {dg_text}")
    print(f"    Latency    : {dg_lat:.1f} ms")
    if ref_text and not dg_text.startswith("["):
        wer = calculate_wer(ref_text, dg_text)
        print(f"    WER        : {wer*100:.1f}%")

    print(f"\n[2] SARVAM SAARAS:V2")
    print(f"    Transcript : {sarvam_text}")
    print(f"    Latency    : {sarvam_lat:.1f} ms")
    if ref_text and not sarvam_text.startswith("["):
        wer = calculate_wer(ref_text, sarvam_text)
        print(f"    WER        : {wer*100:.1f}%")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
