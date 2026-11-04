import re

# 1. Update agent/tts/chunker.py
chunker_code = '''"""Sentence chunker for streaming LLM text into spoken audio units."""

import re
from typing import AsyncIterator, List


class SentenceChunker:
    """Buffers streaming token streams and yields complete sentences or early clauses.

    Supports Latin and Devanagari sentence terminators (., !, ?, ।, ॥, \\n).
    """

    # Primary sentence terminators (ignoring decimal points inside numbers like 1.5, 9.0)
    SENTENCE_END_REGEX = re.compile(r"([!?।॥\\n]+|(?<!\\d)\\.(?!\\d))")
    # Common Indic and English abbreviations to prevent premature, choppy splitting
    ABBREVIATIONS = {"dr", "mr", "mrs", "ms", "prof", "vs", "am", "pm", "rs", "no", "डॉ", "श्री", "सौ", "प्रा", "कु"}

    def __init__(self, min_clause_length: int = 35) -> None:
        self.buffer = ""
        self.min_clause_length = min_clause_length
        self._is_first_chunk = True

    def add_token(self, token: str) -> List[str]:
        """Add a token to the buffer and return any completed sentences."""
        self.buffer += token
        return self._extract_sentences()

    def flush(self) -> List[str]:
        """Flush and return any remaining text in the buffer."""
        remaining = self.buffer.strip()
        self.buffer = ""
        self._is_first_chunk = True
        if remaining:
            return [remaining]
        return []

    def _extract_sentences(self) -> List[str]:
        completed: List[str] = []

        while True:
            match = self.SENTENCE_END_REGEX.search(self.buffer)
            if match:
                end_pos = match.end()
                potential_sentence = self.buffer[:end_pos].strip()

                # Check if potential ends with an abbreviation
                last_word_match = re.search(r"([^\\s.!?।॥]+)[.!?।॥]+$", potential_sentence)
                if last_word_match:
                    word = last_word_match.group(1).lower().strip(".")
                    if word in self.ABBREVIATIONS:
                        break

                if potential_sentence:
                    completed.append(potential_sentence)
                    self._is_first_chunk = False
                self.buffer = self.buffer[end_pos:]
                continue

            # Low-latency early clause split: for first chunk, split on comma/colon/dash after 18 chars
            threshold = 18 if self._is_first_chunk else self.min_clause_length
            if len(self.buffer) > threshold:
                clause_match = re.search(r"([,;:\\-—]\\s+)", self.buffer)
                if clause_match:
                    end_pos = clause_match.end()
                    clause = self.buffer[:end_pos].strip()
                    if clause:
                        completed.append(clause)
                        self._is_first_chunk = False
                    self.buffer = self.buffer[end_pos:]
                    continue

            break

        return completed

    async def chunk_stream(self, token_stream: AsyncIterator[str]) -> AsyncIterator[str]:
        """Consume an async token stream and yield complete sentence chunks."""
        async for token in token_stream:
            for sentence in self.add_token(token):
                if sentence:
                    yield sentence

        for remaining in self.flush():
            if remaining:
                yield remaining
'''

with open('agent/tts/chunker.py', 'w', encoding='utf-8') as f:
    f.write(chunker_code)
print("Updated agent/tts/chunker.py for ultra-low latency clause streaming.")

# 2. Update agent/tts/cartesia_tts.py with WebSocket streaming + iter_bytes fallback
cartesia_code = '''"""Cartesia streaming TTS implementation with natural emotion and Indian English locale."""

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

        if not self.api_key:
            logger.warning(
                "CARTESIA_API_KEY is not set. CartesiaTTS will fail if called without an active key."
            )
            self.client: Optional[AsyncCartesia] = None
        else:
            self.client = AsyncCartesia(api_key=self.api_key)

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

        # 1. Real-time Cartesia WebSocket streaming for instant <150ms audio output
        try:
            ws = await self.client.tts.websocket()
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
                send_kwargs["language"] = "en"
            elif "hi" in lang_code or "mr" in lang_code:
                send_kwargs["language"] = "hi"
            else:
                send_kwargs["language"] = "en"

            out = await ws.send(**send_kwargs)
            frame_size = 2048
            async for event in out:
                audio = getattr(event, "audio", None)
                if audio is None and isinstance(event, dict):
                    audio = event.get("audio")
                if audio:
                    for i in range(0, len(audio), frame_size):
                        yield audio[i : i + frame_size]
            await ws.close()
            return
        except Exception as ws_err:
            logger.warning(f"Cartesia WebSocket streaming failed, using streaming generate fallback: {ws_err}")

        # 2. Fallback: HTTP streaming generate
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
            call_kwargs["language"] = "en"

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
print("Updated agent/tts/cartesia_tts.py for instant WebSocket streaming.")

# 3. Update web/index.html with faster debounce and instant THINKING feedback
with open('web/index.html', 'r', encoding='utf-8') as f:
    htext = f.read()

# Update onresult debounce and dispatch
old_onresult_pat = r'speechRecognition\.onresult = \(event\) => \{[\s\S]*?turnDebounceTimer = setTimeout\(\(\) => \{[\s\S]*?dispatchFullUserTurn\(combinedText\);[\s\S]*?\}, 600\);[\s\S]*?\};'

new_onresult = '''speechRecognition.onresult = (event) => {
          if (!isCalling || !ws || ws.readyState !== WebSocket.OPEN) return;
          const isAgentSpeaking = isAgentSpeakingNow();

          let currentInterim = "";
          let hasFinalChunk = false;
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const piece = event.results[i][0].transcript.trim();
            if (event.results[i].isFinal) {
              if (piece) {
                hasFinalChunk = true;
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

          // Lightning-fast responsive debounce:
          // 150ms on final speech phrase, 300ms on interim pauses
          if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
          const debounceMs = hasFinalChunk ? 150 : 300;
          turnDebounceTimer = setTimeout(() => {
            dispatchFullUserTurn(combinedText);
          }, debounceMs);
        };'''

htext, c1 = re.subn(old_onresult_pat, new_onresult, htext, count=1)
if c1:
    print("Patched onresult debounce in web/index.html")
else:
    print("Warning: onresult pattern not found in web/index.html")

# Update dispatchFullUserTurn to immediately set UI to THINKING
old_disp_pat = r'function dispatchFullUserTurn\(textOverride\) \{[\s\S]*?console\.log\("Full User Turn Dispatched:", fullText\);'
new_disp = '''function dispatchFullUserTurn(textOverride) {
      const fullText = (textOverride || accumulatedUserTurn).trim();
      if (!fullText || !ws || ws.readyState !== WebSocket.OPEN) return;
      accumulatedUserTurn = "";
      lastDispatchedTurnText = fullText.toLowerCase();
      lastDispatchedTurnTime = Date.now();
      currentStreamingBubble = null;
      streamedChunksInTurn = [];
      liveMicPill.style.display = "none";
      // Instant visual feedback: turn badge to Thinking immediately so caller knows they were heard!
      setUIState("THINKING");
      console.log("Full User Turn Dispatched:", fullText);'''

htext, c2 = re.subn(old_disp_pat, new_disp, htext, count=1)
if c2:
    print("Patched dispatchFullUserTurn instant feedback in web/index.html")
else:
    print("Warning: dispatchFullUserTurn pattern not found in web/index.html")

with open('web/index.html', 'w', encoding='utf-8') as f:
    f.write(htext)

print("web/index.html patch completed.")
