"""Phone audio degradation simulator (G.711 telephony codec and 8kHz downsampling)."""

import numpy as np
from scipy import signal


class PhoneAudioSimulator:
    """Simulates realistic telephone network audio quality:

    1. Downsamples 16kHz wideband audio to 8kHz narrowband.
    2. Applies G.711 Mu-Law 8-bit dynamic compression/expansion.
    3. Resamples back to 16kHz for test verification.
    """

    MU = 255.0

    @classmethod
    def linear2ulaw(cls, samples: np.ndarray) -> np.ndarray:
        """Encode 16-bit linear PCM to 8-bit G.711 mu-law."""
        # Normalize to [-1.0, 1.0]
        s = samples.astype(np.float32) / 32768.0
        # Compress
        s_comp = np.sign(s) * np.log1p(cls.MU * np.abs(s)) / np.log1p(cls.MU)
        # Quantize to 8-bit [-128, 127]
        quantized = np.clip(np.round(s_comp * 128.0), -128, 127).astype(np.int8)
        return quantized

    @classmethod
    def ulaw2linear(cls, ulaw_samples: np.ndarray) -> np.ndarray:
        """Decode 8-bit G.711 mu-law back to 16-bit linear PCM."""
        s_comp = ulaw_samples.astype(np.float32) / 128.0
        # Expand
        s = np.sign(s_comp) * (1.0 / cls.MU) * (np.power(1.0 + cls.MU, np.abs(s_comp)) - 1.0)
        # Scale back to int16
        linear = np.clip(np.round(s * 32768.0), -32768, 32767).astype(np.int16)
        return linear

    @classmethod
    def simulate_telephony(cls, pcm16_bytes: bytes) -> bytes:
        """Downsample 16kHz PCM to 8kHz, apply G.711 mu-law companding, and upsample back."""
        if not pcm16_bytes:
            return b""

        samples_16k = np.frombuffer(pcm16_bytes, dtype=np.int16)
        if len(samples_16k) == 0:
            return b""

        # 1. Downsample 16kHz -> 8kHz (factor of 2: up=1, down=2)
        samples_8k = signal.resample_poly(samples_16k, 1, 2).astype(np.int16)

        # 2. Telephony G.711 mu-law compression & decompression
        ulaw = cls.linear2ulaw(samples_8k)
        decompressed_8k = cls.ulaw2linear(ulaw)

        # 3. Upsample 8kHz -> 16kHz (factor of 2: up=2, down=1)
        simulated_16k = signal.resample_poly(decompressed_8k, 2, 1).astype(np.int16)

        return simulated_16k.tobytes()
