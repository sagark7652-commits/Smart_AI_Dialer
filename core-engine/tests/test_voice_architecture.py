"""Tests for voice architecture:
English: Ember (Male) / Maple (Female) [ChatGPT]
Hindi: Neer (Male) / Leher (Female)
Voice locking consistency throughout call.
"""

import pytest
import yaml
from pathlib import Path
from agent.tts.openai_tts import OpenAITTS
from agent.tts.sarvam_tts import SarvamTTS
from agent.tts.factory import get_tts_provider


def test_openai_tts_voices():
    tts_female = OpenAITTS(api_key="mock", gender="female")
    assert tts_female.voice == "sol"

    tts_male = OpenAITTS(api_key="mock", gender="male")
    assert tts_male.voice == "ember"


def test_sarvam_tts_voices():
    tts_female = SarvamTTS(api_key="mock", gender="female")
    assert tts_female.speaker == "leher"

    tts_male = SarvamTTS(api_key="mock", gender="male")
    assert tts_male.speaker == "neer"


def test_tts_factory_routing():
    tts_en_female = get_tts_provider(provider_name="openai", gender="female")
    assert isinstance(tts_en_female, OpenAITTS)
    assert tts_en_female.voice == "sol"

    tts_en_male = get_tts_provider(provider_name="openai", gender="male")
    assert isinstance(tts_en_male, OpenAITTS)
    assert tts_en_male.voice == "ember"

    tts_hi_female = get_tts_provider(provider_name="sarvam", gender="female")
    assert isinstance(tts_hi_female, SarvamTTS)
    assert tts_hi_female.speaker == "leher"

    tts_hi_male = get_tts_provider(provider_name="sarvam", gender="male")
    assert isinstance(tts_hi_male, SarvamTTS)
    assert tts_hi_male.speaker == "neer"


def test_agent_config_voices_and_no_marathi():
    cfg_file = Path("agent_config.yaml")
    assert cfg_file.exists()
    with open(cfg_file, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    agent_cfg = data["agent"]
    voices = agent_cfg.get("voices", {})
    assert voices["english"]["male"] == "ember"
    assert voices["english"]["female"] == "sol"
    assert voices["hindi"]["male"] == "neer"
    assert voices["hindi"]["female"] == "leher"
    assert voices["lock_voice_per_call"] is True

    # Verify marathi is not present in fallback messages or consent messages
    assert "mr" not in agent_cfg["voice_loop"]["fallback_messages"]
    assert "mr" not in agent_cfg["recording"]["consent_messages"]
