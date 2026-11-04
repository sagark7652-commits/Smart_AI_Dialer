"""Tests for Step 1: Voice Audition, Naturalness, Normalization, and AI Disclosure."""

import pytest
from agent.safety import AIDisclosureGuard
from agent.tts.normalizer import TextNormalizer
from agent.tts.factory import LanguageAdaptiveTTS


def test_ai_disclosure_detection():
    """Verify AIDisclosureGuard identifies sincere AI inquiries in EN, HI, MR."""
    # English
    assert AIDisclosureGuard.is_ai_inquiry("Are you an AI?")
    assert AIDisclosureGuard.is_ai_inquiry("Are you a real human or a robot?")
    assert AIDisclosureGuard.is_ai_inquiry("Am I talking to a machine?")
    assert "AI voice assistant" in AIDisclosureGuard.get_disclosure_response("en")

    # Hindi
    assert AIDisclosureGuard.is_ai_inquiry("क्या आप कोई एआई रोबोट हैं?")
    assert AIDisclosureGuard.is_ai_inquiry("क्या आप असली इंसान बात कर रहे हैं?")
    assert "एआई वॉइस असिस्टेंट" in AIDisclosureGuard.get_disclosure_response("hi")

    # Marathi
    assert AIDisclosureGuard.is_ai_inquiry("तुम्ही रोबोट आहात का?")
    assert AIDisclosureGuard.is_ai_inquiry("तुम्ही खरे माणूस आहात का?")
    assert "एआय व्हॉइस असिस्टंट" in AIDisclosureGuard.get_disclosure_response("mr")

    # Non-AI inquiries should not trigger
    assert not AIDisclosureGuard.is_ai_inquiry("What are your clinic hours?")
    assert not AIDisclosureGuard.is_ai_inquiry("दांतों की सफाई का कितना खर्च है?")
    assert not AIDisclosureGuard.is_ai_inquiry("मला डॉक्टरची वेळ हवी आहे.")


def test_marathi_text_normalization():
    """Verify Marathi numbers, rupee amounts, dates, and phone numbers are normalized."""
    text = "तपासणी शुल्क ₹1200 असून तारीख 26/04/2026 आहे. फोन नंबर 9876543210 आहे."
    norm = TextNormalizer.normalize(text, language="mr")

    # Currency
    assert "1200 रुपये" in norm
    # Date
    assert "26 एप्रिल" in norm
    # Phone number spacing
    assert "9 8 7 6 5, 4 3 2 1 0" in norm


def test_hindi_and_english_text_normalization():
    """Verify Hindi and English normalization rules."""
    hi_text = "सफाई का चार्ज ₹1,500 है और डिस्काउंट 50% मिलेगा।"
    hi_norm = TextNormalizer.normalize(hi_text, language="hi")
    assert "1500 रुपये" in hi_norm
    assert "50 प्रतिशत" in hi_norm

    en_text = "Treatment fee is ₹2500 with 10% off. Call +91 9876543210."
    en_norm = TextNormalizer.normalize(en_text, language="en")
    assert "2500 rupees" in en_norm
    assert "10 percent" in en_norm
    assert "9 8 7 6 5, 4 3 2 1 0" in en_norm


def test_language_adaptive_tts_voice_routing():
    """Verify LanguageAdaptiveTTS maintains locked gender while routing EN, HI, MR."""
    tts_female = LanguageAdaptiveTTS(gender="female", default_lang="hi")
    assert tts_female.get_active_voice("en") == "sol"
    assert tts_female.get_active_voice("hi") == "leher"
    assert tts_female.get_active_voice("mr") == "meera"

    tts_male = LanguageAdaptiveTTS(gender="male", default_lang="mr")
    assert tts_male.get_active_voice("en") == "ember"
    assert tts_male.get_active_voice("hi") == "neer"
    assert tts_male.get_active_voice("mr") == "amol"
