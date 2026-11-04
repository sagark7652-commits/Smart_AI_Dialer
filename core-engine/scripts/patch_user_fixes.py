import re

# 1. Patch agent/tts/cartesia_tts.py
# Add persistent WebSocket and restore locale="en-IN"
cartesia_code = '''"""Cartesia streaming TTS implementation with natural emotion and Indian English locale."""

import asyncio
from typing import AsyncIterator, Optional, Union
from cartesia import AsyncCartesia
from agent.config import get_settings
from agent.tts.base import BaseTTS
from agent.tts.normalizer import TextNormalizer
from agent.logger import setup_logger

logger = setup_logger("tts.cartesia")


class CartesiaTTS(BaseTTS):
    """Low-latency streaming Text-To-Speech using Cartesia Sonic Multilingual / 3.6."""

    DEFAULT_VOICE_ID = "a1e4199c-8c88-4608-8491-33da880e63b8"
    DEFAULT_MODEL_ID = "sonic-3.6"
    SAMPLE_RATE = 24000

    def __init__(
        self,
        api_key: Optional[str] = None,
        voice_id: Optional[str] = None,
        model_id: Optional[str] = None,
        sample_rate: int = 24000,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.cartesia_api_key
        self.voice_id = voice_id or settings.cartesia_voice_id or self.DEFAULT_VOICE_ID
        self.model_id = model_id or getattr(settings, "cartesia_model_id", self.DEFAULT_MODEL_ID)
        self.sample_rate = sample_rate
        self._ws = None
        self._ws_lock = asyncio.Lock()

        if not self.api_key:
            logger.warning(
                "CARTESIA_API_KEY is not set. CartesiaTTS will fail if called without an active key."
            )
            self.client: Optional[AsyncCartesia] = None
        else:
            self.client = AsyncCartesia(api_key=self.api_key)

    async def _get_ws(self):
        """Get or initialize persistent WebSocket connection for ultra-low latency (<120ms)."""
        async with self._ws_lock:
            if self._ws is None and self.client:
                self._ws = await self.client.tts.websocket()
            return self._ws

    async def generate_audio_stream(
        self,
        text_or_stream: Union[AsyncIterator[str], str],
        language: Optional[str] = "en",
    ) -> AsyncIterator[bytes]:
        """Synthesize normalized text into streaming 16-bit PCM audio chunks."""
        if not self.client:
            raise ValueError(
                "CARTESIA_API_KEY is missing. Please set it in your .env file or environment."
            )

        if hasattr(text_or_stream, "__aiter__"):
            collected = []
            async for token in text_or_stream:
                collected.append(token)
            raw_text = "".join(collected)
        else:
            raw_text = str(text_or_stream)

        normalized_text = TextNormalizer.normalize(raw_text, language=language)
        if not normalized_text.strip():
            return

        lang_code = (language or "en").lower()

        # 1. Real-time Cartesia WebSocket streaming with en-IN accent
        try:
            ws = await self._get_ws()
            send_kwargs = {
                "model_id": self.model_id,
                "transcript": normalized_text,
                "voice": {"mode": "id", "id": self.voice_id},
                "output_format": {
                    "container": "raw",
                    "encoding": "pcm_s16le",
                    "sample_rate": self.sample_rate,
                },
                "add_timestamps": False,
            }
            if "en" in lang_code:
                send_kwargs["locale"] = "en-IN"
            elif "hi" in lang_code or "mr" in lang_code:
                send_kwargs["language"] = "hi"
            else:
                send_kwargs["locale"] = "en-IN"

            out = await ws.send(**send_kwargs)
            frame_size = 2048
            async for event in out:
                audio = getattr(event, "audio", None)
                if audio is None and isinstance(event, dict):
                    audio = event.get("audio")
                if audio:
                    for i in range(0, len(audio), frame_size):
                        yield audio[i : i + frame_size]
            return
        except Exception as ws_err:
            logger.warning(f"Cartesia WebSocket error, reconnecting: {ws_err}")
            async with self._ws_lock:
                self._ws = None

        # 2. Fallback: HTTP streaming generate with en-IN locale
        call_kwargs = {
            "model_id": self.model_id,
            "transcript": normalized_text,
            "voice": {"mode": "id", "id": self.voice_id},
            "output_format": {
                "container": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": self.sample_rate,
            },
            "generation_config": {"emotion": "calm", "speed": 1.0},
        }

        if "en" in lang_code:
            call_kwargs["locale"] = "en-IN"
        elif "hi" in lang_code or "mr" in lang_code:
            call_kwargs["language"] = "hi"
        else:
            call_kwargs["locale"] = "en-IN"

        try:
            res = await self.client.tts.generate(**call_kwargs)
            async for chunk in res.iter_bytes(chunk_size=2048):
                if chunk:
                    yield chunk
        except Exception as e:
            logger.error(f"Cartesia generate API fallback error: {e}")
'''

with open('agent/tts/cartesia_tts.py', 'w', encoding='utf-8') as f:
    f.write(cartesia_code)
print("Updated agent/tts/cartesia_tts.py (persistent WS + en-IN accent restored).")

# 2. Update web/index.html:
# - Fix getVocalMasterBus (Close-Mic Proximity EQ, no 360Hz scoop, intimate upfront sound)
# - Fix debounce: 950ms natural pause window so user can speak full sentences or whole paragraphs
with open('web/index.html', 'r', encoding='utf-8') as f:
    htext = f.read()

# Replace getVocalMasterBus
old_vocal_bus_pat = r'function getVocalMasterBus\(\) \{[\s\S]*?vocalMasterBus = hp;\s*return vocalMasterBus;\s*\}'
new_vocal_bus = '''function getVocalMasterBus() {
      if (vocalMasterBus && vocalMasterBus.context === audioContext) {
        return vocalMasterBus;
      }
      if (!audioContext) return null;

      // 1. Sub-rumble highpass (65Hz) - keeps 100% of rich vocal chest resonance
      const hp = audioContext.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 65;

      // 2. Intimate Close-Mic Proximity Warmth (200Hz, +2.5dB, wide Q=0.8):
      // Solves "mic sounds far away" by boosting intimate proximity effect right at the listener's ear!
      const proximity = audioContext.createBiquadFilter();
      proximity.type = "peaking";
      proximity.frequency.value = 200;
      proximity.Q.value = 0.8;
      proximity.gain.value = 2.5;

      // 3. Clear Upfront Speech Articulation (3400Hz, +3.2dB, wide Q=0.9):
      // Direct, close-up broadcast clarity so every consonant is crisp
      const presence = audioContext.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 3400;
      presence.Q.value = 0.9;
      presence.gain.value = 3.2;

      // 4. Velvet Air Shelf (10000Hz, +1.2dB): crystal fidelity
      const air = audioContext.createBiquadFilter();
      air.type = "highshelf";
      air.frequency.value = 10000;
      air.gain.value = 1.2;

      // 5. Powerful Close-Mic Master Gain (1.45x)
      const masterGain = audioContext.createGain();
      masterGain.gain.value = 1.45;

      // Connect direct close-mic chain: hp -> proximity -> presence -> air -> masterGain -> destination
      hp.connect(proximity);
      proximity.connect(presence);
      presence.connect(air);
      air.connect(masterGain);
      masterGain.connect(audioContext.destination);

      vocalMasterBus = hp;
      return vocalMasterBus;
    }'''

htext, c_bus = re.subn(old_vocal_bus_pat, new_vocal_bus, htext, count=1)
if c_bus:
    print("Patched getVocalMasterBus with intimate Close-Mic Proximity EQ.")
else:
    print("Warning: getVocalMasterBus pattern not found in web/index.html")

# Replace onresult in setupChromeSpeechRecognition for full paragraph tolerance
old_sr_pat = r'speechRecognition\.onresult = \(event\) => \{[\s\S]*?turnDebounceTimer = setTimeout\(\(\) => \{[\s\S]*?dispatchFullUserTurn\(combinedText\);[\s\S]*?\}, debounceMs\);[\s\S]*?\};'
new_sr = '''speechRecognition.onresult = (event) => {
          if (!isCalling || !ws || ws.readyState !== WebSocket.OPEN) return;
          const isAgentSpeaking = isAgentSpeakingNow();

          let currentInterim = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const piece = event.results[i][0].transcript.trim();
            if (event.results[i].isFinal) {
              if (piece) {
                if (!isAgentSpeaking || isGenuineUserInterruption(piece)) {
                  accumulatedUserTurn += (accumulatedUserTurn ? " " : "") + piece;
                }
              }
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }

          const combinedText = (accumulatedUserTurn + " " + currentInterim).trim();
          if (!combinedText) return;

          if (isAgentSpeaking) {
            if (Date.now() - lastDispatchedTurnTime < 2500) return;
            const cleanCur = combinedText.toLowerCase().trim();
            if (cleanCur === lastDispatchedTurnText || lastDispatchedTurnText.includes(cleanCur)) return;
            if (agentSpeakingStartTime && (Date.now() - agentSpeakingStartTime < 800)) return;
            if (!isGenuineUserInterruption(combinedText)) return;
            console.log("[BARGE-IN] Genuine user verbal interruption detected:", combinedText);
            triggerBargeIn(false);
          }

          liveMicPill.style.display = "inline-flex";
          interimText.innerText = combinedText;

          // FULL THOUGHT / PARAGRAPH LISTENING WINDOW:
          // We wait 950ms of true silence after speech stops.
          // This allows caller to pause naturally between clauses, speak full sentences
          // or complete paragraphs without being cut off prematurely!
          if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
          turnDebounceTimer = setTimeout(() => {
            dispatchFullUserTurn(combinedText);
          }, 950);
        };'''

htext, c_sr = re.subn(old_sr_pat, new_sr, htext, count=1)
if c_sr:
    print("Patched speechRecognition.onresult for full paragraph listening tolerance.")
else:
    print("Warning: speechRecognition.onresult pattern not found in web/index.html")

with open('web/index.html', 'w', encoding='utf-8') as f:
    f.write(htext)

print("web/index.html patch completed.")
