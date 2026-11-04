"""Tests for Step 3 TTS, chunker, text normalizer, and clearable player."""

import pytest
import numpy as np
from agent.tts.chunker import SentenceChunker
from agent.tts.normalizer import TextNormalizer
from agent.tts.player import AudioPlayer
from agent.tts.factory import get_tts_provider
from agent.tts.cartesia_tts import CartesiaTTS
from agent.tts.sarvam_tts import SarvamTTS


def test_sentence_chunker_punctuation():
    """Verify sentence splitting on English and Devanagari punctuation."""
    chunker = SentenceChunker()

    tokens = ["Namaste! ", "Main ", "Priya ", "hoon. ", "Aap ", "kaise ", "hain?"]
    sentences = []
    for tok in tokens:
        sentences.extend(chunker.add_token(tok))
    sentences.extend(chunker.flush())

    assert len(sentences) == 3
    assert sentences[0] == "Namaste!"
    assert sentences[1] == "Main Priya hoon."
    assert sentences[2] == "Aap kaise hain?"


def test_sentence_chunker_devanagari_danda():
    """Verify chunker respects Hindi/Marathi purna viram (।) and clause breaks."""
    chunker = SentenceChunker()

    tokens = ["आरोग्य डेंटल केअरमध्ये आपले स्वागत आहे। ", "आम्ही तुम्हाला मदत करू शकतो का?"]
    sentences = []
    for tok in tokens:
        sentences.extend(chunker.add_token(tok))
    sentences.extend(chunker.flush())

    assert len(sentences) == 2
    assert "स्वागत आहे।" in sentences[0]
    assert "शकतो का?" in sentences[1]


def test_sentence_chunker_abbreviation_protection():
    """Verify abbreviations like Dr. or Mr. are not prematurely split."""
    chunker = SentenceChunker()
    tokens = ["Please ", "meet ", "Dr. ", "Sharma ", "at ", "the ", "clinic."]
    sentences = []
    for tok in tokens:
        sentences.extend(chunker.add_token(tok))
    sentences.extend(chunker.flush())

    assert len(sentences) == 1
    assert sentences[0] == "Please meet Dr. Sharma at the clinic."


def test_text_normalizer_currency():
    """Verify currency symbol normalization in Hindi, Marathi, and English."""
    # Hindi
    norm_hi = TextNormalizer.normalize("दांतों की सफाई का खर्च ₹1,200 है", language="hi")
    assert "1200 रुपये" in norm_hi
    assert "₹" not in norm_hi

    # Marathi
    norm_mr = TextNormalizer.normalize("रूट कॅनॉल ₹3,500 पासून सुरू होते", language="mr")
    assert "3500 रुपये" in norm_mr

    # English
    norm_en = TextNormalizer.normalize("Consultation fee is ₹400", language="en")
    assert "400 rupees" in norm_en


def test_text_normalizer_phone_and_markdown():
    """Verify phone numbers are spaced for digit reading and markdown is removed."""
    norm = TextNormalizer.normalize(
        "Call us at **+91 98765 43210** for *urgent* appointments.",
        language="en",
    )
    assert "**" not in norm
    assert "*" not in norm
    assert "9 8 7 6 5, 4 3 2 1 0" in norm


def test_audio_player_queue_and_clear():
    """Verify clearable playback queue drains instantaneously on barge-in."""
    player = AudioPlayer()
    try:
        # Generate dummy 16-bit PCM silence
        silence = (np.zeros(2400, dtype=np.int16)).tobytes()

        player.enqueue(silence)
        player.enqueue(silence)
        assert not player.playback_queue.empty() or player.is_playing()

        # Simulate barge-in clear
        player.clear()
        assert player.playback_queue.empty()
    finally:
        player.close()


def test_tts_factory_resolution():
    """Verify provider factory correctly instantiates Cartesia and Sarvam classes."""
    cartesia = get_tts_provider(provider_name="cartesia")
    assert isinstance(cartesia, CartesiaTTS)

    sarvam = get_tts_provider(provider_name="sarvam")
    assert isinstance(sarvam, SarvamTTS)
