import pytest
from agent.tts.normalizer import TextNormalizer
from agent.llm.prompt_manager import AgentPromptManager, ConversationSession


def test_hindi_female_gender_sanitization():
    """Verify masculine Hindi verbs are transformed to feminine forms."""
    sample = "नमस्ते, मैं प्रिया बोल रहा हूँ और मैं आपकी सहायता कर सकता हूँ। मैं आपको नया प्लान समझाऊंगा।"
    sanitized = TextNormalizer.enforce_female_gender(sample, language="hi")
    assert "बोल रही हूँ" in sanitized
    assert "बोल रहा हूँ" not in sanitized
    assert "कर सकती हूँ" in sanitized
    assert "कर सकता हूँ" not in sanitized
    assert "समझाऊँगी" in sanitized or "समझाऊंगी" in sanitized
    assert "समझाऊंगा" not in sanitized


def test_marathi_female_gender_sanitization():
    """Verify masculine Marathi verbs are transformed to feminine forms."""
    sample = "मी प्रिया बोलतोय आणि मी आपल्याला माहिती सांगतो. मी मदत करू शकतो."
    sanitized = TextNormalizer.enforce_female_gender(sample, language="mr")
    assert "बोलतेय" in sanitized
    assert "बोलतोय" not in sanitized
    assert "सांगते" in sanitized
    assert "सांगतो" not in sanitized
    assert "करू शकते" in sanitized
    assert "करू शकतो" not in sanitized


def test_prompt_manager_female_persona_instruction():
    """Verify prompt manager embeds strict female persona rules in system prompt."""
    pm_hi = AgentPromptManager(config_dict={"name": "Priya", "default_language": "hi"})
    sys_hi = pm_hi.build_system_prompt()
    assert "FEMALE" in sys_hi
    assert "बोल रही हूँ" in sys_hi
    assert "स्त्री / महिला" in sys_hi

    pm_mr = AgentPromptManager(config_dict={"name": "Priya", "default_language": "mr"})
    sys_mr = pm_mr.build_system_prompt()
    assert "FEMALE" in sys_mr
    assert "बोलतेय" in sys_mr
    assert "स्त्री / महिला" in sys_mr
