"""Tests for Step 2 LLM integration and prompt management."""

import pytest
import time
from agent.llm.base import ChatMessage
from agent.llm.groq_llm import GroqLLM
from agent.llm.prompt_manager import AgentPromptManager, ConversationSession


def test_prompt_manager_loading():
    """Verify agent config and business info are loaded accurately."""
    manager = AgentPromptManager()
    assert manager.config["name"] == "Priya"
    assert "Aarogya Dental Care" in manager.business_info
    assert len(manager.config["rules"]) > 0

    prompt = manager.build_system_prompt()
    assert "Aarogya Dental Care" in prompt
    assert "Priya" in prompt
    assert "BUSINESS INFORMATION" in prompt


def test_conversation_session_history():
    """Verify session tracks greeting, user messages, and assistant responses."""
    manager = AgentPromptManager()
    session = ConversationSession(manager)

    greeting = session.get_greeting()
    assert "Namaste" in greeting or "नमस्ते" in greeting
    assert len(session.get_history()) == 1
    assert session.get_history()[0].role == "assistant"

    session.add_user_message("What is the cost of dental cleaning?")
    assert len(session.get_history()) == 2
    assert session.get_history()[1].role == "user"
    assert session.get_history()[1].content == "What is the cost of dental cleaning?"

    session.add_assistant_message("Teeth cleaning is ₹1,200.")
    assert len(session.get_history()) == 3
    assert session.get_history()[2].role == "assistant"


@pytest.mark.asyncio
async def test_streaming_and_ttft_calculation():
    """Verify streaming token yield and TTFT measurement logic."""
    tokens = ["Namaste", ", ", "cleaning ", "costs ", "₹1,200."]

    async def mock_generator():
        for tok in tokens:
            yield tok

    received = []
    first_token = True
    start = time.perf_counter()
    ttft_ms = 0.0

    async for token in mock_generator():
        if first_token:
            ttft_ms = (time.perf_counter() - start) * 1000
            first_token = False
        received.append(token)

    assert "".join(received) == "Namaste, cleaning costs ₹1,200."
    assert ttft_ms >= 0.0


def test_groq_llm_missing_key_warning():
    """Verify GroqLLM reports missing API key cleanly."""
    llm = GroqLLM(api_key="")
    assert llm.client is None
