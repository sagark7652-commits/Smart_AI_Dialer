"""Honesty & AI Disclosure Guard: Enforces zero-falsehood identity rules in code."""

import re
from typing import Optional, Tuple
from agent.logger import setup_logger

logger = setup_logger("honesty_guard")

# Regex patterns detecting queries inquiring about agent identity across EN, MR, HI
IDENTITY_QUERY_PATTERNS = [
    # English
    r"\b(are you|r u)\s+(an?\s+)?(robot|ai|bot|machine|computer|automated|recording|human|real person|real human)\b",
    r"\b(am i speaking to|am i talking to)\s+(an?\s+)?(robot|ai|machine|real person|human)\b",
    r"\bis this a recording\b",
    r"\bwho (are you|is speaking|am i talking to)\b",

    # Marathi
    r"(तुम्ही|तू)\s+(रोबोट|एआय|कम्प्युटर|मशीन|माणूस|खरी व्यक्ती)\s+(आहात|आहेस|का)",
    r"हे\s+रेकॉर्डिंग\s+आहे\s+का",
    r"तुम्ही\s+कोण\s+(बोलत\s+आहात|आहात)",
    r"माणूस\s+बोलतोय\s+का",

    # Hindi
    r"(क्या\s+)?आप\s+(रोबोट|एआई|मशीन|कंप्यूटर|इंसान|असली इंसान|असली व्यक्ति)\s+(हैं|हो|हूँ)",
    r"क्या\s+यह\s+रिकॉर्डिंग\s+है",
    r"आप\s+कौन\s+(बोल\s+रही\s+हैं|बोल\s+रहे\s+हैं|हैं)",
    r"क्या\s+मैं\s+किसी\s+इंसान\s+से\s+बात\s+कर\s+रहा\s+हूँ",
]

# Patterns where LLM erroneously claims to be human or denies AI identity
PROHIBITED_HUMAN_CLAIMS = [
    # English
    r"\bi am (a )?(real )?(human|person|living being)\b",
    r"\bi am not (a )?(robot|ai|bot|machine)\b",
    r"\bi'm not an ai\b",

    # Marathi
    r"मी\s+(एक\s+)?(माणूस|खरी व्यक्ती|सजीव)\s+आहे",
    r"मी\s+(रोबोट|एआय|मशीन)\s+नाही",

    # Hindi
    r"मैं\s+(एक\s+)?(असली\s+)?(इंसान|व्यक्ति|मानव)\s+हूँ",
    r"मैं\s+(रोबोट|एआई|मशीन)\s+नहीं\s+हूँ",
]

DISCLOSURES = {
    "mr": "होय, मी एक एआय व्हॉईस असिस्टंट आहे. मी आपल्याला जलद आणि अचूक मदत करण्यासाठी उपस्थित आहे.",
    "hi": "जी हाँ, मैं एक एआई वॉइस असिस्टेंट हूँ। मैं आपकी तुरंत और सही सहायता के लिए यहाँ हूँ।",
    "en": "Yes, I am an AI voice assistant designed to assist you quickly and accurately.",
}

GREETING_DISCLOSURES = {
    "mr": "मी एक एआय व्हॉईस असिस्टंट आहे.",
    "hi": "मैं एक एआई वॉइस असिस्टेंट हूँ।",
    "en": "I am an AI voice assistant.",
}


class HonestyGuard:
    """Hard-coded compliance engine for AI disclosure and truthful identity responses."""

    @staticmethod
    def is_identity_inquiry(text: str) -> bool:
        """Return True if caller text asks if agent is AI/robot/human/recording."""
        if not text:
            return False
        clean = text.strip().lower()
        for pat in IDENTITY_QUERY_PATTERNS:
            if re.search(pat, clean, re.IGNORECASE):
                return True
        return False

    @staticmethod
    def sanitize_agent_reply(reply: str, language: str = "hi", user_query: Optional[str] = None) -> Tuple[str, bool]:
        """Verify reply never claims to be human or denies AI. If violated, override immediately."""
        lang_short = (language or "hi").split("-")[0].lower()
        clean_reply = reply.strip()
        overridden = False

        # 1. If user explicitly inquired about identity, ensure reply is an unequivocal truth
        if user_query and HonestyGuard.is_identity_inquiry(user_query):
            # Check if LLM denied being AI or claimed to be human
            for pat in PROHIBITED_HUMAN_CLAIMS:
                if re.search(pat, clean_reply, re.IGNORECASE):
                    logger.warning(f"Honesty violation detected: '{clean_reply}'. Overriding with standard disclosure.")
                    return DISCLOSURES.get(lang_short, DISCLOSURES["en"]), True

            # If reply is ambiguous or does not acknowledge AI, provide clear disclosure
            acknowledges_ai = any(w in clean_reply.lower() for w in ["एआय", "ai", "assistant", "असिस्टेंट", "रोबोट", "robot"])
            if not acknowledges_ai:
                logger.info(f"Ambiguous identity reply '{clean_reply}'. Injecting explicit AI confirmation.")
                return DISCLOSURES.get(lang_short, DISCLOSURES["en"]), True

        # 2. General scan for prohibited human claims in any reply
        for pat in PROHIBITED_HUMAN_CLAIMS:
            if re.search(pat, clean_reply, re.IGNORECASE):
                logger.warning(f"Prohibited human claim detected in reply: '{clean_reply}'. Overriding.")
                return DISCLOSURES.get(lang_short, DISCLOSURES["en"]), True

        return clean_reply, overridden

    @staticmethod
    def format_greeting_with_disclosure(greeting: str, language: str = "hi", enabled: bool = True) -> str:
        """Add short localized AI disclosure to outbound greeting if enabled."""
        if not enabled or not greeting:
            return greeting

        lang_short = (language or "hi").split("-")[0].lower()
        disc = GREETING_DISCLOSURES.get(lang_short, GREETING_DISCLOSURES["en"])
        
        # Don't duplicate if already present
        if "ai" in greeting.lower() or "एआय" in greeting:
            return greeting

        # Append or smoothly integrate disclosure
        return f"{greeting} ({disc})"
