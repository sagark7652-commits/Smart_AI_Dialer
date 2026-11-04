"""PSTN Telephony Audio Quality Ceiling Diagnostic & Comparison.

Generates before/after listening samples comparing:
1. 24kHz Wideband Audio (WebRTC / WebAudio / VoLTE HD)
2. 8kHz ITU-T G.711 Mu-Law PSTN Phone Audio (Standard Landline / Cellular PSTN)

Applies ITU-T standard 300Hz - 3400Hz telephone bandpass filter and 8-bit non-linear
logarithmic companding to accurately demonstrate the physical phone-line quality ceiling.
"""

from pathlib import Path
import sys
import wave
import numpy as np
from scipy import signal

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.telephony.audio_helpers import AudioCodec


def generate_reference_speech_pcm(sample_rate: int = 24000, duration_sec: float = 3.5) -> np.ndarray:
    """Generate high-harmonic synthetic vocal formants resembling spoken voice."""
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), False)
    
    # Formant synthesis (Vocal cords fundamental + throat/mouth resonant formants F1, F2, F3)
    f0 = 210  # Female pitch
    voice = (
        0.50 * np.sin(2 * np.pi * f0 * t) +
        0.30 * np.sin(2 * np.pi * (f0 * 2) * t) +
        0.20 * np.sin(2 * np.pi * 800 * t) +    # F1 formant (vowel 'aa')
        0.15 * np.sin(2 * np.pi * 1800 * t) +   # F2 formant
        0.10 * np.sin(2 * np.pi * 2800 * t) +   # F3 formant
        0.08 * np.sin(2 * np.pi * 5500 * t)     # High-frequency clarity / sibilance (>4kHz)
    )
    
    # Syllabic cadence envelope
    syllable_rate = 4.5  # 4.5 syllables per sec
    env = 0.5 * (1 + np.sin(2 * np.pi * syllable_rate * t))
    env = np.clip(env, 0.1, 1.0)
    
    audio = voice * env * 22000
    return audio.astype(np.int16)


def simulate_pstn_telephone_network(pcm24k: np.ndarray, in_rate: int = 24000) -> np.ndarray:
    """Simulate complete PSTN telephone network: 8kHz downsampling, 300-3400Hz bandpass, G.711 Mu-law."""
    # 1. Downsample to 8000 Hz
    pcm24k_bytes = pcm24k.tobytes()
    pcm8k_bytes = AudioCodec.resample_pcm(pcm24k_bytes, in_rate, 8000)
    samples_8k = np.frombuffer(pcm8k_bytes, dtype=np.int16).astype(np.float32)

    # 2. Apply ITU-T G.151 Telephone Carrier Bandpass Filter (300 Hz - 3400 Hz)
    sos = signal.butter(4, [300, 3400], btype="bandpass", fs=8000, output="sos")
    filtered = signal.sosfilt(sos, samples_8k).astype(np.int16)

    # 3. ITU-T G.711 8-bit Mu-Law Compression & Decompression
    ulaw_bytes = AudioCodec.linear2ulaw(filtered.tobytes())
    decompressed_bytes = AudioCodec.ulaw2linear(ulaw_bytes)

    return np.frombuffer(decompressed_bytes, dtype=np.int16)


def main():
    print("=" * 70)
    print("      PSTN TELEPHONE QUALITY CEILING: 24kHz vs 8kHz COMPARISON")
    print("=" * 70)

    out_dir = Path("voice_audition")
    out_dir.mkdir(parents=True, exist_ok=True)

    wideband_file = out_dir / "phone_sample_24k_wideband.wav"
    narrowband_file = out_dir / "phone_sample_8k_mulaw_pstn.wav"

    # 1. Generate 24kHz Wideband Reference
    pcm_24k = generate_reference_speech_pcm(sample_rate=24000, duration_sec=3.5)
    with wave.open(str(wideband_file), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(pcm_24k.tobytes())

    # 2. Simulate 8kHz G.711 Mu-Law PSTN Phone Audio
    pcm_8k_pstn = simulate_pstn_telephone_network(pcm_24k, in_rate=24000)
    with wave.open(str(narrowband_file), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(8000)
        wf.writeframes(pcm_8k_pstn.tobytes())

    print(f"\n[+] Generated Wideband 24kHz Audio : {wideband_file.resolve()}")
    print(f"    Frequency Bandwidth: 20 Hz - 12,000 Hz (Full human hearing spectrum)")
    print(f"\n[+] Generated PSTN 8kHz Phone Audio: {narrowband_file.resolve()}")
    print(f"    Frequency Bandwidth: 300 Hz - 3,400 Hz (ITU-T G.711 Standard)")
    print("\n" + "-" * 70)
    print("HONEST TELEPHONE LINE QUALITY CEILING ANALYSIS:")
    print("1. Bandwidth Brickwall (3.4 kHz limit):")
    print("   Standard PSTN cellular & landline carriers strictly filter out all frequencies")
    print("   above 3400 Hz. High-frequency consonants ('s', 'sh', 'f', 'th') lose air and clarity,")
    print("   giving any neural voice that characteristic 'talking through a telephone' acoustic.")
    print("2. 8-Bit Dynamic Range:")
    print("   G.711 Mu-law uses 8-bit companding (~12-bit effective dynamic range), which adds")
    print("   a subtle background quantization hiss on soft syllables.")
    print("3. Native Mulaw Optimization:")
    print("   Requesting native 8kHz mu-law directly from TTS eliminates double-resampling artifacts,")
    print("   ensuring maximum possible clarity within the hard 3.4kHz PSTN physical limit.")
    print("=" * 70)


if __name__ == "__main__":
    main()
