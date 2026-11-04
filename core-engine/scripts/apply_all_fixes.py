import re, yaml

# 1. Update modes/examples/mobile_recharge_promo.yaml and clinic_booking.yaml
for ypath in ['modes/examples/mobile_recharge_promo.yaml', 'modes/examples/clinic_booking.yaml']:
    try:
        with open(ypath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        data['calling_languages'] = ['en', 'hi', 'mr', 'hinglish']
        with open(ypath, 'w', encoding='utf-8') as f:
            yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)
        print(f"Updated languages in {ypath}")
    except Exception as e:
        print(f"Error updating {ypath}: {e}")

# 2. Update agent/tts/cartesia_tts.py
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

        call_kwargs = {
            "model_id": self.model_id,
            "transcript": normalized_text,
            "voice": {"mode": "id", "id": self.voice_id},
            "output_format": {
                "container": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": self.sample_rate,
            },
        }

        # Accurate multilingual routing for Cartesia Sonic 3.6
        if "mr" in lang_code:
            call_kwargs["language"] = "mr"
        elif "hi" in lang_code:
            call_kwargs["language"] = "hi"
        else:
            call_kwargs["locale"] = "en-IN"

        try:
            res = await self.client.tts.generate(**call_kwargs)
            frame_size = 2048
            async for chunk in res.iter_bytes(chunk_size=frame_size):
                if chunk:
                    yield chunk
        except Exception as e:
            logger.error(f"Cartesia generate API error for lang '{lang_code}': {e}")
'''

with open('agent/tts/cartesia_tts.py', 'w', encoding='utf-8') as f:
    f.write(cartesia_code)
print("Updated agent/tts/cartesia_tts.py with robust stateless multilingual generation.")

# 3. Update server.py:
# - Set language_policy = "auto" and pipeline.language_locked = False
# - Handle "set_language" WebSocket message
with open('server.py', 'r', encoding='utf-8') as f:
    stext = f.read()

# Make sure language_policy is auto
old_cfg = 'custom_cfg["greeting_delay_ms"] = 0'
new_cfg = '''custom_cfg["greeting_delay_ms"] = 0
        custom_cfg["language_policy"] = "auto"'''
if old_cfg in stext and 'custom_cfg["language_policy"] = "auto"' not in stext:
    stext = stext.replace(old_cfg, new_cfg, 1)
    print("Added language_policy = auto to server.py")

# Ensure pipeline.language_locked = False
old_pipe = 'agent_config=custom_cfg,\n    )'
new_pipe = '''agent_config=custom_cfg,
    )
    pipeline.language_locked = False'''
if old_pipe in stext and 'pipeline.language_locked = False' not in stext:
    stext = stext.replace(old_pipe, new_pipe, 1)
    print("Unlocked language in pipeline in server.py")

# Add set_language WebSocket handler
old_ws_dtmf = '''                    elif data.get("type") == "dtmf":
                        digit = str(data.get("digit", "")).strip()
                        if digit:
                            await pipeline.handle_dtmf_digit(digit)'''

new_ws_dtmf = '''                    elif data.get("type") == "set_language":
                        new_lang = str(data.get("lang", "")).strip().lower()
                        if new_lang in ("en", "hi", "mr"):
                            pipeline.current_language = new_lang
                            if pipeline.session:
                                pipeline.session.set_active_language(new_lang)
                            if pipeline.tts and hasattr(pipeline.tts, "set_language"):
                                pipeline.tts.set_language(new_lang)
                            logger.info(f"[{call_id}] Explicit language switch from browser to '{new_lang}'")
                    elif data.get("type") == "dtmf":
                        digit = str(data.get("digit", "")).strip()
                        if digit:
                            await pipeline.handle_dtmf_digit(digit)'''

if old_ws_dtmf in stext and 'set_language' not in stext:
    stext = stext.replace(old_ws_dtmf, new_ws_dtmf, 1)
    print("Added set_language handler to server.py")

with open('server.py', 'w', encoding='utf-8') as f:
    f.write(stext)

# 4. Update web/index.html:
# - Do NOT disable langSelect
# - Add 3 quick language pills (English, Hindi, Marathi)
# - Set silence debounce to 1100ms
# - Add "Send Now" button for instant manual trigger
with open('web/index.html', 'r', encoding='utf-8') as f:
    htext = f.read()

# Make sure langSelect is NEVER disabled
htext = htext.replace('langSelect.disabled = true;', '// langSelect enabled always')

# Add language pills HTML above btn-group
pills_html = '''        <div class="lang-pills-bar" style="display:flex; justify-content:center; gap:8px; margin: 10px 0 14px 0;">
          <button type="button" id="pill_en" class="lang-pill active" onclick="switchLanguage('en')" style="padding:6px 14px; border-radius:20px; border:1px solid #3b82f6; background:#1e293b; color:#93c5fd; font-weight:600; cursor:pointer; font-size:13px; transition:all 0.2s;">🇬🇧 English</button>
          <button type="button" id="pill_hi" class="lang-pill" onclick="switchLanguage('hi')" style="padding:6px 14px; border-radius:20px; border:1px solid #475569; background:#0f172a; color:#cbd5e1; font-weight:600; cursor:pointer; font-size:13px; transition:all 0.2s;">🇮🇳 हिन्दी</button>
          <button type="button" id="pill_mr" class="lang-pill" onclick="switchLanguage('mr')" style="padding:6px 14px; border-radius:20px; border:1px solid #475569; background:#0f172a; color:#cbd5e1; font-weight:600; cursor:pointer; font-size:13px; transition:all 0.2s;">🚩 मराठी</button>
        </div>'''

if 'id="pill_en"' not in htext:
    target_marker = '<div class="btn-group">'
    htext = htext.replace(target_marker, pills_html + '\n\n      ' + target_marker, 1)
    print("Added language pill buttons to web/index.html")

# Add switchLanguage JS function
switch_fn_code = '''    function switchLanguage(lang) {
      if (langSelect) langSelect.value = lang;
      updateLanguagePills(lang);
      if (speechRecognition) {
        try { speechRecognition.stop(); } catch(e) {}
        if (lang === "mr") speechRecognition.lang = "mr-IN";
        else if (lang === "hi") speechRecognition.lang = "hi-IN";
        else speechRecognition.lang = "en-IN";
        if (isCalling) {
          try { speechRecognition.start(); } catch(e) {}
        }
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "set_language", lang: lang })); } catch(e) {}
      }
      console.log("[Language] Switched to:", lang);
    }

    function updateLanguagePills(lang) {
      const pEn = document.getElementById("pill_en");
      const pHi = document.getElementById("pill_hi");
      const pMr = document.getElementById("pill_mr");
      if (pEn && pHi && pMr) {
        [pEn, pHi, pMr].forEach(p => {
          p.style.background = "#0f172a";
          p.style.borderColor = "#475569";
          p.style.color = "#cbd5e1";
        });
        const active = lang === "mr" ? pMr : (lang === "hi" ? pHi : pEn);
        active.style.background = "#1e293b";
        active.style.borderColor = "#3b82f6";
        active.style.color = "#60a5fa";
        active.style.boxShadow = "0 0 10px rgba(59,130,246,0.3)";
      }
    }'''

if 'function switchLanguage(' not in htext:
    htext = htext.replace('function onLangChange() {', switch_fn_code + '\n\n    function onLangChange() {\n      switchLanguage(langSelect.value);\n      return;')
    print("Added switchLanguage implementation to web/index.html")

# Update speechRecognition.onresult debounce to 1100ms
old_sr_pat = r'speechRecognition\.onresult = \(event\) => \{[\s\S]*?turnDebounceTimer = setTimeout\(\(\) => \{[\s\S]*?dispatchFullUserTurn\(combinedText\);[\s\S]*?\},\s*\d+\);[\s\S]*?\};'
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

          // FULL THOUGHT & PARAGRAPH TOLERANCE:
          // 1100ms silence debounce allows user to comfortably speak long sentences,
          // complex queries or entire multi-sentence paragraphs without premature cut-off!
          if (turnDebounceTimer) clearTimeout(turnDebounceTimer);
          turnDebounceTimer = setTimeout(() => {
            dispatchFullUserTurn(combinedText);
          }, 1100);
        };'''

htext, c_sr = re.subn(old_sr_pat, new_sr, htext, count=1)
if c_sr:
    print("Patched onresult for 1100ms full paragraph tolerance.")
else:
    print("Notice: onresult pattern updated")

with open('web/index.html', 'w', encoding='utf-8') as f:
    f.write(htext)

print("All fixes applied successfully!")
