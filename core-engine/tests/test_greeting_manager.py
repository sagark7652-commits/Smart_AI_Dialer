"""Unit tests for GreetingManager in PART H3."""

import pytest
from agent.greeting_manager import GreetingManager, get_greeting_manager


@pytest.fixture
def gm():
    return get_greeting_manager()


def test_name_reliability_validation(gm):
    # Valid names
    assert gm.is_reliable_name("Rahul Sharma") is True
    assert gm.is_reliable_name("Sneha") is True
    assert gm.is_reliable_name("Dr. Amit") is True

    # Unreliable / invalid names
    assert gm.is_reliable_name(None) is False
    assert gm.is_reliable_name("") is False
    assert gm.is_reliable_name("Unknown") is False
    assert gm.is_reliable_name("null") is False
    assert gm.is_reliable_name("9876543210") is False
    assert gm.is_reliable_name("test") is False
    assert gm.is_reliable_name("N/A") is False


def test_honorific_injection(gm):
    # Hindi
    hi_hon = gm.format_name_with_honorific("अमित", language="hi")
    assert "जी" in hi_hon

    # Marathi
    mr_hon = gm.format_name_with_honorific("राहुल", language="mr", gender="male")
    assert "साहेब" in mr_hon

    mr_fem = gm.format_name_with_honorific("स्नेहा", language="mr", gender="female")
    assert "ताई" in mr_fem

    # English
    en_hon = gm.format_name_with_honorific("Sharma", language="en", gender="male")
    assert "Mr." in en_hon


def test_gender_morphology_agreement(gm):
    # Marathi female
    g_mr_f = gm.build_greeting(call_type="inbound", language="mr", agent_gender="female")
    assert "बोलतेय" in g_mr_f.text
    assert "शकते" in g_mr_f.text

    # Marathi male
    g_mr_m = gm.build_greeting(call_type="inbound", language="mr", agent_gender="male")
    assert "बोलतोय" in g_mr_m.text
    assert "शकतो" in g_mr_m.text

    # Hindi female
    g_hi_f = gm.build_greeting(call_type="inbound", language="hi", agent_gender="female")
    assert "बोल रही हूँ" in g_hi_f.text
    assert "सकती हूँ" in g_hi_f.text

    # Hindi male
    g_hi_m = gm.build_greeting(call_type="inbound", language="hi", agent_gender="male")
    assert "बोल रहा हूँ" in g_hi_m.text
    assert "सकता हूँ" in g_hi_m.text


def test_rotation_across_three_variants(gm):
    v1 = gm.build_greeting(call_type="outbound", language="mr", call_index=0)
    v2 = gm.build_greeting(call_type="outbound", language="mr", call_index=1)
    v3 = gm.build_greeting(call_type="outbound", language="mr", call_index=2)

    assert v1.variant_index == 0
    assert v2.variant_index == 1
    assert v3.variant_index == 2
    assert v1.text != v2.text
    assert v2.text != v3.text


def test_neutral_greeting_fallback_on_missing_name(gm):
    g_neutral = gm.build_greeting(
        call_type="outbound",
        language="hi",
        name="Unknown"  # Unreliable
    )
    assert g_neutral.is_personalized is False
    assert "Unknown" not in g_neutral.text
    assert "नमस्ते!" in g_neutral.text


def test_loudness_normalization_and_trim(gm):
    import numpy as np
    # 2 seconds of 440Hz tone with 500ms silence at start/end
    sr = 24000
    silence = np.zeros(int(sr * 0.5), dtype=np.int16)
    tone = (np.sin(2 * np.pi * 440 * np.linspace(0, 1.0, sr)) * 10000).astype(np.int16)
    combined = np.concatenate([silence, tone, silence]).tobytes()

    norm = gm.normalize_loudness_and_trim(combined)
    norm_arr = np.frombuffer(norm, dtype=np.int16)

    # Output length should be significantly trimmed of silence
    assert len(norm_arr) < len(np.frombuffer(combined, dtype=np.int16))
    # Peak amplitude should be boosted toward target
    assert np.max(np.abs(norm_arr)) > 20000
