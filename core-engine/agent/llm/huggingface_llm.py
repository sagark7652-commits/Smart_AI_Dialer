"""Hugging Face Streaming LLM Implementation.

Supports open-source models (Llama 3.1, Mistral, Qwen, DeepSeek)
via Hugging Face Serverless Inference API (OpenAI-compatible router & streaming SSE).
"""

import json
from typing import Any, AsyncIterator, Dict, List, Optional, Union
import httpx
from agent.config import get_settings
from agent.llm.base import BaseLLM, ChatMessage
from agent.logger import setup_logger

logger = setup_logger("llm.huggingface")

DEFAULT_HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct"
HF_ROUTER_URL = "https://router.huggingface.co/hf-inference/v1/chat/completions"
HF_LEGACY_URL = "https://api-inference.huggingface.co/v1/chat/completions"


class HuggingFaceLLM(BaseLLM):
    """Streaming LLM using Hugging Face Serverless Inference API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        endpoint_url: Optional[str] = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or getattr(settings, "huggingface_api_key", None)
        self.model = model or getattr(settings, "huggingface_llm_model", None) or DEFAULT_HF_MODEL
        self.endpoint_url = endpoint_url or HF_ROUTER_URL

        if not self.api_key:
            logger.warning(
                "HUGGINGFACE_API_KEY is not set. HuggingFaceLLM will fail unless an active key or endpoint is configured."
            )

    async def generate_stream(
        self,
        messages: List[ChatMessage],
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> AsyncIterator[Union[str, Dict[str, Any]]]:
        """Stream generated text tokens using Hugging Face Chat Completions API."""
        if not self.api_key:
            raise ValueError(
                "HUGGINGFACE_API_KEY is missing. Please set HUGGINGFACE_API_KEY in your .env file."
            )

        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})

        for msg in messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": formatted_messages,
            "stream": True,
            "max_tokens": 150,
            "temperature": 0.3,
        }

        if tools:
            payload["tools"] = tools

        urls_to_try = [self.endpoint_url, HF_LEGACY_URL]

        async with httpx.AsyncClient(timeout=15.0) as client:
            last_err = None
            for url in urls_to_try:
                try:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        if response.status_code != 200:
                            err_body = await response.aread()
                            logger.warning(
                                f"Hugging Face endpoint {url} returned HTTP {response.status_code}: {err_body.decode('utf-8', errors='ignore')}"
                            )
                            last_err = f"HTTP {response.status_code}: {err_body.decode('utf-8', errors='ignore')}"
                            continue

                        async for line in response.aiter_lines():
                            line = line.strip()
                            if not line or not line.startswith("data:"):
                                continue

                            data_str = line[len("data:"):].strip()
                            if data_str == "[DONE]":
                                break

                            try:
                                chunk = json.loads(data_str)
                                choices = chunk.get("choices", [])
                                if not choices:
                                    continue
                                delta = choices[0].get("delta", {})

                                # Handle tool calls if returned
                                if "tool_calls" in delta and delta["tool_calls"]:
                                    yield {"tool_call": delta["tool_calls"][0]}

                                content = delta.get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                continue
                    return
                except Exception as ex:
                    last_err = ex
                    logger.debug(f"HF attempt with {url} encountered: {ex}")

            if last_err:
                logger.error(f"Hugging Face generation failed across endpoints: {last_err}")
                raise RuntimeError(f"Hugging Face LLM request failed: {last_err}")
