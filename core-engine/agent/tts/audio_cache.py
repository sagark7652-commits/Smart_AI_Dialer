"""In-memory zero-latency audio cache for fixed localized voice phrases."""

from pathlib import Path
from typing import Dict, Optional, Tuple
import wave
import yaml
from agent.logger import setup_logger

logger = setup_logger("tts.audio_cache")

CACHE_DIR = Path("locales/cache")
LOCALES_DIR = Path("locales")


class FixedLinesAudioCache:
    """Preloads and serves pre-synthesized PCM audio chunks with 0ms synthesis latency."""

    _instance: Optional["FixedLinesAudioCache"] = None

    def __init__(self, cache_dir: Path = CACHE_DIR, locales_dir: Path = LOCALES_DIR):
        self.cache_dir = cache_dir
        self.locales_dir = locales_dir
        # Map: (lang, text_clean) -> (pcm_bytes, sample_rate)
        self._text_to_audio: Dict[Tuple[str, str], Tuple[bytes, int]] = {}
        # Map: (lang, key) -> (pcm_bytes, sample_rate)
        self._key_to_audio: Dict[Tuple[str, str], Tuple[bytes, int]] = {}
        # Map: (lang, key) -> text
        self._key_to_text: Dict[Tuple[str, str], str] = {}
        self._preload()

    def _preload(self) -> None:
        if not self.cache_dir.exists() or not self.locales_dir.exists():
            return

        # 1. Load localized texts to know (lang, key) -> text mapping
        locale_map: Dict[Tuple[str, str], str] = {
            ("en", "mobile_recharge_promo_greeting"): "Hello! This is Simran from SwiftTel 5G. We have an exciting 5G plan update for you, do you have a quick minute to speak?",
            ("hi", "mobile_recharge_promo_greeting"): "नमस्ते! मैं SwiftTel 5G से Simran बोल रही हूँ। हमारे नए 5G अनलिमिटेड प्लान के बारे में जानकारी देनी थी, क्या मैं आपसे एक मिनट बात कर सकती हूँ?",
            ("mr", "mobile_recharge_promo_greeting"): "नमस्कार! मी SwiftTel 5G मधून Simran बोलतेय. आपल्यासाठी 5G प्लॅनबद्दल महत्त्वाची माहिती होती, मी आपल्याशी एक मिनिट बोलू शकते का?",
            ("en", "greeting"): "Hello and welcome to Aarogya Dental Care. This is Priya speaking, how may I assist you today?",
            ("hi", "greeting"): "नमस्ते! Aarogya Dental Care में आपका स्वागत है। मैं Priya बात कर रही हूँ, मैं आपकी क्या सहायता कर सकती हूँ?",
            ("mr", "greeting"): "नमस्कार! Aarogya Dental Care मध्ये आपले स्वागत आहे. मी Priya बोलतेय, मी आपली काय मदत करू शकते?",
            ("en", "credit_card_offer_greeting"): "Hello! This is Ananya from Apex Bank calling regarding your pre-approved lifetime free credit card offer. Do you have a quick minute?",
            ("hi", "credit_card_offer_greeting"): "नमस्ते! मैं अपेक्स बैंक से अनन्या बात कर रही हूँ। आपके लिए हमारा लाइफटाइम फ्री क्रेडिट कार्ड अप्रूव हुआ है, क्या मैं 1 मिनट बात कर सकती हूँ?",
            ("mr", "credit_card_offer_greeting"): "नमस्कार! मी अपेक्स बँकेतून अनन्या बोलत आहे. आपल्यासाठी आमचे लाइफटाइम फ्री क्रेडिट कार्ड मंजूर झाले आहे, मी 1 मिनिट बोलू शकते का?",
            ("en", "bill_emi_reminder_greeting"): "Hello! This is Aarti from EasyFinance calling with a courtesy reminder regarding your upcoming EMI. Do you have a moment to talk?",
            ("hi", "bill_emi_reminder_greeting"): "नमस्ते! मैं EasyFinance से आरती बोल रही हूँ। यह आपकी आगामी ईएमआई के संदर्भ में एक शिष्टता कॉल है, क्या मैं 1 मिनट बात कर सकती हूँ?",
            ("mr", "bill_emi_reminder_greeting"): "नमस्कार! मी इजीफायनान्स मधून आरती बोलत आहे. हा आपल्या आगामी ईएमआई संदर्भातील कॉल आहे, मी 1 मिनिट बोलू शकते का?",
            ("en", "clinic_booking_greeting"): "Hello and welcome to Aarogya Dental Care. This is Priya speaking, how may I assist you today?",
            ("hi", "clinic_booking_greeting"): "नमस्ते! आरोग्य डेंटल केयर में आपका स्वागत है। मैं प्रिया बात कर रही हूँ, मैं आपकी क्या सहायता कर सकती हूँ?",
            ("mr", "clinic_booking_greeting"): "नमस्कार! आरोग्य डेंटल केअर मध्ये आपले स्वागत आहे. मी प्रिया बोलतेय, मी आपली काय मदत करू शकते?",
            ("en", "lead_qualification_greeting"): "Hello! This is Kavita from TechSolutions reaching out regarding your enterprise inquiry. How can I assist you today?",
            ("hi", "lead_qualification_greeting"): "नमस्ते! मैं टेकसॉल्यूशंस से कविता बात कर रही हूँ। आपके क्लाउड प्लेटफॉर्म पूछताछ के संबंध में यह कॉल है, क्या मैं जानकारी दे सकती हूँ?",
            ("mr", "lead_qualification_greeting"): "नमस्कार! मी टेकसोल्युशन्स मधून कविता बोलत आहे. आपल्या चौकशी संदर्भात हा कॉल आहे, मी आपली काय मदत करू शकते?",
            ("en", "support_faq_greeting"): "Hello! Welcome to CareDesk Support. I am Pooja, how may I assist you today?",
            ("hi", "support_faq_greeting"): "नमस्ते! केयरडेस्क सपोर्ट में आपका स्वागत है। मैं पूजा हूँ, बताइए मैं आपकी क्या सहायता कर सकती हूँ?",
            ("mr", "support_faq_greeting"): "नमस्कार! केअरडेस्क सपोर्ट मध्ये आपले स्वागत आहे. मी पूजा बोलत आहे, बोला मी आपली काय मदत करू शकते?",
            ("en", "feedback_survey_greeting"): "Hello! This is Sneha calling for Customer Insights. I would appreciate thirty seconds of your feedback on our service today.",
            ("hi", "feedback_survey_greeting"): "नमस्ते! मैं स्नेहा बात कर रही हूँ। हमारी हालिया सर्विस के बारे में आपकी राय जानने के लिए यह छोटा कॉल है, क्या आप 30 सेकंड दे सकते हैं?",
            ("mr", "feedback_survey_greeting"): "नमस्कार! मी स्नेहा बोलत आहे. आमच्या सेवेबद्दल आपले मत जाणून घेण्यासाठी हा एक छोटा कॉल आहे, आपण 30 सेकंद वेळ देऊ शकता का?",
            ("en", "announcement_ad_greeting"): "Hello! This is Neha from Great Indian Sale bringing you exclusive festive offers and discounts today. Can I share the highlights?",
            ("hi", "announcement_ad_greeting"): "नमस्ते! मैं ग्रेट इंडियन सेल से नेहा बोल रही हूँ, आज आपके लिए खास फेस्टिव ऑफर्स और डिस्काउंट लेकर आई हूँ। क्या मैं मुख्य डील्स बता सकती हूँ?",
            ("mr", "announcement_ad_greeting"): "नमस्कार! मी ग्रेट इंडियन सेल मधून नेहा बोलत आहे, आज आपल्यासाठी खास फेस्टिव्ह ऑफर्स आणि डिस्काउंट घेऊन आले आहे. मी मुख्य ऑफर्स सांगू का?",
        }
        for lfile in self.locales_dir.glob("*.yaml"):
            lang = lfile.stem.lower()
            try:
                with open(lfile, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                for k, v in data.items():
                    if isinstance(v, str) and v.strip():
                        locale_map[(lang, k)] = v.strip()
            except Exception:
                pass

        # 2. Load cached WAV files
        loaded_count = 0
        for wav_path in self.cache_dir.glob("*.wav"):
            # Filename format: <lang>_<voice>_<key>.wav
            parts = wav_path.stem.split("_")
            if len(parts) < 3:
                continue
            lang = parts[0].lower()
            voice = parts[1].lower()
            key = "_".join(parts[2:]).lower()

            try:
                with wave.open(str(wav_path), "rb") as wf:
                    sr = wf.getframerate()
                    pcm_bytes = wf.readframes(wf.getnframes())

                if pcm_bytes:
                    # Give strict priority to Cartesia cloned voice audio!
                    existing = (lang, key) in self._key_to_audio
                    if not existing or voice == "cartesia":
                        self._key_to_audio[(lang, key)] = (pcm_bytes, sr)
                        # Also map the exact text if available in locale_map
                        text = locale_map.get((lang, key))
                        if text:
                            self._key_to_text[(lang, key)] = text
                            self._text_to_audio[(lang, text)] = (pcm_bytes, sr)
                            self._text_to_audio[(lang, text.strip())] = (pcm_bytes, sr)
                    loaded_count += 1
            except Exception as e:
                logger.warning(f"Could not load cached audio {wav_path}: {e}")

        if loaded_count > 0:
            logger.info(f"FixedLinesAudioCache loaded {loaded_count} zero-latency audio phrases.")

    def get_text_by_key(self, key: str, lang: str) -> Optional[str]:
        """Retrieve pre-cached text by key e.g. 'greeting', 'mobile_recharge_promo_greeting'."""
        lang_short = (lang or "en").split("-")[0].lower()
        return self._key_to_text.get((lang_short, key.lower()))

    def get_audio_by_text(self, text: str, lang: str) -> Optional[Tuple[bytes, int]]:
        """Retrieve pre-cached audio PCM for a phrase, returning (pcm_bytes, sample_rate) or None."""
        if not text:
            return None
        lang_short = (lang or "en").split("-")[0].lower()
        clean = text.strip()
        # Direct match
        match = self._text_to_audio.get((lang_short, clean))
        if match:
            return match
        # Substring / key prefix check
        for (l, k_text), val in self._text_to_audio.items():
            if l == lang_short and (clean in k_text or k_text in clean or clean[:30] in k_text):
                return val
        return None

    def get_audio_by_key(self, key: str, lang: str) -> Optional[Tuple[bytes, int]]:
        """Retrieve pre-cached audio PCM by key e.g. 'greeting', 'are_you_there'."""
        lang_short = (lang or "en").split("-")[0].lower()
        return self._key_to_audio.get((lang_short, key.lower()))


_cache_singleton: Optional[FixedLinesAudioCache] = None


def get_audio_cache() -> FixedLinesAudioCache:
    global _cache_singleton
    if _cache_singleton is None:
        _cache_singleton = FixedLinesAudioCache()
    return _cache_singleton
