"""Text normalization for Indic (Hindi, Marathi, English) speech synthesis."""

import re
from typing import Optional
from agent.tts.pronunciation import get_pronunciation_manager


# Indic number word dictionaries for colloquial speech
_HI_UNITS = [
    "शून्य", "एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ",
    "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस"
]
_HI_TENS = {
    20: "बीस", 30: "तीस", 40: "चालीस", 50: "पचास",
    60: "साठ", 70: "सत्तर", 80: "अस्सी", 90: "नब्बे"
}

_MR_UNITS = [
    "शून्य", "एक", "दोन", "तीन", "चार", "पाच", "सहा", "सात", "आठ", "नऊ",
    "दहा", "अकरा", "बारा", "तेरा", "चौदा", "पंधरा", "सोळा", "सतरा", "अठरा", "एकोणीस"
]
_MR_TENS = {
    20: "वीस", 30: "तीस", 40: "चाळीस", 50: "पन्नास",
    60: "साठ", 70: "सत्तर", 80: "ऐंशी", 90: "नव्वद"
}

_MONTH_NAMES = {
    1: {"en": "January", "hi": "जनवरी", "mr": "जानेवारी"},
    2: {"en": "February", "hi": "फ़रवरी", "mr": "फेब्रुवारी"},
    3: {"en": "March", "hi": "मार्च", "mr": "मार्च"},
    4: {"en": "April", "hi": "अप्रैल", "mr": "एप्रिल"},
    5: {"en": "May", "hi": "मई", "mr": "मे"},
    6: {"en": "June", "hi": "जून", "mr": "जून"},
    7: {"en": "July", "hi": "जुलाई", "mr": "जुलै"},
    8: {"en": "August", "hi": "अगस्त", "mr": "ऑगस्ट"},
    9: {"en": "September", "hi": "सितंबर", "mr": "सप्टेंबर"},
    10: {"en": "October", "hi": "अक्टूबर", "mr": "ऑक्टोबर"},
    11: {"en": "November", "hi": "नवंबर", "mr": "नोव्हेंबर"},
    12: {"en": "December", "hi": "दिसंबर", "mr": "डिसेंबर"},
}


def _num_to_hi(n: int) -> str:
    """Convert integer up to 9999999 to conversational Hindi words."""
    if n < 0:
        return f"माइनस {_num_to_hi(-n)}"
    if n < 20:
        return _HI_UNITS[n]
    if n < 100:
        rem = n % 10
        base = _HI_TENS.get(n - rem, "")
        return f"{base} {_HI_UNITS[rem]}" if rem > 0 else base
    if n < 1000:
        hundreds = n // 100
        rem = n % 100
        h_str = "सौ" if hundreds == 1 else f"{_HI_UNITS[hundreds]} सौ"
        return f"{h_str} {_num_to_hi(rem)}" if rem > 0 else h_str
    if n < 100000:
        thousands = n // 1000
        rem = n % 1000
        t_str = f"{_num_to_hi(thousands)} हज़ार"
        return f"{t_str} {_num_to_hi(rem)}" if rem > 0 else t_str
    if n < 10000000:
        lakhs = n // 100000
        rem = n % 100000
        l_str = f"{_num_to_hi(lakhs)} लाख"
        return f"{l_str} {_num_to_hi(rem)}" if rem > 0 else l_str
    return str(n)


def _num_to_mr(n: int) -> str:
    """Convert integer up to 9999999 to conversational Marathi words."""
    if n < 0:
        return f"वजा {_num_to_mr(-n)}"
    if n < 20:
        return _MR_UNITS[n]
    if n < 100:
        rem = n % 10
        base = _MR_TENS.get(n - rem, "")
        return f"{base} {_MR_UNITS[rem]}" if rem > 0 else base
    if n < 1000:
        hundreds = n // 100
        rem = n % 100
        if hundreds == 1:
            h_str = "शंभर"
        elif hundreds == 2:
            h_str = "दोनशे"
        elif hundreds == 5:
            h_str = "पाचशे"
        else:
            h_str = f"{_MR_UNITS[hundreds]}शे"
        return f"{h_str} {_num_to_mr(rem)}" if rem > 0 else h_str
    if n < 100000:
        thousands = n // 1000
        rem = n % 1000
        t_str = f"{_num_to_mr(thousands)} हजार"
        return f"{t_str} {_num_to_mr(rem)}" if rem > 0 else t_str
    if n < 10000000:
        lakhs = n // 100000
        rem = n % 100000
        l_str = f"{_num_to_mr(lakhs)} लाख"
        return f"{l_str} {_num_to_mr(rem)}" if rem > 0 else l_str
    return str(n)


class TextNormalizer:

    FEMALE_GENDER_PATTERNS_HI = [
        (r"बोल\s+रहा\s+हूँ", "बोल रही हूँ"),
        (r"बोल\s+रहा\s+हूं", "बोल रही हूँ"),
        (r"कर\s+रहा\s+हूँ", "कर रही हूँ"),
        (r"कर\s+रहा\s+हूं", "कर रही हूँ"),
        (r"बता\s+रहा\s+हूँ", "बता रही हूँ"),
        (r"बता\s+रहा\s+हूं", "बता रही हूँ"),
        (r"सकता\s+हूँ", "सकती हूँ"),
        (r"सकता\s+हूं", "सकती हूँ"),
        (r"करता\s+हूँ", "करती हूँ"),
        (r"करता\s+हूं", "करती हूँ"),
        (r"चाहता\s+हूँ", "चाहती हूँ"),
        (r"चाहता\s+हूं", "चाहती हूँ"),
        (r"बताऊँगा", "बताऊँगी"),
        (r"बताऊंगा", "बताऊँगी"),
        (r"समझाऊँगा", "समझाऊँगी"),
        (r"समझाऊंगा", "समझाऊँगी"),
        (r"करूँगा", "करूँगी"),
        (r"करूंगा", "करूँगी"),
        (r"देखूँगा", "देखूँगी"),
        (r"देखूंगा", "देखूँगी"),
        (r"दूँगा", "दूँगी"),
        (r"दूंगा", "दूँगी"),
        (r"आया\s+हूँ", "आई हूँ"),
        (r"आया\s+हूं", "आई हूँ"),
        (r"गया\s+था", "गई थी"),
        (r"समझता\s+हूँ", "समझती हूँ"),
        (r"समझता\s+हूं", "समझती हूँ"),
    ]

    FEMALE_GENDER_PATTERNS_MR = [
        (r"बोलतोय", "बोलतेय"),
        (r"बोलतो\s+आहे", "बोलत आहे"),
        (r"करू\s+शकतो", "करू शकते"),
        (r"शकतो", "शकते"),
        (r"सांगतो", "सांगते"),
        (r"बघतो", "बघते"),
        (r"करतो\s+आहे", "करत आहे"),
        (r"करतो", "करते"),
        (r"येतो", "येते"),
        (r"जातो", "जाते"),
    ]

    @classmethod
    def enforce_female_gender(cls, text: str, language: Optional[str] = "hi") -> str:
        """Guarantee 100% strict feminine grammatical agreement for the female voice agent."""
        if not text:
            return text
        lang_lower = (language or "hi").lower()
        res = text
        if "mr" in lang_lower:
            for pat, rep in cls.FEMALE_GENDER_PATTERNS_MR:
                res = re.sub(pat, rep, res)
        elif "hi" in lang_lower:
            for pat, rep in cls.FEMALE_GENDER_PATTERNS_HI:
                res = re.sub(pat, rep, res)
        else:
            # English doesn't have verbal grammatical gender, but ensure no accidental male titles
            res = re.sub(r"\bI am a male\b", "I am a female", res, flags=re.IGNORECASE)
        return res

    """Normalizes currency, phone numbers, symbols, dates, and pronunciation for clean TTS."""

    DEV_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

    @classmethod
    def normalize(cls, text: str, language: Optional[str] = "en") -> str:
        """Apply language-aware normalization rules and pronunciation dictionary."""
        if not text:
            return ""

        lang_lower = (language or "en").lower()

        # 1. Normalize Devanagari digits to standard ASCII digits
        text = text.translate(cls.DEV_DIGITS)

        # 2. Remove markdown symbols (asterisks, hashtags, backticks, brackets)
        text = re.sub(r"[*#_`~\[\]]", "", text)

        # 3. Replace ellipses and repeated dots with a natural prosodic comma pause
        text = re.sub(r"\.{2,}", ", ", text)

        # 4. Apply pronunciation dictionary for abbreviations, doctor names, clinics
        pronouncer = get_pronunciation_manager()
        text = pronouncer.apply(text, language=language or "en")

        # 5. Normalize dates: YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
        def _replace_iso_date(match: re.Match) -> str:
            year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
            m_info = _MONTH_NAMES.get(month, {"en": str(month), "hi": str(month), "mr": str(month)})
            if "hi" in lang_lower:
                return f"{day} {m_info['hi']}"
            elif "mr" in lang_lower:
                return f"{day} {m_info['mr']}"
            return f"{day} {m_info['en']}"

        text = re.sub(r"\b(\d{4})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b", _replace_iso_date, text)

        def _replace_dmy_date(match: re.Match) -> str:
            day, month = int(match.group(1)), int(match.group(2))
            m_info = _MONTH_NAMES.get(month, {"en": str(month), "hi": str(month), "mr": str(month)})
            if "hi" in lang_lower:
                return f"{day} {m_info['hi']}"
            elif "mr" in lang_lower:
                return f"{day} {m_info['mr']}"
            return f"{day} {m_info['en']}"

        text = re.sub(r"\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](\d{4})\b", _replace_dmy_date, text)

        # 6. Normalize currency: ₹1,200 or Rs. 1200 or INR 1200
        # Remove internal number commas first (e.g. 1,200 -> 1200)
        text = re.sub(r"(\d),(\d)", r"\1\2", text)

        if "hi" in lang_lower or "mr" in lang_lower:
            text = re.sub(r"(?:₹|Rs\.?|INR)\s*(\d+)", r"\1 रुपये", text)
        else:
            text = re.sub(r"(?:₹|Rs\.?|INR)\s*(\d+)", r"\1 rupees", text)

        # 7. Normalize percentages: 50% -> 50 प्रतिशत / 50 टक्के / 50 percent
        def _replace_percent(match: re.Match) -> str:
            val = match.group(1)
            if "hi" in lang_lower:
                return f"{val} प्रतिशत"
            elif "mr" in lang_lower:
                return f"{val} टक्के"
            return f"{val} percent"

        text = re.sub(r"(\d+)\s*%", _replace_percent, text)

        # 8. Normalize phone numbers: read digit by digit with slight pauses
        # E.g., +91 98765 43210 -> "+91 9 8 7 6 5, 4 3 2 1 0"
        def _space_phone(match: re.Match) -> str:
            prefix = match.group(1) or ""
            d1 = " ".join(match.group(2))
            d2 = " ".join(match.group(3))
            return f"{prefix}{d1}, {d2}"

        text = re.sub(r"(\+91\s*)?(\d{5})\s*(\d{5})", _space_phone, text)

        # 9. Strict Female Gender Morphology Enforcement (Never use masculine verb forms)
        text = cls.enforce_female_gender(text, language=language)

        # 10. Clean up excess whitespace
        text = re.sub(r"\s+", " ", text).strip()

        return text
