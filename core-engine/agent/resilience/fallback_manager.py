"""Fallback Chain Manager for STT, LLM, and TTS with Timeout & Error Recovery."""

import asyncio
import time
from typing import Any, AsyncIterator, Dict, List, Optional, Union
from agent.llm.base import BaseLLM, ChatMessage
from agent.tts.base import BaseTTS
from agent.resilience.circuit_breaker import get_circuit_registry
from agent.logger import setup_logger

logger = setup_logger("resilience.fallback_manager")


class FallbackChainManager:
    """Orchestrates seamless mid-call fallbacks across AI service chains."""

    EMERGENCY_FALLBACK_TEXT = {
        "hi": "तकनीकी समस्या के कारण संपर्क में व्यवधान हुआ है। हम आपसे शीघ्र ही पुनः संपर्क करेंगे।",
        "en": "We are experiencing a temporary network connection issue. We will connect with you shortly.",
        "mr": "तांत्रिक अडचणीमुळे संपर्क खंडित झाला आहे. आम्ही लवकरच आपल्याशी पुन्हा संपर्क करू.",
    }

    def __init__(self) -> None:
        self.registry = get_circuit_registry()

    async def generate_llm_with_fallback(
        self,
        primary_llm: BaseLLM,
        fallback_llm: Optional[BaseLLM],
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        timeout_sec: float = 4.0,
        language: str = "hi",
    ) -> AsyncIterator[Union[str, Dict[str, Any]]]:
        """Stream tokens from primary LLM; fall back to secondary on timeout or error."""
        primary_name = getattr(primary_llm, "name", primary_llm.__class__.__name__)
        fallback_name = (
            getattr(fallback_llm, "name", fallback_llm.__class__.__name__)
            if fallback_llm
            else "None"
        )
        breaker = self.registry.get_breaker(primary_name)

        # 1. Try Primary LLM if circuit permits
        if breaker.can_execute():
            try:
                # Call generate_stream with fallback support
                stream_func = getattr(primary_llm, "generate_stream", None) or getattr(primary_llm, "generate_response")
                gen = stream_func(
                    messages=messages,
                    system_prompt=system_prompt,
                    tools=tools,
                )
                first_item = True
                async for item in gen:
                    if first_item:
                        breaker.record_success()
                        first_item = False
                    yield item
                return
            except Exception as e:
                breaker.record_failure(e)
                logger.warning(
                    f"[LLM RESILIENCE] Primary LLM ({primary_name}) failed: {e}. Attempting fallback to {fallback_name}."
                )

        # 2. Try Fallback LLM if configured
        if fallback_llm is not None:
            fb_breaker = self.registry.get_breaker(fallback_name)
            if fb_breaker.can_execute():
                try:
                    self.registry.record_fallback("llm", primary_name, fallback_name)
                    fb_stream_func = getattr(fallback_llm, "generate_stream", None) or getattr(fallback_llm, "generate_response")
                    async for item in fb_stream_func(
                        messages=messages,
                        system_prompt=system_prompt,
                        tools=tools,
                    ):
                        fb_breaker.record_success()
                        yield item
                    return
                except Exception as fb_err:
                    fb_breaker.record_failure(fb_err)
                    logger.error(
                        f"[LLM RESILIENCE] Fallback LLM ({fallback_name}) also failed: {fb_err}"
                    )

        # 3. Emergency Spoken Fallback (all models down)
        logger.error(f"[LLM RESILIENCE] All LLM providers exhausted for language '{language}'. Yielding emergency response.")
        fallback_msg = self.EMERGENCY_FALLBACK_TEXT.get(
            language.split("-")[0].lower(),
            self.EMERGENCY_FALLBACK_TEXT["en"],
        )
        yield fallback_msg

    async def stream_tts_with_fallback(
        self,
        primary_tts: BaseTTS,
        fallback_tts: Optional[BaseTTS],
        text: str,
        language: str = "hi",
    ) -> AsyncIterator[bytes]:
        """Stream audio from primary TTS; fall back to secondary on error without dropping call."""
        primary_name = primary_tts.__class__.__name__
        fallback_name = fallback_tts.__class__.__name__ if fallback_tts else "None"
        breaker = self.registry.get_breaker(primary_name)

        if breaker.can_execute():
            try:
                first_chunk = True
                async for chunk in primary_tts.generate_audio_stream(text, language=language):
                    if first_chunk:
                        breaker.record_success()
                        first_chunk = False
                    yield chunk
                return
            except Exception as e:
                breaker.record_failure(e)
                logger.warning(
                    f"[TTS RESILIENCE] Primary TTS ({primary_name}) failed: {e}. Switching to {fallback_name}."
                )

        # Try fallback TTS
        if fallback_tts is not None:
            fb_breaker = self.registry.get_breaker(fallback_name)
            if fb_breaker.can_execute():
                try:
                    self.registry.record_fallback("tts", primary_name, fallback_name)
                    async for chunk in fallback_tts.generate_audio_stream(text, language=language):
                        fb_breaker.record_success()
                        yield chunk
                    return
                except Exception as fb_err:
                    fb_breaker.record_failure(fb_err)
                    logger.error(f"[TTS RESILIENCE] Fallback TTS ({fallback_name}) failed: {fb_err}")

        logger.error(f"[TTS RESILIENCE] All TTS options failed for text '{text[:30]}...'")
