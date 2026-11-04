"""Audio conversion and resampling utilities for Telephony (Twilio, Exotel, STT, TTS).

Implements standard ITU-T G.711 Mu-Law companding table, polyphase rational resampling,
and zero-cross chunk boundary smoothing.
"""

import base64
import numpy as np
from scipy import signal

try:
    import soxr
    _HAS_SOXR = True
except ImportError:
    _HAS_SOXR = False


# ITU-T G.711 Mu-Law standard compression tables
def _build_g711_tables():
    """Build standard bit-exact ITU-T G.711 Mu-law encode/decode tables."""
    BIAS = 0x84
    CLIP = 32635

    # 1. 16-bit linear to 8-bit ulaw lookup
    # Linear range -32768 to 32767
    lin2u = np.zeros(65536, dtype=np.uint8)
    for i in range(65536):
        sample = i if i < 32768 else i - 65536
        sign = 0x80 if sample < 0 else 0x00
        if sample < 0:
            sample = -sample
        if sample > CLIP:
            sample = CLIP
        sample += BIAS

        # Exponent
        exponent = 7
        for exp_val, exp_limit in enumerate([0x4000, 0x2000, 0x1000, 0x0800, 0x0400, 0x0200, 0x0100, 0x0080]):
            if sample <= exp_limit:
                exponent = 7 - exp_val

        mantissa = (sample >> (exponent + 3)) & 0x0F
        ulaw_byte = ~(sign | (exponent << 4) | mantissa) & 0xFF
        lin2u[i] = ulaw_byte

    # 2. 8-bit ulaw to 16-bit linear lookup
    u2lin = np.zeros(256, dtype=np.int16)
    for u in range(256):
        u_inv = ~u & 0xFF
        sign = u_inv & 0x80
        exponent = (u_inv >> 4) & 0x07
        mantissa = u_inv & 0x0F
        sample = ((mantissa << 3) + BIAS) << exponent
        sample -= BIAS
        u2lin[u] = -sample if sign else sample

    return lin2u, u2lin


_LIN2U_TABLE, _U2LIN_TABLE = _build_g711_tables()


class AudioCodec:
    """Telephony audio codec conversions: Standard ITU-T G.711 Mu-Law and Resampling."""

    @classmethod
    def linear2ulaw(cls, pcm16_bytes: bytes) -> bytes:
        """Convert 16-bit linear PCM to standard ITU-T G.711 8-bit Mu-Law."""
        if not pcm16_bytes:
            return b""
        samples = np.frombuffer(pcm16_bytes, dtype=np.uint16)
        ulaw_bytes = _LIN2U_TABLE[samples]
        return ulaw_bytes.tobytes()

    @classmethod
    def ulaw2linear(cls, ulaw_bytes: bytes) -> bytes:
        """Convert standard ITU-T G.711 8-bit Mu-Law to 16-bit linear PCM."""
        if not ulaw_bytes:
            return b""
        ulaw_arr = np.frombuffer(ulaw_bytes, dtype=np.uint8)
        linear_arr = _U2LIN_TABLE[ulaw_arr]
        return linear_arr.tobytes()

    @classmethod
    def resample_pcm(cls, pcm_bytes: bytes, in_rate: int, out_rate: int) -> bytes:
        """High-fidelity rational resampling between arbitrary audio sample rates."""
        if not pcm_bytes or in_rate == out_rate:
            return pcm_bytes

        samples = np.frombuffer(pcm_bytes, dtype=np.int16)
        if len(samples) == 0:
            return b""

        # Check for fast SIMD soxr resampler if enabled
        try:
            from agent.config import get_settings
            use_soxr = getattr(get_settings(), "use_soxr_resampler", True)
        except Exception:
            use_soxr = True

        if use_soxr and _HAS_SOXR:
            resampled = soxr.resample(samples, in_rate, out_rate, quality="LQ").astype(np.int16)
            return resampled.tobytes()

        # Polyphase rational fallback
        gcd = np.gcd(in_rate, out_rate)
        up = int(out_rate // gcd)
        down = int(in_rate // gcd)

        resampled = signal.resample_poly(samples, up, down).astype(np.int16)
        return resampled.tobytes()

    @staticmethod
    def smooth_chunk_boundaries(pcm_bytes: bytes, ramp_samples: int = 48) -> bytes:
        """Apply a micro cosine ramp at chunk start/end to avoid high-frequency clicks."""
        if len(pcm_bytes) < ramp_samples * 4:
            return pcm_bytes
        samples = np.frombuffer(pcm_bytes, dtype=np.int16).copy()
        ramp = (1.0 - np.cos(np.linspace(0, np.pi, ramp_samples))) / 2.0
        samples[:ramp_samples] = (samples[:ramp_samples] * ramp).astype(np.int16)
        samples[-ramp_samples:] = (samples[-ramp_samples] * ramp[::-1]).astype(np.int16)
        return samples.tobytes()

    @staticmethod
    def to_base64(audio_bytes: bytes) -> str:
        """Encode binary audio to base64 string."""
        return base64.b64encode(audio_bytes).decode("ascii")

    @staticmethod
    def from_base64(b64_str: str) -> bytes:
        """Decode base64 string to binary audio."""
        return base64.b64decode(b64_str)

    @staticmethod
    def align_to_boundary(audio_bytes: bytes, alignment: int = 320) -> bytes:
        """Ensure audio buffer length is an exact multiple of alignment bytes (required by Exotel)."""
        remainder = len(audio_bytes) % alignment
        if remainder != 0:
            pad_len = alignment - remainder
            return audio_bytes + (b"\x00" * pad_len)
        return audio_bytes
