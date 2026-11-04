"""CallingAgentEngine: Core Python module interface for embedding into external projects."""



import asyncio

import json

from typing import Any, Dict, List, Optional

from agent.config import get_settings

from agent.db import CallModel, get_db

from agent.llm.groq_llm import GroqLLM

from agent.llm.mock_llm import MockLLM

from agent.llm.prompt_manager import AgentPromptManager

from agent.logger import setup_logger

from agent.resilience.circuit_breaker import get_circuit_registry

from agent.pipeline import VoicePipeline

from agent.stt.deepgram_stt import DeepgramSTT

from agent.stt.mock_stt import MockSTT

from agent.telephony.factory import get_telephony_provider

from agent.tts.factory import get_tts_provider

from agent.tts.mock_tts import MockTTS



logger = setup_logger("engine")





class CallingAgentEngine:

    """Provider-agnostic AI voice calling agent engine.



    Can be imported and orchestrated directly in Python applications without HTTP.

    """



    def __init__(

        self,

        config_path: str = "agent_config.yaml",

        telephony_provider: Optional[str] = None,

        tts_provider: Optional[str] = None,

        stt_provider: Optional[str] = None,

    ) -> None:

        self.settings = get_settings()

        self.config_path = config_path

        self.telephony_provider_name = telephony_provider or self.settings.telephony_provider

        self.tts_provider_name = tts_provider or self.settings.tts_provider

        self.stt_provider_name = stt_provider or self.settings.stt_provider



        self.telephony = get_telephony_provider(self.telephony_provider_name)

        self.prompt_manager = AgentPromptManager(config_path=self.config_path)

        self.db = get_db()

        self._active_calls: Dict[str, VoicePipeline] = {}



    async def initialize(self) -> None:

        """Initialize database tables and resources."""

        await self.db.init_db()

        logger.info("CallingAgentEngine initialized.")



    async def start_outbound_call(

        self,

        to_number: str,

        agent_id: Optional[str] = None,

        webhook_url: Optional[str] = None,

        max_retries: int = 3,

    ) -> str:

        """Place an outbound call with exponential backoff on transient errors."""

        await self.initialize()



        # Enforce DNC and permitted calling hours compliance before dial

        from agent.safety import CallingHoursGuard

        allowed, reason = CallingHoursGuard.validate_outbound_call(to_number)

        if not allowed:

            logger.warning(f"[OUTBOUND CALL BLOCKED] Number: {to_number[-4:].rjust(len(to_number), '*')}, Reason: {reason}")

            raise PermissionError(f"Compliance violation: {reason}")



        base_url = self.settings.public_url.rstrip("/")

        default_webhook = f"{base_url}/webhooks/{self.telephony_provider_name}/voice"

        target_webhook = webhook_url or default_webhook



        registry = get_circuit_registry()

        primary_name = self.telephony_provider_name.lower()

        primary_breaker = registry.get_breaker(primary_name)

        secondary_name = getattr(self.settings, "secondary_telephony_provider", None) or ("exotel" if primary_name == "twilio" else "twilio")

        secondary_breaker = registry.get_breaker(secondary_name)



        attempt = 0

        backoff_delay = 1.0

        last_error = None



        # 1. Try Primary Telephony Provider

        if primary_breaker.can_execute():

            while attempt < max_retries:

                attempt += 1

                try:

                    logger.info(

                        f"Initiating call to {to_number} (Attempt {attempt}/{max_retries}) via {primary_name}"

                    )

                    call_sid = await self.telephony.make_call(

                        to_number=to_number,

                        webhook_url=target_webhook,

                    )

                    primary_breaker.record_success()

                    await self.db.create_call(

                        call_id=call_sid,

                        caller_number=to_number,

                        agent_id=agent_id,

                        direction="outbound",

                        provider=primary_name,

                        status="initiated",

                    )

                    logger.info(f"Outbound call established: CallSid={call_sid} via {primary_name}")

                    return call_sid

                except Exception as e:

                    last_error = e

                    primary_breaker.record_failure(e)

                    logger.warning(

                        f"Primary provider {primary_name} attempt {attempt} failed for {to_number}: {e}."

                    )

                    if attempt < max_retries:

                        await asyncio.sleep(backoff_delay)

                        backoff_delay *= 2.0

        else:

            last_error = RuntimeError(f"Circuit breaker for primary provider '{primary_name}' is OPEN.")



        # 2. Automated Telephony Failover to Secondary Provider (Safe retry: never double-dial connected call)

        if secondary_name and secondary_breaker.can_execute():

            try:

                registry.record_fallback("telephony", primary_name, secondary_name)

                logger.warning(

                    f"[TELEPHONY FAILOVER] Primary provider '{primary_name}' failed. Retrying once via secondary '{secondary_name}'..."

                )

                from agent.telephony.factory import get_telephony_provider

                secondary_provider = get_telephony_provider(secondary_name)

                sec_webhook = f"{base_url}/webhooks/{secondary_name}/voice"

                call_sid = await secondary_provider.make_call(

                    to_number=to_number,

                    webhook_url=webhook_url or sec_webhook,

                )

                secondary_breaker.record_success()

                await self.db.create_call(

                    call_id=call_sid,

                    caller_number=to_number,

                    agent_id=agent_id,

                    direction="outbound",

                    provider=secondary_name,

                    status="initiated",

                )

                logger.info(f"Outbound call established via failover provider: CallSid={call_sid} on {secondary_name}")

                return call_sid

            except Exception as sec_err:

                secondary_breaker.record_failure(sec_err)

                logger.error(f"[TELEPHONY FAILOVER FAILED] Secondary provider '{secondary_name}' also failed: {sec_err}")

                last_error = sec_err



        logger.error(f"Failed to place call to {to_number} on primary and secondary providers: {last_error}")

        raise RuntimeError(f"Outbound call dispatch failed: {last_error}")



    async def hangup_call(self, call_id: str) -> None:

        """Terminate call via telephony provider and update database."""

        await self.telephony.hangup(call_id)

        await self.db.update_call(call_id=call_id, status="completed", end_reason="agent_hungup")



        # Clean active pipeline if present

        if call_id in self._active_calls:

            pipeline = self._active_calls.pop(call_id)

            pipeline.trigger_barge_in()



    async def get_call_details(self, call_id: str) -> Dict[str, Any]:

        """Retrieve call record, transcript turns, and latency breakdown."""

        call = await self.db.get_call(call_id)

        if not call:

            raise KeyError(f"Call with ID '{call_id}' not found.")



        transcripts = await self.db.get_transcripts(call_id)

        usage = await self.db.get_usage_for_call(call_id)

        return {

            "id": call.id,

            "agent_id": call.agent_id,

            "caller_number": call.caller_number,

            "direction": call.direction,

            "provider": call.provider,

            "status": call.status,

            "duration_sec": call.duration_sec,

            "end_reason": call.end_reason,

            "summary": call.summary,

            "sentiment": call.sentiment,

            "outcome": call.outcome,

            "cost_breakdown": usage,

            "extracted_data": json.loads(call.extracted_data) if call.extracted_data else {},

            "started_at": call.started_at.isoformat() if call.started_at else None,

            "ended_at": call.ended_at.isoformat() if call.ended_at else None,

            "transcript": [

                {

                    "turn": t.turn_index,

                    "speaker": t.speaker,

                    "text": t.text,

                    "interrupted": t.interrupted,

                    "latency": t.latency_breakdown_json,

                }

                for t in transcripts

            ],

        }



    async def list_calls(

        self,

        status: Optional[str] = None,

        provider: Optional[str] = None,

        needs_review: Optional[bool] = None,

        limit: int = 50,

        offset: int = 0,

    ) -> List[Dict[str, Any]]:

        """List call sessions with filters."""

        calls = await self.db.list_calls(

            status=status,

            provider=provider,

            needs_review=needs_review,

            limit=limit,

            offset=offset,

        )

        return [

            {

                "id": c.id,

                "agent_id": c.agent_id,

                "caller_number": c.caller_number,

                "direction": c.direction,

                "provider": c.provider,

                "status": c.status,

                "duration_sec": c.duration_sec,

                "outcome": c.outcome,

                "sentiment": c.sentiment,

                "needs_review": c.needs_review,

                "flag_reasons": json.loads(c.flag_reasons) if c.flag_reasons else [],

                "started_at": c.started_at.isoformat() if c.started_at else None,

            }

            for c in calls

        ]



    def create_pipeline(

        self,

        telephony_provider,

        call_id: str,

        variables: Optional[Dict[str, Any]] = None,

        agent_config: Optional[Dict[str, Any]] = None,

    ) -> VoicePipeline:

        """Create a new streaming VoicePipeline instance for a call session."""

        settings = get_settings()



        # STT selection: Deepgram if key available, otherwise MockSTT

        if settings.deepgram_api_key:

            stt = DeepgramSTT(sample_rate=16000)

        else:

            logger.info(f"[{call_id}] DEEPGRAM_API_KEY not configured. Using MockSTT.")

            stt = MockSTT(sample_rate=16000)



        # LLM selection: OpenAI / Groq / HuggingFace / MockLLM
        if (getattr(settings, "llm_provider", "") == "openai" or not settings.groq_api_key) and settings.openai_api_key:
            from agent.llm.openai_llm import OpenAILLM
            llm = OpenAILLM()
        elif (getattr(settings, "llm_provider", "") in ("huggingface", "hf") and getattr(settings, "huggingface_api_key", None)) or (not settings.groq_api_key and getattr(settings, "huggingface_api_key", None)):
            from agent.llm.huggingface_llm import HuggingFaceLLM
            llm = HuggingFaceLLM()
        elif settings.groq_api_key:
            llm = GroqLLM()
        elif settings.openai_api_key:
            from agent.llm.openai_llm import OpenAILLM
            llm = OpenAILLM()
        else:
            logger.info(f"[{call_id}] Cloud LLM keys not configured (OPENAI_API_KEY/GROQ_API_KEY). Using MockLLM.")
            llm = MockLLM()



        # TTS selection: OpenAI (ember/maple) / Sarvam (neer/leher) / Cartesia / MockTTS

        cfg_dict = dict(agent_config or {})

        voice_gender = cfg_dict.get("gender") or cfg_dict.get("voices", {}).get("default_agent_gender", "female")

        voice_lang = (variables and (variables.get("language") or variables.get("lang"))) or cfg_dict.get("default_language", "hi")

        cfg_dict["default_language"] = voice_lang



        if settings.openai_api_key or settings.sarvam_api_key or settings.cartesia_api_key or settings.elevenlabs_api_key:

            tts = get_tts_provider(language=voice_lang, gender=voice_gender)

        else:

            logger.info(f"[{call_id}] Cloud TTS keys not configured. Using MockTTS.")

            tts = MockTTS(gender=voice_gender)



        # Setup prompt manager with per-call variables and custom config if provided

        if variables or agent_config:

            prompt_mgr = AgentPromptManager(

                config_dict=cfg_dict,

                variables=variables,

            )

        else:

            prompt_mgr = self.prompt_manager



        pipeline = VoicePipeline(

            stt=stt,

            llm=llm,

            tts=tts,

            player=None,

            telephony=telephony_provider,

            prompt_manager=prompt_mgr,

            call_id=call_id,

        )

        self._active_calls[call_id] = pipeline

        return pipeline

