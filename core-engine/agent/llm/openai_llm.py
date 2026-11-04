"""OpenAI LLM implementation with streaming and tool/function calling support."""

import json
from typing import Any, AsyncIterator, Dict, List, Optional, Union
from openai import AsyncOpenAI
from agent.config import get_settings
from agent.llm.base import BaseLLM, ChatMessage
from agent.logger import setup_logger

logger = setup_logger("llm.openai")


class OpenAILLM(BaseLLM):
    """Streaming LLM implementation with tool calling support using OpenAI."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.openai_api_key
        # Default to gpt-4o-mini for low latency voice telephony
        configured_model = model or getattr(settings, "openai_model", None) or settings.llm_model
        if not configured_model or "qwen" in configured_model or "llama" in configured_model:
            self.model = "gpt-4o-mini"
        else:
            self.model = configured_model

        if not self.api_key:
            logger.warning(
                "OPENAI_API_KEY is not set. OpenAILLM will fail if called without an active key."
            )
            self.client: Optional[AsyncOpenAI] = None
        else:
            self.client = AsyncOpenAI(api_key=self.api_key)

    async def generate_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> AsyncIterator[Union[str, Dict[str, Any]]]:
        """Stream generated text tokens OR yield a tool_call event if LLM invokes a tool."""
        if not self.client:
            raise ValueError(
                "OPENAI_API_KEY is missing. Please set it in your .env file or environment."
            )

        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})

        for msg in messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})

        kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": formatted_messages,
            "stream": True,
            "temperature": 0.25,
            "max_tokens": 220,  # Capped for 1-2 spoken conversational sentences
        }

        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        try:
            stream = await self.client.chat.completions.create(**kwargs)
            tool_calls_accumulator: Dict[int, Dict[str, Any]] = {}
            in_thinking_block = False

            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                # 1. If model emitted tool calls
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_accumulator:
                            tool_calls_accumulator[idx] = {
                                "id": tc.id or "",
                                "name": tc.function.name if tc.function and tc.function.name else "",
                                "arguments": "",
                            }
                        if tc.function and tc.function.arguments:
                            tool_calls_accumulator[idx]["arguments"] += tc.function.arguments

                # 2. If model emitted text content
                elif delta.content:
                    text_chunk = delta.content
                    if "<think>" in text_chunk:
                        in_thinking_block = True
                        text_chunk = text_chunk.split("<think>")[0]
                    if in_thinking_block:
                        if "</think>" in text_chunk:
                            in_thinking_block = False
                            text_chunk = text_chunk.split("</think>")[-1]
                        else:
                            continue
                    if text_chunk:
                        yield text_chunk

            # If tool calls were accumulated, parse and yield them
            if tool_calls_accumulator:
                for tc_data in tool_calls_accumulator.values():
                    try:
                        parsed_args = json.loads(tc_data["arguments"])
                    except Exception:
                        parsed_args = {}
                    yield {
                        "type": "tool_call",
                        "id": tc_data["id"],
                        "name": tc_data["name"],
                        "arguments": parsed_args,
                    }

        except Exception as e:
            logger.error(f"Error during OpenAI generation: {e}")
            raise e
