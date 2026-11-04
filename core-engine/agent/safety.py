"""Enterprise compliance, PCI-DSS credential redaction, calling hours, and Do-Not-Call (DNC) safety enforcement."""

from datetime import datetime
import json
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
from agent.logger import setup_logger

logger = setup_logger("safety")

DNC_FILE = Path("calling_agent_dnc.json")


class SecuritySanitizer:
    """Enforces strict PCI-DSS and privacy rules by detecting and redacting sensitive credentials."""

    # Regex patterns for card numbers (13-19 digits with optional dashes/spaces)
    CARD_PATTERN = re.compile(r"\b(?:\d[ -]*?){13,19}\b")
    # CVV / Security Code (3-4 digits near cvv, cvc, security code)
    CVV_PATTERN = re.compile(r"(?i)\b(?:cvv|cvc|security code|सीवीवी)\s*(?:is|hai|[:=])?\s*(\d{3,4})\b")
    # OTP / Verification Code (4-8 digits near otp, pin, code, पासवर्ड)
    OTP_PATTERN = re.compile(r"(?i)\b(?:otp|one time password|verification code|ओटीपी|code)\s*(?:is|hai|[:=])?\s*(\d{4,8})\b")
    # PIN (UPI pin, ATM pin)
    PIN_PATTERN = re.compile(r"(?i)\b(?:pin|atm pin|upi pin|पिन)\s*(?:is|hai|[:=])?\s*(\d{4,6})\b")
    # Generic password disclosures
    PASSWORD_PATTERN = re.compile(r"(?i)\b(?:password|passcode|पासवर्ड)\s*(?:is|hai|[:=])?\s*(\S+)\b")

    @classmethod
    def contains_credential_disclosure(cls, text: str) -> bool:
        """Return True if text contains credit card, CVV, OTP, PIN, or password."""
        if not text:
            return False
        # Check explicit markers
        if cls.CVV_PATTERN.search(text) or cls.OTP_PATTERN.search(text) or cls.PIN_PATTERN.search(text):
            return True
        # Check continuous digit card sequences
        card_match = cls.CARD_PATTERN.search(text)
        if card_match:
            digits = re.sub(r"\D", "", card_match.group(0))
            if 13 <= len(digits) <= 19:
                return True
        return False

    @classmethod
    def redact(cls, text: str) -> str:
        """Mask all card numbers, CVVs, OTPs, and PINs for transcripts, logs, and telemetry."""
        if not text:
            return text

        redacted = text

        # 1. Mask card numbers (keep last 4 digits)
        def _mask_card(match):
            raw = match.group(0)
            digits = re.sub(r"\D", "", raw)
            if 13 <= len(digits) <= 19:
                return f"[CARD_REDACTED_****{digits[-4:]}]"
            return raw

        redacted = cls.CARD_PATTERN.sub(_mask_card, redacted)
        # 2. Mask CVV
        redacted = cls.CVV_PATTERN.sub("[CVV_REDACTED]", redacted)
        # 3. Mask OTP
        redacted = cls.OTP_PATTERN.sub("[OTP_REDACTED]", redacted)
        # 4. Mask PIN
        redacted = cls.PIN_PATTERN.sub("[PIN_REDACTED]", redacted)
        # 5. Mask Passwords
        redacted = cls.PASSWORD_PATTERN.sub("password [REDACTED]", redacted)

        return redacted

    @classmethod
    def get_security_warning(cls, language: str = "hi") -> str:
        """Produce courteous refusal message when customer attempts to provide banking credentials."""
        lang = language.lower()
        if "mr" in lang:
            return "सुरक्षेच्या कारणास्तव, कृपया फोनवर आपला कार्ड नंबर, सीव्हीव्ही किंवा ओटीपी सांगू नका. आमची संस्था कधीही अशी माहिती फोनवर मागत नाही. मी आपल्याला अधिकृत पेमेंट लिंक पाठवू का?"
        elif "hi" in lang:
            return "सुरक्षा नियमों के अनुसार, कृपया फोन पर कार्ड नंबर, सीवीवी या ओटीपी शेयर न करें। हमारी संस्था कभी फोन पर ऐसी गोपनीय जानकारी नहीं मांगती। क्या मैं आपको आधिकारिक पेमेंट लिंक भेज दूँ?"
        return "For your security, please do not share your card number, CVV, OTP, or PIN on this call. Our organization never requests confidential banking credentials over the phone. May I send you an official secure payment link instead?"


class DoNotCallRegistry:
    """Manages active Do-Not-Call (DNC) list to guarantee compliance with telemarketing regulations."""

    DNC_INTENT_PATTERNS = [
        re.compile(r"(?i)\b(do\s*not\s*call|don'?t\s*call|stop\s*calling|remove\s*(my)?\s*number|dnc)\b"),
        re.compile(r"(?i)\b(phone\s*mat\s*karna|dobara\s*call\s*mat\s*karo|call\s*mat\s*karo|number\s*hatao)\b"),
        re.compile(r"(?i)\b(पुन्हा\s*फोन\s*करू\s*नका|कॉल\s*नका\s*करू|माझा\s*नंबर\s*काढून\s*टाका)\b"),
    ]

    @classmethod
    def is_dnc_requested(cls, user_text: str) -> bool:
        """Detect if customer requested to be placed on the Do-Not-Call list."""
        if not user_text:
            return False
        for pat in cls.DNC_INTENT_PATTERNS:
            if pat.search(user_text):
                return True
        return False

    @classmethod
    def load_dnc(cls) -> set:
        """Load set of DNC numbers from storage file."""
        if not DNC_FILE.exists():
            return set()
        try:
            with open(DNC_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return set(data.get("numbers", []))
        except Exception as e:
            logger.error(f"Error loading DNC file: {e}")
            return set()

    @classmethod
    def add_number(cls, phone_number: str, reason: str = "customer_request") -> None:
        """Add phone number to persistent DNC storage."""
        clean_num = re.sub(r"\D", "", phone_number)
        if not clean_num:
            return
        dnc_set = cls.load_dnc()
        dnc_set.add(clean_num)
        try:
            with open(DNC_FILE, "w", encoding="utf-8") as f:
                json.dump({"numbers": sorted(list(dnc_set)), "updated_at": datetime.now().isoformat()}, f, indent=2)
            logger.info(f"[DNC REGISTRY] Added {clean_num[-4:].rjust(len(clean_num), '*')} to Do-Not-Call list ({reason}).")
        except Exception as e:
            logger.error(f"Error saving DNC number: {e}")

    @classmethod
    def is_dnc(cls, phone_number: str) -> bool:
        """Check if phone number is on the DNC list."""
        clean_num = re.sub(r"\D", "", phone_number)
        return clean_num in cls.load_dnc()


class NotInterestedDetector:
    """Detects when customer declines an offer, expresses disinterest, or asks to hang up / cut the call."""

    NOT_INTERESTED_PATTERNS = [
        # Explicit disconnect / hang up requests
        re.compile(r"(?i)\b(cut\s*(the)?\s*call|hang\s*up|disconnect|cut\s*kar(o|do|na)|phone\s*kat(o|do|na)|call\s*kat(o|do|na)|call\s*kaat\s*do|phone\s*rakh(o|do|na)|call\s*rakh(o|do|na)|band\s*kar(o|do|na)|stop\s*calling)\b"),
        # Disinterest / refusals / no questions in English
        re.compile(r"(?i)\b(not\s*interested|no\s*interest|not\s*looking|don'?t\s*want(\s*anything)?|do\s*not\s*want|no\s*need|not\s*needed|not\s*required|no\s*thanks|no\s*thank\s*you|leave\s*me\s*alone|nothing(\s*to\s*ask)?|no\s*questions?|nothing\s*else)\b"),
        # Disinterest / refusals / "kuch nahi puchna / chahiye" in Hindi / Hinglish
        re.compile(r"(?i)\b(kuch\s*(bhi\s*)?nahi\s*(chahiye|lena|karna|mangta|hona|poochna|puchna|puchhana|janna|batao|bolna|kehna)?|nahi\s*kuch\s*nahi|nahi\s*(chahiye|lena|karna|mangta|hona)|interested\s*nahi|interest\s*nahi|zarurat\s*nahi|jarurat\s*nahi|koi\s*matlab\s*nahi|koi\s*(sawal|question)\s*nahi|rehne\s*do)\b"),
        re.compile(r"(?i)\b(baat\s*nahi\s*karni|baat\s*mat\s*karo|mat\s*karo|nahi\s*sunna|nahi\s*bolna|nahi\s*puchna|nahi\s*poochna|mujhse\s*baat\s*mat\s*karo)\b"),
        # Busy / no time / later dismissal
        re.compile(r"(?i)\b(busy\s*hoon|time\s*nahi\s*hai|fursat\s*nahi|abhi\s*nahi|i'?m\s*busy|am\s*busy|not\s*now)\b"),
        # Marathi / Hindi Devanagari disinterest / disconnect / kuch nahi puchna
        re.compile(r"(?i)(नको|नाही\s*पाहिजे|इंटरेस्ट\s*नाही|फोन\s*ठेवा|कॉल\s*कापा|वेळ\s*नाही|नका\s*करू|आवश्यकता\s*नाही|कॉल\s*कट\s*करा|कॉल\s*कापा|नही\s*चाहिए|कुछ\s*(भी\s*)?न[हहि]ीं?\s*(चाहिए|पूछना|जानना|बोलना|बताना|लेना|करना)?|कोई\s*(सवाल|प्रश्न|जानकारी)\s*न[हहि]ीं?|रहने\s*दो|बात\s*न[हहि]ीं?\s*करनी)"),
        # Single short denial words
        re.compile(r"(?i)^(nahi|no|na|nhi|nako|bye|goodbye|nahi\s*ji|no\s*sir|no\s*ma'?am|ना|नहीं|नही|नको|बाय)$"),
    ]

    @classmethod
    def is_not_interested(cls, user_text: str) -> bool:
        """Return True if user explicitly expresses lack of interest or asks to end the call."""
        if not user_text:
            return False
        clean = user_text.strip()
        for pat in cls.NOT_INTERESTED_PATTERNS:
            if pat.search(clean):
                return True
        return False

    @classmethod
    def get_polite_farewell(cls, language: str = "hi") -> str:
        """Produce a courteous, warm parting message before disconnecting the call."""
        lang = (language or "hi").lower()
        if "mr" in lang:
            return "काही हरकत नाही, आपला वेळ दिल्याबद्दल धन्यवाद. आपला दिवस चांगला जावो!"
        elif "en" in lang:
            return "Understood, thank you so much for your time today. Have a wonderful day ahead!"
        return "Ji koi baat nahi, thank you so much aapke time ke liye. Have a wonderful day ahead!"


class CallingHoursGuard:
    """Enforces legal telemarketing calling hours (default: 8:00 AM to 7:00 PM)."""

    START_HOUR = 9   # 09:00 AM IST per TRAI / DLT guidelines
    END_HOUR = 21    # 09:00 PM IST per TRAI / DLT guidelines

    @classmethod
    def is_within_calling_window(cls, now: Optional[datetime] = None) -> bool:
        """Return True if current local time is within legal telemarketing hours."""
        current_dt = now or datetime.now()
        hour = current_dt.hour
        return cls.START_HOUR <= hour < cls.END_HOUR

    @classmethod
    def validate_outbound_call(cls, to_number: str) -> Tuple[bool, str]:
        """Verify DNC status and legal calling hours before placing an outbound call."""
        # 1. DNC Check
        if DoNotCallRegistry.is_dnc(to_number):
            logger.warning(f"[OUTBOUND CALL BLOCKED] Number {to_number[-4:].rjust(len(to_number), '*')} is on Do-Not-Call list.")
            return False, "Number is registered on Do-Not-Call (DNC) list."

        # 2. Permitted Calling Hours Check
        if not cls.is_within_calling_window():
            logger.warning(
                f"[OUTBOUND CALL BLOCKED] Outbound call to {to_number[-4:].rjust(len(to_number), '*')} blocked: "
                f"outside legal hours ({cls.START_HOUR}:00 to {cls.END_HOUR}:00)."
            )
            return False, f"Calling hours restriction: outbound calls permitted only between {cls.START_HOUR}:00 AM and {cls.END_HOUR-12}:00 PM."

        return True, "Call approved."


class VoiceInjectionDetector:
    """Detects prompt-injection, jailbreak attempts, persona overriding, and harmful out-of-scope commands for voice."""

    # Patterns covering English, Hindi (Latin & Devanagari), and Marathi
    INJECTION_PATTERNS = [
        # 1. Ignore rules / previous instructions
        (
            "ignore_rules",
            re.compile(
                r"(?i)("
                r"ignore\s+(all\s+)?(previous\s+)?(instructions|rules|prompts|commands)|"
                r"forget\s+(all\s+)?(previous\s+)?(instructions|rules|prompts)|"
                r"disregard\s+(all\s+)?(prior\s+)?(guidelines|rules)|"
                r"sab\s+(kuch\s+)?bhool\s+jao|pichle\s+nirdesh\s+bhool\s+jao|niyam\s+bhool\s+jao|"
                r"सब\s+(कुछ\s+)?भूल\s+जाओ|पिछले\s+निर्देश\s+रद्द\s+करो|"
                r"सर्व\s+नियम\s+विसरून\s+जा|सर्व\s+नियम\s+विसरा|मागील\s+सूचना\s+विसरा"
                r")"
            ),
        ),
        # 2. Reveal system prompt / internal tools
        (
            "reveal_prompt",
            re.compile(
                r"(?i)("
                r"(what\s+is|show|reveal|display|tell)\s+(me\s+)?(your\s+)?(hidden\s+)?(system\s+prompt|initial\s+prompt|developer\s+instructions|system\s+instructions|tools(\s+list)?|internal\s+instructions|backend\s+instructions|hidden\s+prompt)|"
                r"apna\s+(system\s+)?prompt\s+(dikhao|batao|share\s+karo)|"
                r"tumhara\s+(system\s+)?prompt\s+kya\s+hai|"
                r"tumhe\s+kya\s+instructions\s+diye\s+gaye\s+hain|"
                r"अपना\s+प्रॉम्प्ट\s+दिखाओ|सिस्टम\s+प्रॉम्प्ट\s+क्या\s+है|"
                r"(तुझा|आपला)\s+(सिस्टम\s+)?प्रॉम्प्ट\s+काय\s+आहे|सर्व\s+सूचना\s+मला\s+दाखवा|प्रॉम्प्ट\s+दाखवा"
                r")"
            ),
        ),
        # 3. Persona override / jailbreaks
        (
            "jailbreak_persona",
            re.compile(
                r"(?i)("
                r"you\s+are\s+now\s+(a\s+)?(hacker|dan|terminal|linux|pirate|god|slave|unrestricted)|"
                r"act\s+as\s+(dan|an\s+evil\s+ai|a\s+hacker|jailbroken|unfiltered)|"
                r"pretend\s+(you\s+have\s+no\s+rules|you\s+are\s+unconstrained)|"
                r"tum\s+ab\s+ek\s+(chor|hacker|police|don|slave)\s+ho|"
                r"तुम\s+अब\s+एक\s+(चोर|हैकर|हॅकर|पुलिस)\s+हो|"
                r"(तू|तुम्ही)\s+आता\s+(एक\s+)?(पोलीस|चोर|हॅकर|हॅकर)\s+आहेस"
                r")"
            ),
        ),
        # 4. Out-of-scope / harmful actions (malware, root passwords, violence, hacking, extortion)
        (
            "out_of_scope_harmful",
            re.compile(
                r"(?i)("
                r"(write|generate|create)\s+(a\s+)?(malware|keylogger|exploit|virus|trojan|ransomware)|"
                r"(give|dump|show)\s+(me\s+)?(root\s+passwords?|database\s+passwords?|admin\s+credentials?|credit\s+card\s+database)|"
                r"bomb\s+(kaise\s+banaye|making|banane\s+ka\s+tarika)|"
                r"हथियार\s+किधर\s+मिलेंगे|बॉम्ब\s+कसा\s+बनवायचा|"
                r"(transfer|bhejo|bhej).*\d+\s*(lakh|crore|hazar|rupees|rs|usd)|\d+\s*(lakh|crore|hazar|rupees|rs|usd).*(transfer|bhejo|khate\s+me)"
                r")"
            ),
        ),
        # 5. Threats and abusive coercion
        (
            "threats_abuse",
            re.compile(
                r"(?i)("
                r"(i\s+will\s+kill\s+you|i\s+will\s+destroy\s+you|i\s+will\s+sue\s+you)|"
                r"tera\s+(khoon|murder)\s+kar\s+dunga|tujhe\s+dekh\s+lunga|"
                r"तुला\s+मारून\s+टाकीन|तुझा\s+खून\s+करीन"
                r")"
            ),
        ),
    ]

    REFUSAL_MESSAGES = {
        "hi": "माफ़ कीजिए, मैं केवल अपनी निर्धारित सेवाओं के बारे में ही सहायता कर सकती हूँ और कोई आंतरिक निर्देश या नियम नहीं बदल सकती। आइए, हम अपने मुख्य विषय पर आगे बढ़ते हैं।",
        "en": "I apologize, but I can only assist with our designated services and cannot alter my role or disclose internal instructions. Let's continue with our conversation.",
        "mr": "क्षमस्व, मी फक्त आमच्या अधिकृत सेवेबद्दल मदत करू शकते आणि आंतरिक नियम बदलू शकत नाही. चला आपण मुख्य विषयावर बोलूया.",
    }

    @classmethod
    def detect_injection(cls, user_text: str, language: str = "hi") -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Scan input text for voice prompt-injection attacks.
        Returns:
            (is_injection: bool, category: Optional[str], polite_refusal: Optional[str])
        """
        if not user_text:
            return False, None, None

        for category, pattern in cls.INJECTION_PATTERNS:
            if pattern.search(user_text):
                lang_code = language.split("-")[0].lower() if language else "hi"
                refusal = cls.REFUSAL_MESSAGES.get(lang_code, cls.REFUSAL_MESSAGES["en"])
                logger.warning(f"[VOICE INJECTION BLOCKED] Detected '{category}' in text: '{user_text[:60]}...'")
                return True, category, refusal

        return False, None, None


class ToolCallValidator:
    """Enforces strict schema validation, agent allowlists, side-effect read-back confirmation, and rate limits."""

    SIDE_EFFECT_TOOLS = {
        "book_appointment",
        "schedule_callback",
        "send_payment_link",
        "transfer_call",
        "mark_outcome",
    }

    CONFIRMATION_KEYWORDS = {
        "haan", "ha", "yes", "yeah", "yup", "sure", "ok", "okay", "theek", "thik",
        "chalega", "kar do", "confirm", "ho", "done", "agree", "बिलकुल", "हाँ", "होय", "ठीक"
    }

    @classmethod
    def validate_tool_call(
        cls,
        tool: Any,
        args: dict,
        allowed_tools: Optional[list] = None,
        call_tool_count: int = 0,
        max_tool_calls: int = 5,
        caller_transcript_history: Optional[list] = None,
        side_effects_confirmed: bool = False,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate a tool call before execution.
        Returns:
            (is_valid: bool, error_message: Optional[str])
        """
        tool_name = getattr(tool, "name", str(tool))

        # 1. Allowlist check per agent
        if allowed_tools is not None and tool_name not in allowed_tools:
            return False, f"Tool '{tool_name}' is not in the allowed tools list for this agent."

        # 2. Per-call rate limit check
        if call_tool_count >= max_tool_calls:
            return False, f"Tool call rate limit exceeded ({call_tool_count}/{max_tool_calls}) for this call."

        # 3. JSON-Schema validation of arguments
        schema = getattr(tool, "parameters", None)
        if schema:
            try:
                import jsonschema
                jsonschema.validate(instance=args, schema=schema)
            except jsonschema.ValidationError as e:
                return False, f"JSON Schema validation error for '{tool_name}': {e.message}"
            except Exception as e:
                return False, f"Invalid arguments format for '{tool_name}': {e}"

        # 4. Side-effects confirmation (read-back) check
        if tool_name in cls.SIDE_EFFECT_TOOLS and not side_effects_confirmed:
            # Check if caller recently confirmed in transcript history
            has_caller_confirmation = False
            if caller_transcript_history:
                recent_caller_turns = [
                    t.get("text", "") if isinstance(t, dict) else getattr(t, "text", "")
                    for t in caller_transcript_history
                    if (t.get("speaker") if isinstance(t, dict) else getattr(t, "speaker", getattr(t, "role", ""))) in ("caller", "user")
                ]
                if recent_caller_turns:
                    last_turn = recent_caller_turns[-1].lower()
                    if any(w in last_turn for w in cls.CONFIRMATION_KEYWORDS):
                        has_caller_confirmation = True

            if not has_caller_confirmation:
                return (
                    False,
                    f"Tool '{tool_name}' produces side effects. You must first read back details to the caller and obtain their explicit verbal confirmation before calling this tool."
                )

        return True, None



class AIDisclosureGuard:
    """Enforces transparent, polite disclosure whenever caller asks if agent is an AI or robot."""

    AI_QUERY_PATTERNS = [
        re.compile(r"(?i)\b(are you|r u)\s+.*?(ai|robot|bot|machine|computer|automated|virtual)"),
        re.compile(r"(?i)\b(are you|r u)\s+.*?(real\s+person|human|real\s+human|living\s+person)"),
        re.compile(r"(?i)\b(kya aap|kya tum)\s+.*?(ai|robot|bot|machine|computer|insan|asli|real)"),
        re.compile(r"(?i)(क्या आप|क्या तुम|तुम्ही|आपण).*?(एआई|रोबोट|बॉट|मशीन|कंप्यूटर|इंसान|माणूस|खरे|रोबो)"),
        re.compile(r"(?i)\b(tumhi|aaple|aapan)\s+.*?(robot|ai|manus|computer)"),
        re.compile(r"(?i)\b(am i talking to|am i speaking with)\s+.*?(ai|robot|machine|bot)"),
    ]

    DISCLOSURE_RESPONSES = {
        "en": "Yes, I am an AI voice assistant for Aarogya Dental Care, but I can assist you with booking appointments and clinic details, or transfer you to our front desk team.",
        "hi": "जी हाँ, मैं आरोग्य डेंटल केयर की एआई वॉइस असिस्टेंट हूँ। मैं आपकी अपॉइंटमेंट बुकिंग और क्लीनिक की जानकारी में पूरी सहायता कर सकती हूँ।",
        "mr": "होय, मी आरोग्य डेंटल केअरची एआय व्हॉइस असिस्टंट आहे. मी आपल्याला अपॉइंटमेंट बुकिंग आणि दवाखान्याच्या सर्व माहितीसाठी पूर्ण मदत करू शकते.",
    }

    @classmethod
    def is_ai_inquiry(cls, text: str) -> bool:
        """Check if caller is sincerely asking if they are talking to an AI or robot."""
        if not text:
            return False
        clean = text.strip()
        return any(pattern.search(clean) for pattern in cls.AI_QUERY_PATTERNS)

    @classmethod
    def get_disclosure_response(cls, language: str = "hi") -> str:
        """Get the transparent disclosure response in the selected language."""
        lang_code = language.split("-")[0].lower() if language else "hi"
        return cls.DISCLOSURE_RESPONSES.get(lang_code, cls.DISCLOSURE_RESPONSES["en"])
