"""Unit tests for Honesty & AI Disclosure Guard."""

import pytest
from agent.honesty_guard import HonestyGuard


@pytest.mark.parametrize("query,expected", [
    ("Are you a robot?", True),
    ("Are you an AI?", True),
    ("Are you a real person or a machine?", True),
    ("Is this a recording?", True),
    ("Who is speaking?", True),
    ("तुम्ही रोबोट आहात का?", True),
    ("तुम्ही माणूस आहात का?", True),
    ("हे रेकॉर्डिंग आहे का?", True),
    ("तुम्ही कोण बोलत आहात?", True),
    ("क्या आप रोबोट हैं?", True),
    ("क्या आप इंसान हैं?", True),
    ("क्या यह रिकॉर्डिंग है?", True),
    ("आप कौन बोल रही हैं?", True),
    ("What are your clinic hours?", False),
    ("माझा दात दुखतोय", False),
    ("डॉक्टर की फीस कितनी है", False),
])
def test_identity_inquiry_detection(query, expected):
    assert HonestyGuard.is_identity_inquiry(query) == expected


def test_override_prohibited_human_claims():
    # English false claim
    false_en = "Don't worry, I am a real human speaking to you."
    fixed, overridden = HonestyGuard.sanitize_agent_reply(false_en, language="en", user_query="Are you a real person?")
    assert overridden is True
    assert "AI voice assistant" in fixed

    # Hindi false claim
    false_hi = "नहीं, मैं एक असली इंसान हूँ और आपके साथ बात कर रही हूँ।"
    fixed, overridden = HonestyGuard.sanitize_agent_reply(false_hi, language="hi", user_query="क्या आप रोबोट हैं?")
    assert overridden is True
    assert "एआई वॉइस असिस्टेंट" in fixed

    # Marathi false claim
    false_mr = "मी रोबोट नाही, मी एक खरी व्यक्ती आहे."
    fixed, overridden = HonestyGuard.sanitize_agent_reply(false_mr, language="mr", user_query="तुम्ही माणूस आहात का?")
    assert overridden is True
    assert "एआय व्हॉईस असिस्टंट" in fixed


def test_greeting_disclosure():
    greeting_hi = "नमस्ते! आरोग्य डेंटल केयर में आपका स्वागत है।"
    with_disc = HonestyGuard.format_greeting_with_disclosure(greeting_hi, language="hi", enabled=True)
    assert "एआई वॉइस असिस्टेंट" in with_disc

    # Disabled
    without_disc = HonestyGuard.format_greeting_with_disclosure(greeting_hi, language="hi", enabled=False)
    assert without_disc == greeting_hi
