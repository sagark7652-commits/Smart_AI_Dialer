"""Unit tests for Hugging Face integration across LLM, TTS, Sentiment, and Embeddings."""

import pytest
from agent.config import get_settings
from agent.llm.base import ChatMessage
from agent.llm.huggingface_llm import HuggingFaceLLM
from agent.tts.factory import get_tts_provider
from agent.tts.huggingface_tts import HuggingFaceTTS
from agent.huggingface.sentiment import HuggingFaceSentimentAnalyzer
from agent.huggingface.embeddings import HuggingFaceEmbedder


def test_hf_settings_defaults():
    settings = get_settings()
    assert hasattr(settings, "huggingface_api_key")
    assert hasattr(settings, "huggingface_llm_model")
    assert settings.huggingface_llm_model == "meta-llama/Llama-3.1-8B-Instruct"
    assert settings.huggingface_tts_model == "facebook/mms-tts-eng"


def test_hf_llm_initialization():
    llm = HuggingFaceLLM(api_key="hf_test_dummy_key", model="meta-llama/Llama-3.1-8B-Instruct")
    assert llm.api_key == "hf_test_dummy_key"
    assert llm.model == "meta-llama/Llama-3.1-8B-Instruct"


@pytest.mark.asyncio
async def test_hf_llm_missing_key_raises_error():
    llm = HuggingFaceLLM(api_key="")
    messages = [ChatMessage(role="user", content="Hello")]
    with pytest.raises(ValueError, match="HUGGINGFACE_API_KEY is missing"):
        async for _ in llm.generate_stream(messages):
            pass


def test_hf_tts_factory_and_language_switch():
    tts = get_tts_provider(provider_name="huggingface", language="en")
    assert isinstance(tts, HuggingFaceTTS)
    assert tts.language == "en"
    assert "eng" in tts.model

    tts.set_language("hi")
    assert tts.language == "hi"
    assert "hin" in tts.model


@pytest.mark.asyncio
async def test_hf_sentiment_heuristics():
    analyzer = HuggingFaceSentimentAnalyzer(api_key=None)

    # Positive test
    res_pos = await analyzer.analyze("Thank you so much, perfect service!")
    assert res_pos["sentiment"] == "positive"
    assert res_pos["is_escalation_risk"] is False

    # Negative escalation test
    res_neg = await analyzer.analyze("Yeh bahut ghatiya service hai, cancel my appointment!")
    assert res_neg["sentiment"] == "negative"
    assert res_neg["is_escalation_risk"] is True

    # Empty string
    res_empty = await analyzer.analyze("")
    assert res_empty["sentiment"] == "neutral"


@pytest.mark.asyncio
async def test_hf_embedder_fallback():
    embedder = HuggingFaceEmbedder(api_key=None)
    vec = await embedder.embed_query("root canal price")
    assert len(vec) == 384
    assert (vec == 0).all()
