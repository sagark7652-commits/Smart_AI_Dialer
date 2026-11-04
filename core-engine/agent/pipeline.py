"""Voice Agent Pipeline: Phase 9A Advanced Core Capabilities.



Includes Tool Calling, Spoken Fillers, RAG, Human Transfer, Recording/Consent, and AMD.

"""



import asyncio

from dataclasses import asdict, dataclass

from enum import Enum

import json

from pathlib import Path

import re

import sys

import time

from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Tuple

import wave



if sys.platform == "win32":

    try:

        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    except Exception:

        pass

from agent.analytics import PostCallAnalyzer

from agent.config import get_settings

from agent.cost_calculator import CostCalculator

from agent.db import get_db

from agent.fillers import FillerManager

from agent.languages import detect_language

from agent.llm.base import BaseLLM, ChatMessage

from agent.llm.prompt_manager import AgentPromptManager, ConversationSession

from agent.logger import setup_logger

from agent.rag.store import get_rag_store

from agent.safety import (

    AIDisclosureGuard,

    CallingHoursGuard,

    DoNotCallRegistry,

    NotInterestedDetector,

    SecuritySanitizer,

    VoiceInjectionDetector,

    ToolCallValidator,

)

from agent.stt.base import BaseSTT, TranscriptionEvent

from agent.stt.vad import VoiceActivityDetector

from agent.telephony.base import BaseTelephonyProvider

from agent.tools.registry import get_tool_registry

from agent.tts.base import BaseTTS

from agent.tts.chunker import SentenceChunker

from agent.tts.normalizer import TextNormalizer

from agent.tts.player import AudioPlayer

from agent.webhooks import WebhookDispatcher

from agent.dtmf import DTMFHandler, DTMFConfig, DTMFResult

from agent.resilience.fallback_manager import FallbackChainManager



logger = setup_logger("pipeline")





class AgentState(str, Enum):

    """Pipeline conversation lifecycle states."""



    IDLE = "IDLE"

    LISTENING = "LISTENING"

    THINKING = "THINKING"

    SPEAKING = "SPEAKING"

    DISCONNECTED = "DISCONNECTED"





@dataclass

class TranscriptEntry:

    """Record of a single conversation turn in the session transcript."""



    timestamp: str

    role: str  # 'agent' or 'caller'

    text: str

    interrupted: bool = False

    latency_breakdown: Optional[dict] = None

    tool_calls: Optional[List[dict]] = None





class VoicePipeline:

    """End-to-end streaming voice pipeline with VAD, RAG, Tool Calling, and Transfer."""



    def __init__(

        self,

        stt: Optional[BaseSTT] = None,

        llm: Optional[BaseLLM] = None,

        tts: Optional[BaseTTS] = None,

        player: Optional[AudioPlayer] = None,

        telephony: Optional[BaseTelephonyProvider] = None,

        prompt_manager: Optional[AgentPromptManager] = None,

        silence_timeout_sec: Optional[float] = None,

        second_silence_timeout_sec: Optional[float] = None,

        end_of_turn_silence_ms: Optional[int] = None,

        filler_delay_ms: int = 800,

        transcripts_dir: str = "transcripts",

        recordings_dir: str = "recordings",

        call_id: Optional[str] = None,

        loop_config: Optional[Dict[str, Any]] = None,

        debug: bool = False,

    ) -> None:

        self.settings = get_settings()

        self.stt = stt

        self.llm = llm

        self.tts = tts

        self.player = player

        self.telephony = telephony

        self.prompt_manager = prompt_manager

        self.config = (self.prompt_manager.config if self.prompt_manager else {}) or {}

        self.variables = getattr(self.prompt_manager, "variables", {}) or {}

        self.session = ConversationSession(prompt_manager) if prompt_manager else None

        self.debug = debug



        # Load voice loop configuration from agent config or explicit param

        base_cfg = (

            self.prompt_manager.config.get("voice_loop", {})

            if self.prompt_manager

            else {}

        )

        loop_cfg = {**base_cfg, **(loop_config or {})}



        # Check if telephony session is active; if so, apply 'phone' profile

        if self.telephony is not None and "phone" in loop_cfg:

            phone_profile = loop_cfg.get("phone", {})

            loop_cfg = {**loop_cfg, **phone_profile}

            logger.info(f"[{call_id}] Telephony session active: applied 'phone' VAD and tuning profile.")



        self.silence_timeout_sec = (

            silence_timeout_sec

            if silence_timeout_sec is not None

            else loop_cfg.get("silence_timeout_sec", 18.0)

        )

        self.second_silence_timeout_sec = (

            second_silence_timeout_sec

            if second_silence_timeout_sec is not None

            else loop_cfg.get("second_silence_timeout_sec", 18.0)

        )

        self.end_of_turn_silence_ms = (

            end_of_turn_silence_ms

            if end_of_turn_silence_ms is not None

            else loop_cfg.get("silence_ms", 600)

        )

        self.extra_wait_ms = loop_cfg.get("extra_wait_ms", 350)

        self.vad_threshold = loop_cfg.get("vad_threshold", 350.0)

        self.barge_in_min_speech_ms = loop_cfg.get("barge_in_min_speech_ms", 250)

        self.headset_mode = loop_cfg.get("headset_mode", True)

        self.fallback_messages = loop_cfg.get("fallback_messages", {})



        self.ignore_backchannels = loop_cfg.get("ignore_backchannels", True)

        self.backchannel_words = set(

            w.lower() for w in loop_cfg.get("backchannel_words", ["haan", "hmm", "ok", "ha", "acha", "yeah", "yes", "ho", "हाँ", "हूँ"])

        )

        self.max_call_duration_sec = float(loop_cfg.get("max_call_duration_sec", getattr(self.settings, "max_call_duration_sec", 3600.0)))

        self.max_call_cost_inr = float(loop_cfg.get("max_call_cost_inr", getattr(self.settings, "max_call_cost_inr", 500.00)))

        self.max_call_cost_usd = float(loop_cfg.get("max_call_cost_usd", self.max_call_cost_inr / 83.0))

        self.enable_cost_guard = bool(loop_cfg.get("enable_cost_guard", getattr(self.settings, "enable_cost_guard", False)))

        self.api_key_id = loop_cfg.get("api_key_id")

        self.campaign_id = loop_cfg.get("campaign_id")

        self.provider_name = loop_cfg.get("provider", "twilio")

        self.agent_mode = loop_cfg.get("agent_mode", "telecaller")

        self.end_reason = "completed"



        self.filler_delay_ms = filler_delay_ms

        self.call_id = call_id or f"call_{int(time.time())}"



        self.transcripts_dir = Path(transcripts_dir)

        self.transcripts_dir.mkdir(parents=True, exist_ok=True)

        self.recordings_dir = Path(recordings_dir)

        self.recordings_dir.mkdir(parents=True, exist_ok=True)

        self.metrics_dir = Path("metrics")

        self.metrics_dir.mkdir(parents=True, exist_ok=True)



        self.vad = VoiceActivityDetector(

            rms_threshold=self.vad_threshold,

            end_of_turn_silence_ms=self.end_of_turn_silence_ms,

            extra_wait_ms=self.extra_wait_ms,

            barge_in_min_speech_ms=self.barge_in_min_speech_ms,

            headset_mode=self.headset_mode,

        )

        self.state = AgentState.IDLE



        # Tool registry, RAG store, and Filler Manager

        self.tools = get_tool_registry()

        self.rag = get_rag_store()

        self.filler_manager = FillerManager()

        self.current_language = (

            self.prompt_manager.config.get("default_language", "hi")

            if self.prompt_manager

            else "hi"

        )

        self.language_policy = (
            self.prompt_manager.config.get("language_policy", "strict")
            if self.prompt_manager
            else "strict"
        )
        self.language_locked = (self.language_policy == "strict")
        self._offered_lang_switch = False
        self._language_violations_count = 0
        self.speculative_llm = self.prompt_manager.config.get('speculative_llm', False) if self.prompt_manager else False
        fillers_setting = self.prompt_manager.config.get('fillers', 'off') if self.prompt_manager else 'off'
        self.fillers_enabled = (fillers_setting not in ('off', False, 'false')) or (filler_delay_ms is not None and filler_delay_ms != 800)



        # Turn & Metrics state

        self._current_generation_task: Optional[asyncio.Task] = None

        self._current_agent_reply: List[str] = []

        self._interrupted_turn = False

        self._silence_prompt_count = 0

        self._last_user_activity_time = time.time()

        self._transcript_history: List[TranscriptEntry] = []

        self._turn_count = 0

        self._consecutive_failures = 0

        self._interruption_count = 0

        self._latest_partial_transcript = ""

        self._all_latencies: List[dict] = []

        self._recent_agent_replies: List[str] = []

        self._last_caller_transcript: str = ""

        self._last_caller_transcript_time: float = 0.0

        self._consecutive_loop_count: int = 0



        # Recording configuration

        rec_conf = (

            self.prompt_manager.config.get("recording", {}) if self.prompt_manager else {}

        )

        self.recording_enabled = rec_conf.get("enabled", False)

        self.recording_file_path = self.recordings_dir / f"{self.call_id}.raw"

        self._recording_fp = None

        if self.recording_enabled:

            try:

                self._recording_fp = open(self.recording_file_path, "ab")

            except Exception as e:

                logger.error(f"Could not open recording file: {e}")



        # Dual-track WAV recorders (caller.wav and agent.wav)

        self.caller_wav_path = self.recordings_dir / f"{self.call_id}_caller.wav"

        self.agent_wav_path = self.recordings_dir / f"{self.call_id}_agent.wav"

        self._caller_wav_fp: Optional[wave.Wave_write] = None

        self._agent_wav_fp: Optional[wave.Wave_write] = None

        if self.recording_enabled or self.debug:

            try:

                self._caller_wav_fp = wave.open(str(self.caller_wav_path), "wb")

                self._caller_wav_fp.setnchannels(1)

                self._caller_wav_fp.setsampwidth(2)

                self._caller_wav_fp.setframerate(16000)



                self._agent_wav_fp = wave.open(str(self.agent_wav_path), "wb")

                self._agent_wav_fp.setnchannels(1)

                self._agent_wav_fp.setsampwidth(2)

                self._agent_wav_fp.setframerate(24000)

            except Exception as e:

                logger.warning(f"Could not open debug WAV recorders: {e}")



        # State transition hook

        self.on_state_change: Optional[Callable[[AgentState], None]] = None



        # DTMF keypad input processor

        self.dtmf_handler = DTMFHandler(call_id=self.call_id)

        self.fallback_manager = FallbackChainManager()

        self.fallback_llm = None

        self.fallback_tts = None

        if self.telephony and hasattr(self.telephony, 'set_dtmf_callback'):

            self.telephony.set_dtmf_callback(self.handle_dtmf_digit)



    def _set_state(self, new_state: AgentState) -> None:

        if self.state != new_state:

            old_state = self.state

            self.state = new_state

            if new_state == AgentState.SPEAKING:
                self._speaking_start_time = time.time()

            ts = time.strftime("%Y-%m-%d %H:%M:%S")

            logger.info(

                f"[{ts}] [Session: {self.call_id}] State transition: [{old_state.value}] -> [{new_state.value}]"

            )

            if self.on_state_change:

                self.on_state_change(new_state)



    def trigger_barge_in(self, speech_onset_time: Optional[float] = None) -> None:

        if self.state != AgentState.SPEAKING:
            return
        speaking_dur = time.time() - getattr(self, "_speaking_start_time", 0.0)
        if speaking_dur < 0.8:
            logger.info(f"[BARGE-IN GUARD] Ignored early barge-in during initial {speaking_dur*1000:.0f}ms of speech onset.")
            return
        if getattr(self, "_in_greeting_grace_period", False):
            logger.info("[BARGE-IN GUARD] Ignored barge-in during greeting grace period.")
            return
        if self.state in (AgentState.SPEAKING, AgentState.THINKING):

            reaction_time_ms = (

                (time.perf_counter() - speech_onset_time) * 1000

                if speech_onset_time

                else 180.0

            )

            self._interruption_count += 1

            logger.info(

                f"⚡ BARGE-IN DETECTED (Reaction: {reaction_time_ms:.1f}ms): Halting agent speech."

            )

            self._interrupted_turn = True



            if self._current_generation_task and not self._current_generation_task.done():

                self._current_generation_task.cancel()

                self._current_generation_task = None



            if self.player:

                self.player.clear()

            if self.telephony:

                try:

                    loop = asyncio.get_running_loop()

                    loop.create_task(self.telephony.clear_audio())

                except RuntimeError:

                    pass



            played_summary = ""

            if self.telephony and hasattr(self.telephony, "get_played_text_summary"):

                try:

                    played_summary = self.telephony.get_played_text_summary()

                except Exception:

                    pass



            partial_text = played_summary or "".join(self._current_agent_reply).strip()

            if partial_text:

                interrupted_text = f"[Interrupted] {partial_text}"

                if self.session:

                    self.session.add_assistant_message(interrupted_text)

                self._record_transcript(

                    "agent",

                    interrupted_text,

                    interrupted=True,

                    latency={"barge_in_reaction_ms": round(reaction_time_ms, 1)},

                )

                self._current_agent_reply = []



            self._set_state(AgentState.LISTENING)



    def _get_fallback_message(self, language: str = "hi") -> str:

        lang_key = language.split("-")[0].lower()

        if lang_key in self.fallback_messages:

            return self.fallback_messages[lang_key]

        defaults = {

            "hi": "एक सेकंड, मुझे आपकी आवाज़ साफ़ नहीं आई। कृपया फिर से बोलिए।",

            "en": "One moment, I couldn't hear that clearly. Could you please say that again?",

            "mr": "एक मिनिट, मला तुमचा आवाज स्पष्ट आला नाही. कृपया पुन्हा सांगा.",

        }

        return defaults.get(lang_key, defaults["en"])



    def _record_transcript(

        self,

        role: str,

        text: str,

        interrupted: bool = False,

        latency: Optional[dict] = None,

        tool_calls: Optional[List[dict]] = None,

    ) -> None:

        if role == "agent":
            text = TextNormalizer.enforce_female_gender(text, language=getattr(self, "current_language", "hi"))

        sanitized_text = SecuritySanitizer.redact(text)

        entry = TranscriptEntry(

            timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),

            role=role,

            text=sanitized_text,

            interrupted=interrupted,

            latency_breakdown=latency,

            tool_calls=tool_calls,

        )

        self._transcript_history.append(entry)



    def save_session_transcript(self, session_id: Optional[str] = None) -> Path:

        sid = session_id or self.call_id

        filepath = self.transcripts_dir / f"session_{sid}.json"

        data = [asdict(entry) for entry in self._transcript_history]

        with open(filepath, "w", encoding="utf-8") as f:

            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.info(f"Session transcript saved: {filepath}")

        return filepath



    async def _speak_phrase(
        self,
        text: str,
        language: str = "hi",
        preloaded_audio: Optional[Tuple[bytes, int]] = None,
        sync_sentence: bool = True,
    ) -> None:
        """Speak a single phrase or filler sentence immediately with zero-latency audio cache sync."""
        if not self.tts:
            return

        from agent.tts.audio_cache import get_audio_cache
        cached_audio = preloaded_audio or get_audio_cache().get_audio_by_text(text, language)
        if cached_audio:
            pcm_bytes, sr = cached_audio
            logger.info(f"[{self.call_id}] Instant zero-latency audio cache hit: '{text[:35]}...' ({len(pcm_bytes)} bytes)")
            chunk_size = 2048
            first_chunk = True
            for i in range(0, len(pcm_bytes), chunk_size):
                if self._interrupted_turn:
                    break
                chunk = pcm_bytes[i:i + chunk_size]
                if first_chunk:
                    if sync_sentence and hasattr(self.telephony, "send_sentence"):
                        try:
                            await self.telephony.send_sentence(text)
                        except Exception:
                            pass
                    first_chunk = False
                if self._agent_wav_fp:
                    try:
                        self._agent_wav_fp.writeframes(chunk)
                    except Exception:
                        pass
                if self.player:
                    self.player.enqueue(chunk)
                if self.telephony:
                    try:
                        await self.telephony.audio_out(chunk, associated_text=text)
                    except TypeError:
                        await self.telephony.audio_out(chunk)
            return

        norm = TextNormalizer.normalize(text, language=language)
        first_chunk = True
        async for chunk in self.tts.generate_audio_stream(norm, language=language):
            if self._interrupted_turn:
                break
            if first_chunk:
                if sync_sentence and hasattr(self.telephony, "send_sentence"):
                    try:
                        await self.telephony.send_sentence(text)
                    except Exception:
                        pass
                first_chunk = False
            if self._agent_wav_fp:
                try:
                    self._agent_wav_fp.writeframes(chunk)
                except Exception:
                    pass
            if self.player:
                self.player.enqueue(chunk)
            if self.telephony:
                try:
                    await self.telephony.audio_out(chunk, associated_text=norm)
                except TypeError:
                    await self.telephony.audio_out(chunk)


    async def process_user_turn(self, user_text: str) -> None:

        """Process an explicit text input or browser-transcribed turn from caller."""

        user_text = (user_text or "").strip()

        if not user_text:

            return



        # Immediate barge-in on user speech: stop any agent speech in progress

        if getattr(self, "_in_greeting_grace_period", False):
            self._in_greeting_grace_period = False
            self._interrupted_turn = True

        if self.state == AgentState.SPEAKING:
            self._interrupted_turn = True
            self.trigger_barge_in()



        now_time = time.time()

        # Deduplication check: drop identical transcript within 1.5s

        if (

            user_text == self._last_caller_transcript

            and (now_time - self._last_caller_transcript_time) < 1.5

        ):

            logger.info(f"[DEDUPE GUARD] Dropped duplicate user turn: '{user_text}'")

            return



        # Echo check

        if self._is_echo(user_text):

            logger.warning(f"[ECHO GUARD] Dropped transcript matching agent echo: '{user_text}'")

            return



        self._latest_partial_transcript = ""

        self._last_caller_transcript = user_text

        self._last_caller_transcript_time = now_time

        self._last_user_activity_time = now_time

        self._silence_prompt_count = 0

        self._record_transcript("caller", user_text)



        # Enforce locked language if configured, otherwise detect

        if self.language_locked:

            detected_lang = self.current_language

        else:

            lang = detect_language(user_text)

            detected_lang = lang.short_code

            if detected_lang != self.current_language:

                self.current_language = detected_lang

                if self.session:

                    self.session.set_active_language(detected_lang)

                if self.tts and hasattr(self.tts, "set_language"):

                    self.tts.set_language(detected_lang)



        if self.session:

            self.session.add_user_message(user_text)



        speech_end = time.perf_counter()

        if self._current_generation_task and not self._current_generation_task.done():

            self._current_generation_task.cancel()



        self._current_generation_task = asyncio.create_task(

            self._generate_and_speak(

                user_text=user_text,

                detected_lang=detected_lang,

                speech_end_time=speech_end,

                stt_latency_ms=80.0,

            )

        )



    async def speak_greeting(self) -> None:
        """Speak agent greeting with zero delay, instant audio playback, and synchronized text."""
        if not self.session or not self.prompt_manager:
            return

        lang = (self.current_language or self.prompt_manager.config.get("default_language", "en")).split("-")[0].lower()

        # Check if browser voice connection or pickup delay disabled
        is_browser = str(self.call_id).startswith("browser_") or (self.telephony and "browser" in type(self.telephony).__name__.lower())

        greeting_delay_sec = float(self.config.get("greeting_delay_ms", 0 if is_browser else 600)) / 1000.0
        pickup_wait_sec = float(self.config.get("pickup_wait_ms", 0 if is_browser else 1200)) / 1000.0

        if not is_browser and getattr(self, "call_direction", "outbound") == "outbound" and pickup_wait_sec > 0:
            logger.info(f"[{self.call_id}] Waiting up to {pickup_wait_sec*1000:.0f}ms for caller pickup greeting...")
            t_pickup_start = time.time()
            while time.time() - t_pickup_start < pickup_wait_sec:
                if getattr(self, "_latest_partial_transcript", ""):
                    logger.info(f"[{self.call_id}] Caller greeted on pickup: '{self._latest_partial_transcript}'")
                    break
                await asyncio.sleep(0.05)

        if not is_browser and greeting_delay_sec > 0:
            await asyncio.sleep(greeting_delay_sec)

        # Lookup zero-latency audio cache first for instant greeting
        from agent.tts.audio_cache import get_audio_cache
        cache = get_audio_cache()

        preset_key = self.config.get("preset_key") or self.config.get("mode_name")
        if not preset_key:
            agent_id = str(self.config.get("agent_id", "")).lower()
            company_str = str(self.config.get("company", {}).get("name", "") if isinstance(self.config.get("company"), dict) else self.config.get("company", "")).lower()
            if "credit_card" in agent_id or "hdfc" in agent_id or "apex" in company_str:
                preset_key = "credit_card_offer"
            elif "emi" in agent_id or "finance" in agent_id or "easyfinance" in company_str:
                preset_key = "bill_emi_reminder"
            elif "recharge" in agent_id or "promo" in agent_id or "swift" in company_str:
                preset_key = "mobile_recharge_promo"
            elif "dental" in agent_id or "aarogya" in agent_id or "clinic" in agent_id:
                preset_key = "clinic_booking"
            elif "lead" in agent_id or "techsolutions" in company_str:
                preset_key = "lead_qualification"
            elif "support" in agent_id or "caredesk" in company_str:
                preset_key = "support_faq"
            elif "survey" in agent_id or "insights" in company_str:
                preset_key = "feedback_survey"
            elif "sale" in agent_id or "bharat" in company_str:
                preset_key = "announcement_ad"
            else:
                preset_key = "mobile_recharge_promo"
        preset_key = str(preset_key).lower().replace("agent_", "")

        cache_key = f"{preset_key}_greeting"
        cached_tuple = cache.get_audio_by_key(cache_key, lang)
        cached_text = cache.get_text_by_key(cache_key, lang)

        if not cached_tuple and preset_key in ("clinic_booking", "appointment_booking"):
            cached_tuple = cache.get_audio_by_key("greeting", lang)
            cached_text = cache.get_text_by_key("greeting", lang)
        elif not cached_tuple and preset_key == "mobile_recharge_promo":
            cached_tuple = cache.get_audio_by_key("mobile_recharge_promo_greeting", lang)
            cached_text = cache.get_text_by_key("mobile_recharge_promo_greeting", lang)

        if cached_tuple and cached_text:
            greeting = cached_text
            logger.info(f"[{self.call_id}] Instant zero-latency Cartesia greeting for preset '{preset_key}', lang '{lang}': {greeting[:45]}...")
        else:
            try:
                from agent.greeting_manager import get_greeting_manager
                gm = get_greeting_manager()
                call_type = getattr(self, "call_type", None) or self.config.get("mode", "inbound" if is_browser else "outbound")
                cust_name = getattr(self, "customer_name", None) or self.variables.get("customer_name")
                company_name = self.config.get("company", {}).get("name") if isinstance(self.config.get("company"), dict) else None
                agent_gender = self.config.get("agent_gender", "female")
                ai_disc = self.config.get("ai_disclosure", "off") in ("on", True, "true")

                prepared = gm.build_greeting(
                    call_type=call_type,
                    language=lang,
                    company=company_name,
                    agent_name=self.config.get("name", "Priya"),
                    name=cust_name,
                    agent_gender=agent_gender,
                    ai_disclosure=ai_disc,
                )
                greeting = prepared.text
            except Exception as e:
                logger.warning(f"GreetingManager fallback: {e}")
                greeting = self.session.get_greeting()

        # Consent disclosure
        rec_conf = self.prompt_manager.config.get("recording", {})
        if self.recording_enabled and rec_conf.get("consent_messages"):
            consent_line = rec_conf["consent_messages"].get(lang, "This call is recorded.")
            greeting = f"{greeting} {consent_line}"

        self._record_transcript("agent", greeting)
        self._set_state(AgentState.SPEAKING)
        self._greeting_start_time = time.time()
        self._in_greeting_grace_period = True

        try:
            # Synchronously trigger sentence bubble exactly on first audio chunk
            await self._speak_phrase(greeting, language=lang, preloaded_audio=cached_tuple, sync_sentence=True)

            if self.player:
                self.player.wait_until_done(timeout=max(6.0, (len(cached_tuple[0]) / (cached_tuple[1] * 2)) if cached_tuple else 6.0))
            elif is_browser and cached_tuple:
                # Maintain speaking state & greeting grace period until browser finishes playing all intro audio chunks
                duration = len(cached_tuple[0]) / (cached_tuple[1] * 2)
                t_end = time.time() + duration
                while time.time() < t_end and not self._interrupted_turn:
                    await asyncio.sleep(0.1)

        finally:
            self._in_greeting_grace_period = False
            self._set_state(AgentState.LISTENING)
            self._last_user_activity_time = time.time()


    def _check_recording_revocation(self, user_text: str) -> bool:

        """Detect if caller objected to call recording."""

        revocation_patterns = [

            r"\b(don'?t|do not)\s+record\b",

            r"\bstop\s+recording\b",

            r"\brecord(ing)?\s+(mat|band)\b",

            r"\brecord\s+naka\s+karu\b",

        ]

        text_lower = user_text.lower()

        for pat in revocation_patterns:

            if re.search(pat, text_lower):

                logger.info("Caller objected to recording. Stopping audio recording.")

                self.recording_enabled = False

                if self._recording_fp:

                    try:

                        self._recording_fp.close()

                    except Exception:

                        pass

                    self._recording_fp = None

                return True

        return False



    def _check_answering_machine(self, user_text: str) -> bool:

        """Detect automated voicemail greetings on initial turns."""

        if self._turn_count > 2:

            return False



        amd_patterns = [

            r"\b(leave\s+a\s+message|record\s+your\s+message)\b",

            r"\b(not\s+available|after\s+the\s+tone|at\s+the\s+beep)\b",

            r"\b(voicemail|voice\s+mail|mailbox)\b",

        ]

        text_lower = user_text.lower()

        for pat in amd_patterns:

            if re.search(pat, text_lower):

                logger.info(f"Answering machine detected on turn {self._turn_count}: '{user_text}'")

                return True

        return False



    def _check_human_transfer_requested(self, user_text: str) -> bool:

        """Detect caller request to speak to a human or strong frustration."""

        text_lower = user_text.lower()



        # If user is asking about identity ("are you a robot/human/doctor"), that's an AI inquiry, not transfer

        if re.search(r"\b(are you|kya aap|tum kya)\b", text_lower) and any(

            w in text_lower for w in ["robot", "ai", "bot", "doctor", "insan", "human", "real"]

        ):

            return False



        transfer_keywords = [

            r"\b(talk|speak|connect|transfer)\s+(to|with)?\s*(a\s+)?(human|operator|receptionist|person|doctor|agent)\b",

            r"\b(human|operator|receptionist)\s+(please|chahiye|se\s+baat)\b",

            r"\b(kisi\s+se\s+baat|insan\s+se|manus)\b",

            r"\b(transfer\s+(me|call)|connect\s+me)\b",

        ]

        frustration_keywords = [r"\b(useless|stupid|bakwaas|pagal|shut\s+up)\b"]



        for pat in transfer_keywords:

            if re.search(pat, text_lower):

                return True

        for pat in frustration_keywords:

            if re.search(pat, text_lower):

                return True

        return False



    def _is_echo(self, user_text: str) -> bool:

        """Check if incoming transcript is acoustic echo from agent's recent speech."""

        if not user_text or not self._recent_agent_replies:

            return False

        import difflib

        u_clean = re.sub(r"[^\w\s]", "", user_text.lower()).strip()

        # Conversational turns (< 25 chars) like "namaste", "haan boliye", "theek hai" must never be dropped as echo
        if len(u_clean) < 25:
            return False

        for recent_agent in reversed(self._recent_agent_replies[-3:]):
            a_clean = re.sub(r"[^\w\s]", "", recent_agent.lower()).strip()
            if not a_clean or len(a_clean) < 20:
                continue

            # Only flag as echo if a long sentence matches over 75% of recent agent speech
            if u_clean in a_clean and (len(u_clean) / len(a_clean)) > 0.75:
                logger.warning(f"[ECHO GUARD] Dropped transcript matching substantial agent speech: '{user_text}'")
                return True

            ratio = difflib.SequenceMatcher(None, u_clean, a_clean).ratio()
            if ratio > 0.85:
                logger.warning(f"[ECHO GUARD] Dropped transcript (similarity {ratio:.2f}): '{user_text}'")
                return True

        return False



    def _is_looping_reply(self, new_reply: str) -> bool:

        """Check if newly generated reply is >80% similar to any of the last 3 agent turns."""

        if not new_reply.strip() or not self._recent_agent_replies:

            return False

        import difflib

        r_clean = re.sub(r"[^\w\s]", "", new_reply.lower()).strip()

        if len(r_clean) < 6:

            return False

        for prev in reversed(self._recent_agent_replies[-3:]):

            p_clean = re.sub(r"[^\w\s]", "", prev.lower()).strip()

            if not p_clean:

                continue

            ratio = difflib.SequenceMatcher(None, r_clean, p_clean).ratio()

            if ratio >= 0.80:

                logger.warning(f"[LOOP BREAKER] Repetitive response detected ({ratio:.2f} similarity to previous turn).")

                return True

        return False



    def _synthesize_tool_summary(

        self,

        tool_call: Dict[str, Any],

        tool_output: str,

        detected_lang: str,

    ) -> str:

        """Produce a conversational natural verbal answer from tool execution result."""

        tool_name = tool_call.get("name", "")

        try:

            data = json.loads(tool_output) if isinstance(tool_output, str) else tool_output

        except Exception:

            data = {}



        if tool_name == "check_availability":

            slots = data.get("available_slots", [])

            slots_str = ", ".join(slots[:3]) if slots else "10:30 AM, 12:00 PM"

            if detected_lang == "mr":

                return f"होय, उद्या डॉ. शर्मा यांच्याकडे {slots_str} या वेळा उपलब्ध आहेत. आपण कोणती वेळ निश्चित करू इच्छिता?"

            elif detected_lang == "hi":

                return f"जी, डॉक्टर शर्मा के पास कल {slots_str} के समय स्लॉट उपलब्ध हैं। क्या मैं इनमें से कोई समय आपके लिए बुक कर दूँ?"

            else:

                return f"Yes, Dr. Sharma has open appointment slots tomorrow at {slots_str}. Would you like me to book one for you?"



        elif tool_name == "book_appointment":

            app_id = data.get("appointment_id", "")

            if detected_lang == "mr":

                return f"आपली भेट यशस्वीरित्या निश्चित करण्यात आली आहे! अपॉइंटमेंट क्रमांक {app_id} आहे. आणखी काही मदत हवी आहे का?"

            elif detected_lang == "hi":

                return f"बधाई हो! आपकी अपॉइंटमेंट सफलतापूर्वक बुक हो गई है। अपॉइंटमेंट आईडी {app_id} है। क्या मैं आपकी कुछ और मदद कर सकती हूँ?"

            else:

                return f"Your appointment has been successfully booked with reference ID {app_id}. Is there anything else I can help you with?"



        elif tool_name == "transfer_call":

            if detected_lang == "mr":

                return "कृपया थोडा वेळ थांबा, मी आपला कॉल आमच्या प्रतिनिधीशी जोडून देत आहे."

            elif detected_lang == "hi":

                return "कृपया लाइन पर बने रहें, मैं आपकी कॉल हमारे सीनियर रिसेप्शनिस्ट को ट्रांसफर कर रही हूँ।"

            else:

                return "Please hold on while I transfer your call to our human representative."



        return data.get("message", "जी, मैंने जानकारी चेक कर ली है।")



    async def _handle_tool_execution(

        self,

        tool_call: Dict[str, Any],

        detected_lang: str,

    ) -> str:

        """Validate tool schema, allowlist, rate limits, and confirmation, speak filler, and execute."""

        tool_name = tool_call.get("name", "")

        args = tool_call.get("arguments", {})



        # Safety Guardrail: Tool Call Validation

        tool_obj = self.tools.get_tool(tool_name)

        if not hasattr(self, "_call_tool_count"):

            self._call_tool_count = 0



        allowed_tools = self.prompt_manager.config.get("tools") if self.prompt_manager else None

        is_valid, validation_err = ToolCallValidator.validate_tool_call(

            tool=tool_obj or tool_name,

            args=args,

            allowed_tools=allowed_tools,

            call_tool_count=self._call_tool_count,

            max_tool_calls=5,

            caller_transcript_history=self._transcript_history,

        )

        if not is_valid:

            logger.warning(f"[{self.call_id}] Tool validation blocked '{tool_name}': {validation_err}")

            return json.dumps({"success": False, "error": validation_err}, ensure_ascii=False)



        self._call_tool_count += 1



        # Speak short filler so there is no dead silence while tool runs

        filler = self.tools.get_filler_phrase(language=detected_lang)

        logger.info(f"Speaking filler line for tool '{tool_name}': '{filler}'")

        await self._speak_phrase(filler, language=detected_lang)



        # Execute tool

        result = await self.tools.execute(tool_name, args, timeout_sec=6.0)

        return json.dumps(result, ensure_ascii=False)



    async def _generate_and_speak(

        self,

        user_text: str,

        detected_lang: str,

        speech_end_time: float,

        stt_latency_ms: float,

    ) -> None:

        """Coordinate RAG retrieval, Tool Calling, LLM generation, and streaming TTS."""

        self._set_state(AgentState.THINKING)

        self._interrupted_turn = False

        self._current_agent_reply = []

        self._turn_count += 1



        # Guarantee conversation memory integrity: user turn must be present in session

        safe_user_text = SecuritySanitizer.redact(user_text)

        if self.session and (not self.session.messages or self.session.messages[-1].content != safe_user_text):

            self.session.add_user_message(safe_user_text)



        # A. Strict PCI-DSS Credential Protection Rule

        if SecuritySanitizer.contains_credential_disclosure(user_text):

            logger.warning("[PCI-DSS GUARD] Intercepted payment credential disclosure from caller.")

            warning_msg = SecuritySanitizer.get_security_warning(detected_lang)

            self._current_agent_reply.append(warning_msg)

            self._record_transcript("agent", warning_msg)

            await self._speak_phrase(warning_msg, language=detected_lang)

            self._set_state(AgentState.LISTENING)

            return



        # Strict Not-Interested / Disconnect Request Rule

        if NotInterestedDetector.is_not_interested(user_text):

            logger.info(f'[{self.call_id}] Caller declined / not interested: \'{user_text}\'. Initiating polite farewell and hangup.')

            farewell = NotInterestedDetector.get_polite_farewell(detected_lang)

            self._current_agent_reply.append(farewell)

            self._record_transcript('agent', farewell)

            await self._speak_phrase(farewell, language=detected_lang)

            if self.player:

                self.player.wait_until_done(timeout=4.0)

            self._set_state(AgentState.DISCONNECTED)

            if self.session:

                self.session.call_outcome = 'not_interested'

            try:

                await self.telephony.hangup(self.call_id, reason="user_not_interested")

            except Exception as e:

                logger.warning(f'Error during telephony hangup: {e}')

            return



        # Sincere AI Disclosure Rule

        if AIDisclosureGuard.is_ai_inquiry(user_text):

            logger.info(f"[{self.call_id}] Caller asked about AI identity: '{user_text}'. Providing transparent disclosure.")

            disclosure = AIDisclosureGuard.get_disclosure_response(detected_lang)

            self._current_agent_reply.append(disclosure)

            self._record_transcript("agent", disclosure)

            await self._speak_phrase(disclosure, language=detected_lang)

            self._set_state(AgentState.LISTENING)

            return



        # B. Strict Do-Not-Call (DNC) Rule

        if DoNotCallRegistry.is_dnc_requested(user_text):

            caller_num = getattr(self, "caller_number", None) or self.call_id

            DoNotCallRegistry.add_number(caller_num, reason="Caller explicitly requested DNC")

            dnc_farewell = (

                "आपला नंबर डू-नॉट-कॉल यादीत जोडला गेला आहे. भविष्यात आपणास कोणताही कॉल येणार नाही. धन्यवाद!"

                if "mr" in detected_lang

                else (

                    "आपका नंबर Do-Not-Call लिस्ट में जोड़ दिया गया है। भविष्य में आपको कोई कॉल नहीं आएगा। धन्यवाद!"

                    if "hi" in detected_lang

                    else "Your number has been added to our Do-Not-Call list. You will not receive further calls from us. Thank you."

                )

            )

            self._record_transcript("agent", dnc_farewell)

            await self._speak_phrase(dnc_farewell, language=detected_lang)

            self._set_state(AgentState.DISCONNECTED)

            return



        # 1. Check Voicemail / AMD

        amd_conf = self.prompt_manager.config.get("amd", {}) if self.prompt_manager else {}

        if amd_conf.get("enabled", True) and self._check_answering_machine(user_text):

            policy = amd_conf.get("policy", "hangup")

            if policy == "leave_message":

                msg = amd_conf.get(

                    "leave_message_text",

                    "Aarogya Dental Care se call tha. Please call us back.",

                )

                self._record_transcript("agent", msg)

                await self._speak_phrase(msg, language=detected_lang)

            self._set_state(AgentState.DISCONNECTED)

            return



        # 2. Check Recording Consent Revocation

        if self._check_recording_revocation(user_text):

            revoke_ack = (

                "Recording band kar di gayi hai. Main aapki kya madad kar sakti hoon?"

                if "hi" in detected_lang

                else "Recording has been stopped. How can I assist you?"

            )

            self._record_transcript("agent", revoke_ack)

            await self._speak_phrase(revoke_ack, language=detected_lang)

            self._set_state(AgentState.LISTENING)

            return



        # 3. Check Human Transfer Trigger

        transfer_conf = (

            self.prompt_manager.config.get("transfer", {}) if self.prompt_manager else {}

        )

        dest_number = transfer_conf.get("human_operator_number", "+919876543210")



        if self._check_human_transfer_requested(user_text) or self._consecutive_failures >= 2:

            logger.info("Human transfer triggered. Calling transfer_call tool.")

            transfer_tool = self.tools.get_tool("transfer_call")

            if transfer_tool:

                transfer_tool.telephony_provider = self.telephony

                transfer_tool.call_id = self.call_id

                res = await transfer_tool.execute(

                    destination=dest_number, reason="Caller requested operator"

                )

                msg = res.get("message", "Connecting you to our team.")

                self._record_transcript("agent", msg)

                await self._speak_phrase(msg, language=detected_lang)

                self._set_state(AgentState.DISCONNECTED if res.get("success") else AgentState.LISTENING)

                return



        # 4. RAG Retrieval (<150ms)

        rag_conf = self.prompt_manager.config.get("rag", {}) if self.prompt_manager else {}

        retrieved_context = ""

        if rag_conf.get("enabled", True):

            top_docs = self.rag.search(user_text, top_k=rag_conf.get("top_k", 2))

            if top_docs:

                chunks_text = "\n---\n".join([d[0]["text"] for d in top_docs])

                retrieved_context = f"\n\n=== RETRIEVED KNOWLEDGE BASE ===\n{chunks_text}\n================================"



        turn_start_time = speech_end_time

        llm_first_token_time: Optional[float] = None

        tts_first_audio_time: Optional[float] = None



        def on_first_audio() -> None:

            nonlocal tts_first_audio_time

            tts_first_audio_time = time.perf_counter()

            self._set_state(AgentState.SPEAKING)



        if self.player:

            self.player.on_first_audio = on_first_audio

            self.player.reset_first_audio_flag()



        # Tools schemas

        tools_conf = (

            self.prompt_manager.config.get("tools", {}).get("enabled")

            if self.prompt_manager

            else None

        )

        tool_schemas = self.tools.get_schemas(tools_conf) if tools_conf else None



        chunker = SentenceChunker()

        sentence_queue: asyncio.Queue[Optional[str]] = asyncio.Queue()



        async def tts_worker() -> None:

            try:

                while True:

                    sentence = await sentence_queue.get()

                    if sentence is None or self._interrupted_turn:

                        sentence_queue.task_done()

                        break

                    norm = TextNormalizer.normalize(sentence, language=detected_lang)

                    if norm.strip() and not self._interrupted_turn:

                        self._set_state(AgentState.SPEAKING)

                        if hasattr(self.telephony, "send_sentence"):

                            await self.telephony.send_sentence(norm)

                        if self.tts:

                            async for chunk in self.fallback_manager.stream_tts_with_fallback(

                                self.tts, self.fallback_tts, norm, language=detected_lang

                            ):

                                if self._interrupted_turn:

                                    break

                                if self._agent_wav_fp:

                                    try:

                                        self._agent_wav_fp.writeframes(chunk)

                                    except Exception:

                                        pass

                                if self.player:

                                    self.player.enqueue(chunk)

                                if self.telephony:

                                    try:

                                        await self.telephony.audio_out(chunk, associated_text=norm)

                                    except TypeError:

                                        await self.telephony.audio_out(chunk)

                    sentence_queue.task_done()

            except asyncio.CancelledError:

                pass



        tts_task = asyncio.create_task(tts_worker())



        system_prompt = (

            (self.session.get_system_prompt() if hasattr(self.session, "get_system_prompt") else self.session.system_prompt)

            + retrieved_context

            if self.session

            else ""

        )

        recorded_tool_calls = []



        # Filler delay guard: speak thinking filler if LLM takes > filler_delay_ms

        filler_fired = False
        if self.filler_delay_ms == 800:
            fillers_setting = (
                self.prompt_manager.config.get("fillers", "off")
                if self.prompt_manager
                else "off"
            )
            self.fillers_enabled = (fillers_setting not in ("off", False, "false"))
        async def filler_delay_guard() -> None:
            if not self.fillers_enabled:
                return

            nonlocal filler_fired

            try:

                await asyncio.sleep(self.filler_delay_ms / 1000.0)

                if (

                    not self._interrupted_turn

                    and llm_first_token_time is None

                    and self.state == AgentState.THINKING

                ):

                    filler = self.filler_manager.get_filler("thinking", language=detected_lang)

                    logger.info(

                        f"LLM delay exceeded {self.filler_delay_ms}ms. Speaking thinking filler: '{filler}'"

                    )

                    filler_fired = True

                    await self._speak_phrase(filler, language=detected_lang)

            except asyncio.CancelledError:

                pass



        filler_guard_task = asyncio.create_task(filler_delay_guard())



        try:

            async for chunk in self.fallback_manager.generate_llm_with_fallback(

                self.llm,

                self.fallback_llm,

                messages=self.session.get_history() if self.session else [],

                system_prompt=system_prompt,

                tools=tool_schemas,

                language=detected_lang,

            ):

                if not filler_guard_task.done():

                    filler_guard_task.cancel()



                if self._interrupted_turn:

                    break



                # If LLM decided to invoke a tool

                if isinstance(chunk, dict) and chunk.get("type") == "tool_call":

                    recorded_tool_calls.append(chunk)

                    tool_output = await self._handle_tool_execution(

                        chunk, detected_lang=detected_lang

                    )



                    # Append tool result to session history

                    if self.session:

                        self.session.messages.append(

                            ChatMessage(

                                role="user",

                                content=f"Tool '{chunk['name']}' returned: {tool_output}",

                            )

                        )



                    # Second pass: let LLM summarize tool output for caller

                    async for follow_token in self.fallback_manager.generate_llm_with_fallback(

                        self.llm,

                        self.fallback_llm,

                        messages=self.session.get_history() if self.session else [],

                        system_prompt=system_prompt,

                        language=detected_lang,

                    ):

                        if self._interrupted_turn:

                            break

                        if isinstance(follow_token, str):

                            self._current_agent_reply.append(follow_token)

                            for s in chunker.add_token(follow_token):

                                await sentence_queue.put(s)

                    break



                elif isinstance(chunk, str):

                    if llm_first_token_time is None:

                        llm_first_token_time = time.perf_counter()

                        self._set_state(AgentState.SPEAKING)

                    self._current_agent_reply.append(chunk)

                    for s in chunker.add_token(chunk):

                        await sentence_queue.put(s)



            if not self._interrupted_turn:

                # If a tool ran but LLM gave no follow-up text, guarantee a verbal summary

                if recorded_tool_calls and not "".join(self._current_agent_reply).strip():

                    tool_summary = self._synthesize_tool_summary(

                        recorded_tool_calls[-1], tool_output, detected_lang

                    )

                    self._current_agent_reply.append(tool_summary)

                    for s in chunker.add_token(tool_summary):

                        await sentence_queue.put(s)



                for trailing in chunker.flush():

                    await sentence_queue.put(trailing)



            await sentence_queue.put(None)

            await tts_task



        except asyncio.CancelledError:

            tts_task.cancel()

            return

        finally:

            if not filler_guard_task.done():

                filler_guard_task.cancel()

            if not tts_task.done():

                tts_task.cancel()



        if self._interrupted_turn:

            return



        if self.player:

            self.player.wait_until_done(timeout=15.0)



        now = time.perf_counter()

        agent_text = "".join(self._current_agent_reply).strip()



        # Loop breaker: detect if agent is repeating itself (>80% similarity to recent turns)

        if self._is_looping_reply(agent_text):

            self._consecutive_loop_count += 1

            if self._consecutive_loop_count >= 2:

                logger.warning("[LOOP BREAKER] Triggering anti-repetition conversational recovery.")

                if detected_lang == "mr":

                    agent_text = "माफ करा, मी पुन्हा तेच बोलत आहे. मी आपल्याला दुसऱ्या विषयात कशी मदत करू, की अधिकाऱ्यांशी जोडून देऊ?"

                elif detected_lang == "hi":

                    agent_text = "क्षमा करें, मैं वही बात दोहरा रही थी। क्या मैं किसी और विषय पर आपकी मदद करूँ, या हमारे प्रतिनिधि से बात करवा दूँ?"

                else:

                    agent_text = "I apologize for repeating that. Would you like assistance on a different topic, or shall I connect you with our human team?"

                self._consecutive_loop_count = 0

                await self._speak_phrase(agent_text, language=detected_lang)

        else:

            self._consecutive_loop_count = 0



        if agent_text:

            self._recent_agent_replies.append(agent_text)

            if len(self._recent_agent_replies) > 5:

                self._recent_agent_replies.pop(0)



        if self.session:

            self.session.add_assistant_message(agent_text)



        llm_ttft_ms = (

            (llm_first_token_time - speech_end_time) * 1000 if llm_first_token_time else 0.0

        )

        first_audio_ms = (

            (tts_first_audio_time - speech_end_time) * 1000 if tts_first_audio_time else 0.0

        )

        tts_first_chunk_ms = (

            (tts_first_audio_time - llm_first_token_time) * 1000

            if tts_first_audio_time and llm_first_token_time

            else 0.0

        )



        latency_breakdown = {

            "stt_ms": round(stt_latency_ms, 1),

            "llm_ttft_ms": round(llm_ttft_ms, 1),

            "tts_first_chunk_ms": round(tts_first_chunk_ms, 1),

            "first_audio_ms": round(first_audio_ms, 1),

            "total_ms": round((now - turn_start_time) * 1000, 1),

        }



        self._record_transcript(

            "agent",

            agent_text,

            latency=latency_breakdown,

            tool_calls=recorded_tool_calls or None,

        )

        self._print_latency_report(latency_breakdown, detected_lang)

        # Validate generated agent reply against strict language lock in <10ms
        from agent.languages import LanguageValidator
        val_res = LanguageValidator.validate(agent_text, self.current_language)
        if not val_res.valid:
            logger.warning(f"[{self.call_id}] Strict language lock violation ({val_res.execution_time_ms:.2f}ms): {val_res.violation_reason}")
            self._language_violations_count += 1

        # Check if conversation concluded with a polite sign-off or goodbye
        closing_markers = [
            "दिन शुभ हो", "काळजी घ्या", "दिवस चांगला जावो", "have a wonderful day",
            "have a great day", "take good care", "bye", "goodbye"
        ]
        is_closing = any(m in agent_text.lower() for m in closing_markers) or (
            self.session and getattr(self.session, "call_outcome", None) in ("not_interested", "booked")
        )
        if is_closing and self._turn_count >= 1:
            logger.info(f"[{self.call_id}] Final sign-off completed: '{agent_text}'. Disconnecting call.")
            self._set_state(AgentState.DISCONNECTED)
            if self.session and not getattr(self.session, "call_outcome", None):
                self.session.call_outcome = "completed"
            try:
                await self.telephony.hangup(self.call_id, reason="call_completed")
            except Exception as e:
                logger.warning(f"Error during final hangup: {e}")
            return

        self._set_state(AgentState.LISTENING)
        words = (agent_text or "").split()
        est_duration = max(3.0, len(words) / 2.3 + 1.5) if words else 3.0
        self._last_user_activity_time = time.time() + est_duration
        self._silence_prompt_count = 0
        self._consecutive_failures = 0



    def _print_latency_report(self, latencies: dict, lang: str) -> None:

        self._all_latencies.append(latencies)

        print(

            f"\n\033[92m⚡ [LATENCY BREAKDOWN] SpeechEnd->STT: {latencies.get('stt_ms', 0)}ms | "

            f"STT->LLM: {latencies.get('llm_ttft_ms', 0)}ms | "

            f"LLM->TTS: {latencies.get('tts_first_chunk_ms', 0)}ms | "

            f"SpeechEnd->Audio: {latencies.get('first_audio_ms', 0)}ms | "

            f"TOTAL: {latencies.get('total_ms', 0)}ms | Lang: {lang}\033[0m\n"

        )



    def print_session_summary(self) -> None:

        """Display aggregated metrics box and save metrics to JSON file."""

        first_audio_vals = [

            l["first_audio_ms"] for l in self._all_latencies if l.get("first_audio_ms", 0) > 0

        ]

        llm_ttft_vals = [

            l["llm_ttft_ms"] for l in self._all_latencies if l.get("llm_ttft_ms", 0) > 0

        ]

        avg_latency = (

            sum(first_audio_vals) / len(first_audio_vals) if first_audio_vals else 0.0

        )

        worst_latency = max(first_audio_vals) if first_audio_vals else 0.0

        best_latency = min(first_audio_vals) if first_audio_vals else 0.0

        avg_llm = sum(llm_ttft_vals) / len(llm_ttft_vals) if llm_ttft_vals else 0.0



        summary_box = f"""

╔═════════════════════════════════════════════════════════════════╗

║                   VOICE SESSION METRICS SUMMARY                 ║

╠═════════════════════════════════════════════════════════════════╣

║  Total Spoken Turns:         {len(self._all_latencies):<34} ║

║  Total Caller Interruptions: {self._interruption_count:<34} ║

║  Avg First-Audio Latency:    {avg_latency:>6.1f} ms                       ║

║  Worst First-Audio Latency:  {worst_latency:>6.1f} ms                       ║

║  Best First-Audio Latency:   {best_latency:>6.1f} ms                       ║

║  Avg LLM First Token (TTFT): {avg_llm:>6.1f} ms                       ║

╚═════════════════════════════════════════════════════════════════╝

"""

        try:

            print(summary_box)

        except Exception:

            ascii_box = summary_box.encode("ascii", errors="replace").decode("ascii")

            try:

                print(ascii_box)

            except Exception:

                pass



        # Save metrics to JSON log files

        metrics_payload = {

            "session_id": self.call_id,

            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),

            "total_turns": len(self._all_latencies),

            "interruptions": self._interruption_count,

            "avg_latency_ms": round(avg_latency, 1),

            "worst_latency_ms": round(worst_latency, 1),

            "best_latency_ms": round(best_latency, 1),

            "avg_llm_ttft_ms": round(avg_llm, 1),

            "turns": self._all_latencies,

        }



        # 1. Primary metrics log in metrics/session_<timestamp>.json

        session_ts = int(time.time())

        primary_metrics_file = self.metrics_dir / f"session_{session_ts}.json"

        try:

            with open(primary_metrics_file, "w", encoding="utf-8") as f:

                json.dump(metrics_payload, f, indent=2)

            logger.info(f"Per-turn session metrics saved to {primary_metrics_file}")

            print(f"📊 Detailed metrics saved to: {primary_metrics_file}")

        except Exception as e:

            logger.error(f"Error saving primary metrics: {e}")



        # 2. Transcripts directory metrics copy

        metrics_file = self.transcripts_dir / f"metrics_{self.call_id}.json"

        try:

            with open(metrics_file, "w", encoding="utf-8") as f:

                json.dump(metrics_payload, f, indent=2)

            logger.info(f"Session metrics saved to {metrics_file}")

        except Exception as e:

            logger.error(f"Error saving transcripts metrics: {e}")



        # 3. Dedicated per-call report in metrics/call_<id>.json

        call_metrics_file = self.metrics_dir / f"call_{self.call_id}.json"

        call_report = {

            "call_id": self.call_id,

            "provider": self.telephony.__class__.__name__ if self.telephony else "local",

            "duration_sec": round(time.time() - getattr(self, "_loop_start_time", time.time()), 2),

            "end_reason": getattr(self, "end_reason", "completed"),

            "total_turns": len(self._all_latencies),

            "barge_in_count": self._interruption_count,

            "avg_first_audio_ms": round(avg_latency, 1),

            "worst_first_audio_ms": round(worst_latency, 1),

            "best_first_audio_ms": round(best_latency, 1),

            "avg_llm_ttft_ms": round(avg_llm, 1),

            "turns": self._all_latencies,

            "transcript": [asdict(e) for e in self._transcript_history],

        }

        try:

            with open(call_metrics_file, "w", encoding="utf-8") as f:

                json.dump(call_report, f, ensure_ascii=False, indent=2)

            logger.info(f"Per-call report saved to {call_metrics_file}")

            print(f"📞 Per-call report saved to: {call_metrics_file}")

        except Exception as e:

            logger.error(f"Error saving call report: {e}")



    async def handle_dtmf_digit(self, digit: str) -> dict:

        """Handle incoming DTMF keypad digit from Twilio, Exotel, or Web."""

        logger.info(f"[{self.call_id}] Processing DTMF keypress: {digit}")

        result = self.dtmf_handler.process_digit(digit)



        displayed_digit = "****" if result.is_sensitive else result.digit

        self._record_transcript(

            role="user",

            text=f"[DTMF Key: {displayed_digit} | Action: {result.action or 'none'}]",

        )

        if self.session:

            self.session.add_user_message(f"[DTMF Input: {displayed_digit}]")



        prompt = result.prompt
        if not prompt and result.action:
            lang = (self.current_language or "en").split("-")[0].lower()
            if result.action == "confirm":
                prompt = (
                    "धन्यवाद! आपका 5G रिचार्ज प्लान सफलतापूर्वक कन्फर्म कर दिया गया है। क्या मैं आपको पेमेंट लिंक भेज दूँ?"
                    if lang == "hi"
                    else (
                        "धन्यवाद! तुमचा 5G रिचार्ज प्लॅन यशस्वीरीत्या कन्फर्म करण्यात आला आहे. मी आपल्याला पेमेंट लिंक पाठवू का?"
                        if lang == "mr"
                        else "Thank you! Your 5G recharge plan has been confirmed. Shall I send you the payment link?"
                    )
                )
            elif result.action == "callback":
                prompt = (
                    "जी बिल्कुल! हमने आपका कॉलबैक शेड्यूल कर दिया है। हमारी टीम जल्द ही आपसे संपर्क करेगी। धन्यवाद!"
                    if lang == "hi"
                    else (
                        "हो नक्कीच! आम्ही तुमचा कॉलबॅक शेड्यूल केला आहे. आमची टीम लवकरच आपल्याशी संपर्क करेल. धन्यवाद!"
                        if lang == "mr"
                        else "Certainly! We have scheduled a callback for you. Our team will contact you shortly. Thank you!"
                    )
                )
            elif result.action == "transfer_human":
                prompt = (
                    "मैं आपकी कॉल हमारे सीनियर कस्टमर सपोर्ट एग्जीक्यूटिव को ट्रांसफर कर रही हूँ। कृपया लाइन पर बने रहें।"
                    if lang == "hi"
                    else (
                        "मी आपला कॉल आमच्या वरिष्ठ ग्राहक सेवा प्रतिनिधीकडे ट्रान्सफर करत आहे. कृपया लाईनवर रहा."
                        if lang == "mr"
                        else "Connecting your call to our senior customer support executive. Please stay on the line."
                    )
                )

        if prompt:
            self._record_transcript("agent", prompt)
            self._set_state(AgentState.SPEAKING)
            await self._speak_phrase(prompt, language=self.current_language)
            self._set_state(AgentState.LISTENING)



        if result.action == "transfer_human" and self.telephony:

            try:

                logger.info(f"[{self.call_id}] DTMF triggered live call transfer to human operator.")

                await self.telephony.transfer_call(self.call_id, "human_support_queue")

            except Exception as e:

                logger.error(f"[{self.call_id}] Failed to transfer call on DTMF: {e}")



        return {

            "status": result.status,

            "digit": displayed_digit,

            "action": result.action,

            "retries_used": result.retries_used,

        }



    async def _handle_silence_timeout(self) -> bool:

        if self.state in (AgentState.DISCONNECTED,):

            return True

        if self.session and getattr(self.session, "call_outcome", None) == "not_interested":

            return True

        if self.state in (AgentState.SPEAKING, AgentState.THINKING):

            return False



        silence_duration = time.time() - self._last_user_activity_time

        lang = self.current_language.split("-")[0].lower()



        # Level 1 Reprompt in active language

        if self._silence_prompt_count == 0 and silence_duration >= self.silence_timeout_sec:

            self._silence_prompt_count += 1

            logger.info("Silence timeout (level 1): Prompting user in active language.")

            prompts = {

                "hi": "क्या आप वहां हैं? मैं सुन रही हूँ, अगर आप कुछ पूछना चाहते हैं तो बता सकते हैं।",

                "en": "Hello, are you there? I am here to help whenever you are ready.",

                "mr": "हॅलो, आपण तिथे आहात का? मी ऐकत आहे, काही विचारायचे असल्यास विचारू शकता.",

            }

            prompt_text = prompts.get(lang, prompts["en"])

            self._record_transcript("agent", prompt_text)

            self._set_state(AgentState.SPEAKING)

            await self._speak_phrase(prompt_text, language=lang)

            if self.player:

                self.player.wait_until_done(timeout=4.0)

            words = prompt_text.split()

            est_duration = max(3.0, len(words) / 2.3 + 1.5)

            self._last_user_activity_time = time.time() + est_duration

            self._set_state(AgentState.LISTENING)

            return False



        # Level 2 Goodbye in active language

        elif (

            self._silence_prompt_count == 1

            and silence_duration >= self.second_silence_timeout_sec

        ):

            logger.info("Silence timeout (level 2): Ending call gracefully in active language.")

            farewells = {

                "hi": "लगता है आप व्यस्त हैं। कॉल करने के लिए धन्यवाद, आपका दिन शुभ हो!",

                "en": "It seems you may be away. Thank you for reaching out, have a great day!",

                "mr": "आपण व्यस्त आहात असे दिसते. कॉल केल्याबद्दल धन्यवाद, काळजी घ्या!",

            }

            farewell = farewells.get(lang, farewells["en"])

            self._record_transcript("agent", farewell)

            self._set_state(AgentState.SPEAKING)

            await self._speak_phrase(farewell, language=lang)

            if self.player:

                self.player.wait_until_done(timeout=4.0)

            self._set_state(AgentState.DISCONNECTED)

            return True



        return False



    async def run_loop(self, audio_in_stream: AsyncIterator[bytes]) -> None:

        """Main conversation loop processing streaming incoming audio."""

        # Initialize DB tables

        db = get_db()

        await db.init_db()



        loop_start_time = time.time()

        self._loop_start_time = loop_start_time

        self._set_state(AgentState.SPEAKING)

        await self.speak_greeting()



        async def stt_event_listener():

            if not self.stt:

                return

            async for event in self.stt.stream_events():

                if not event.is_final:

                    self._latest_partial_transcript = event.text.strip()

                    if self.debug and self._latest_partial_transcript:

                        print(

                            f"\r\033[K\033[90m[Interim STT]: {self._latest_partial_transcript}\033[0m",

                            end="",

                            flush=True,

                        )

                elif event.is_final and event.text.strip():

                    self._latest_partial_transcript = ""

                    user_text = event.text.strip()



                    # 1. Deduplication guard: ignore identical transcript within 2 seconds

                    now_time = time.time()

                    if (

                        user_text == self._last_caller_transcript

                        and (now_time - self._last_caller_transcript_time) < 2.0

                    ):

                        logger.info(f"[DEDUPE GUARD] Dropped duplicate transcript within 2.0s: '{user_text}'")

                        continue



                    # 2. Echo guard: ignore user transcript matching agent's recent speech

                    if self._is_echo(user_text):

                        logger.warning(f"[ECHO GUARD] Dropped transcript matching agent echo: '{user_text}'")

                        continue



                    # 3. Speech during agent speaking state

                    if self.state == AgentState.SPEAKING:

                        if len(user_text.split()) < 2 and user_text.lower() in self.backchannel_words:

                            logger.info(f"[BACKCHANNEL] Ignored brief backchannel during agent speech: '{user_text}'")

                            continue

                        self.trigger_barge_in()



                    self._last_caller_transcript = user_text

                    self._last_caller_transcript_time = now_time



                    if self.debug:

                        print(f"\r\033[K\033[96m[Final STT]: {user_text}\033[0m")

                    else:

                        logger.info(f"User transcription (final): '{user_text}'")



                    # 4. Prompt injection & safety guardrail check

                    is_injection, inj_cat, polite_refusal = VoiceInjectionDetector.detect_injection(

                        user_text, language=self.current_language

                    )

                    if is_injection:

                        logger.warning(

                            f"[{self.call_id}] Prompt injection blocked ({inj_cat}): '{user_text}'"

                        )

                        if not hasattr(self, "_flag_reasons"):

                            self._flag_reasons = []

                        self._flag_reasons.append(f"injection_attempt:{inj_cat}")

                        self._last_user_activity_time = time.time()

                        self._silence_prompt_count = 0

                        self._record_transcript("caller", user_text)

                        self._record_transcript("agent", polite_refusal)

                        self._set_state(AgentState.SPEAKING)

                        await self._speak_phrase(polite_refusal, language=self.current_language)

                        if self.player:

                            self.player.wait_until_done(timeout=4.0)

                        self._set_state(AgentState.LISTENING)

                        continue



                    self._last_user_activity_time = time.time()

                    self._silence_prompt_count = 0

                    self._record_transcript("caller", user_text)



                    if not self.language_locked:

                        lang = detect_language(user_text)

                        if lang.short_code != self.current_language:

                            logger.info(

                                f"Mid-call language auto-switch: {self.current_language} -> {lang.short_code}"

                            )

                            self.current_language = lang.short_code

                            if self.session:

                                self.session.set_active_language(lang.short_code)

                            if self.tts and hasattr(self.tts, "set_language"):

                                self.tts.set_language(lang.short_code)

                            if self.stt and hasattr(self.stt, "set_language"):

                                self.stt.set_language(lang.short_code)



                    if self.session:

                        self.session.add_user_message(user_text)



                    stt_lat = event.latency_ms or 200.0

                    speech_end = time.perf_counter()



                    self._current_generation_task = asyncio.create_task(

                        self._generate_and_speak(

                            user_text=user_text,

                            detected_lang=lang.short_code,

                            speech_end_time=speech_end,

                            stt_latency_ms=stt_lat,

                        )

                    )



        stt_task = asyncio.create_task(stt_event_listener())



        try:

            async for chunk in audio_in_stream:

                if self.state == AgentState.DISCONNECTED:

                    break



                # Safety check: enforce max call duration & cost guard limits

                elapsed = time.time() - loop_start_time

                if elapsed > self.max_call_duration_sec:

                    logger.warning(

                        f"[{self.call_id}] Maximum call duration reached ({self.max_call_duration_sec}s). Ending call gracefully."

                    )

                    self.end_reason = "max_duration_exceeded"

                    closure_messages = {

                        "hi": "समय सीमा समाप्त होने के कारण यह कॉल समाप्त की जा रही है। हमसे बात करने के लिए धन्यवाद।",

                        "en": "This call has reached its duration limit. Thank you for speaking with us, goodbye.",

                        "mr": "वेळ मर्यादा संपल्यामुळे हा कॉल समाप्त होत आहे. बोलल्याबद्दल धन्यवाद.",

                    }

                    lang_key = self.current_language.split("-")[0].lower()

                    farewell = closure_messages.get(lang_key, closure_messages["en"])

                    self._record_transcript("agent", farewell)

                    try:

                        await self._speak_phrase(farewell, language=lang_key)

                        if self.player:

                            self.player.wait_until_done(timeout=3.0)

                    except Exception:

                        pass

                    self._set_state(AgentState.DISCONNECTED)

                    break



                if getattr(self, "enable_cost_guard", False) and int(elapsed) > 0 and int(elapsed) % 5 == 0:

                    est_cost_usd = (elapsed / 60.0) * 0.045

                    if est_cost_usd > self.max_call_cost_usd:

                        logger.warning(

                            f"[{self.call_id}] Cost guard reached: estimated ${est_cost_usd:.3f} > limit ${self.max_call_cost_usd:.2f} (approx {est_cost_usd * 83.0:.1f} INR). Ending call gracefully."

                        )

                        self.end_reason = "cost_guard_exceeded"

                        closure_messages = {

                            "hi": "कॉल लागत सीमा तक पहुँच गई है, इसलिए यह कॉल समाप्त की जा रही है। धन्यवाद।",

                            "en": "Call budget threshold reached. Thank you for your time, goodbye.",

                            "mr": "कॉल मर्यादा गाठल्यामुळे हा कॉल संपवला जात आहे. धन्यवाद.",

                        }

                        lang_key = self.current_language.split("-")[0].lower()

                        farewell = closure_messages.get(lang_key, closure_messages["en"])

                        self._record_transcript("agent", farewell)

                        try:

                            await self._speak_phrase(farewell, language=lang_key)

                            if self.player:

                                self.player.wait_until_done(timeout=3.0)

                        except Exception:

                            pass

                        self._set_state(AgentState.DISCONNECTED)

                        break



                # Save raw audio chunk to recording file if active

                if self.recording_enabled and self._recording_fp:

                    try:

                        self._recording_fp.write(chunk)

                    except Exception:

                        pass



                if self._caller_wav_fp:

                    try:

                        self._caller_wav_fp.writeframes(chunk)

                    except Exception:

                        pass



                # VAD, End-of-turn & Sustained Barge-in check

                is_speaking, is_end_of_turn, is_barge_in = self.vad.process_chunk(

                    chunk,

                    is_agent_speaking=(self.state == AgentState.SPEAKING),

                    partial_transcript=self._latest_partial_transcript,

                )

                if is_speaking:

                    self._last_user_activity_time = time.time()



                is_browser_call = type(getattr(self, "telephony", None)).__name__ == "BrowserWebAudioProvider"
                if is_barge_in and self.state == AgentState.SPEAKING and not is_browser_call:

                    # Check if caller spoke a short backchannel word e.g. "haan", "hmm", "ok"

                    is_backchannel = False

                    if self.ignore_backchannels and self._latest_partial_transcript:

                        tokens = [t.lower() for t in self._latest_partial_transcript.strip().split()]

                        if len(tokens) <= 2 and all(t in self.backchannel_words for t in tokens):

                            is_backchannel = True

                            logger.debug(

                                f"Ignoring short backchannel during agent speech: '{self._latest_partial_transcript}'"

                            )



                    # Check pickup collision grace period
                    is_pickup_hello = False
                    grace_window_sec = float(self.config.get("barge_in_grace_window_ms", 1500)) / 1000.0
                    time_since_greeting = time.time() - getattr(self, "_greeting_start_time", 0.0)
                    in_grace = getattr(self, "_in_greeting_grace_period", False) and (time_since_greeting < grace_window_sec)

                    if in_grace and getattr(self, "_latest_partial_transcript", ""):
                        tokens = [t.lower() for t in self._latest_partial_transcript.strip().split()]
                        if len(tokens) <= 2 and any(t in ["hello", "halo", "हॅलो", "हेलो", "हां", "हाँ", "हो", "haan", "ha"] for t in tokens):
                            is_pickup_hello = True
                            logger.info(f"[{self.call_id}] Ignoring pickup greeting collision in grace window: '{self._latest_partial_transcript}'")

                    if not is_backchannel and not is_pickup_hello:

                        self.trigger_barge_in(speech_onset_time=self.vad.barge_in_speech_start)



                if self.stt:

                    await self.stt.send_audio(chunk)



                if self.state == AgentState.LISTENING:

                    if await self._handle_silence_timeout():

                        break



        finally:

            stt_task.cancel()

            if self._current_generation_task and not self._current_generation_task.done():

                self._current_generation_task.cancel()



            # Close recording and persist reference in DB

            if self._recording_fp:

                try:

                    self._recording_fp.close()

                    await db.record_call_audio(

                        call_id=self.call_id,

                        file_path=str(self.recording_file_path),

                        consent_granted=True,

                    )

                except Exception as e:

                    logger.error(f"Error finalizing recording: {e}")

                self._recording_fp = None



            self._set_state(AgentState.DISCONNECTED)

            self.save_session_transcript()

            self.print_session_summary()



            # Launch post-call intelligence analysis in background

            duration_sec = max(time.time() - loop_start_time, 1.0)

            transcript_data = [asdict(e) for e in self._transcript_history]

            try:

                analyzer = PostCallAnalyzer(llm=self.llm)

                asyncio.create_task(

                    analyzer.analyze_call(

                        call_id=self.call_id,

                        transcript_turns=transcript_data,

                        duration_sec=duration_sec,

                        all_latencies=self._all_latencies,

                        silence_prompt_count=self._silence_prompt_count,

                        injection_flags=getattr(self, "_flag_reasons", []),

                        configured_languages=["hi", "en", "mr"],

                    )

                )

            except Exception as e:

                logger.error(f"Error initiating post-call analysis: {e}")



            # Compute and record usage & cost metrics

            try:

                tts_chars = sum(len(e.text) for e in self._transcript_history if e.role == "agent")

                prompt_tokens = sum(len(e.text.split()) for e in self._transcript_history) * 2

                completion_tokens = sum(len(e.text.split()) for e in self._transcript_history if e.role == "agent") * 2

                stt_secs = duration_sec * 0.4

                cost_calc = CostCalculator()

                breakdown = cost_calc.calculate_call_cost(

                    call_id=self.call_id,

                    duration_sec=duration_sec,

                    stt_seconds=stt_secs,

                    prompt_tokens=prompt_tokens,

                    completion_tokens=completion_tokens,

                    tts_chars=tts_chars,

                )

                asyncio.create_task(

                    db.record_usage(

                        call_id=self.call_id,

                        call_duration_sec=duration_sec,

                        stt_seconds=stt_secs,

                        llm_prompt_tokens=prompt_tokens,

                        llm_completion_tokens=completion_tokens,

                        tts_characters=tts_chars,

                        estimated_cost_usd=breakdown.total_cost_usd,

                        estimated_cost_inr=round(breakdown.total_cost_usd * 83.0, 4),

                        api_key_id=getattr(self, "api_key_id", None),

                        campaign_id=getattr(self, "campaign_id", None),

                        provider=getattr(self, "provider_name", "twilio"),

                        agent_mode=getattr(self, "agent_mode", "telecaller"),

                    )

                )

            except Exception as e:

                logger.error(f"Error computing usage metrics: {e}")



            # Dispatch HMAC-signed webhook if configured

            webhook_url = self.prompt_manager.config.get("webhook_url") if self.prompt_manager else None

            if webhook_url:

                try:

                    dispatcher = WebhookDispatcher()

                    payload = {

                        "call_id": self.call_id,

                        "duration_sec": round(duration_sec, 2),

                        "turn_count": len(self._transcript_history),

                        "transcript": transcript_data,

                        "ended_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),

                    }

                    asyncio.create_task(

                        dispatcher.dispatch_call_result(

                            target_url=webhook_url,

                            payload=payload,

                        )

                    )

                except Exception as e:

                    logger.error(f"Error dispatching completion webhook: {e}")



            if self._caller_wav_fp:

                try:

                    self._caller_wav_fp.close()

                except Exception:

                    pass

                self._caller_wav_fp = None



            if self._agent_wav_fp:

                try:

                    self._agent_wav_fp.close()

                except Exception:

                    pass

                self._agent_wav_fp = None



            logger.info("VoicePipeline loop terminated cleanly.")
