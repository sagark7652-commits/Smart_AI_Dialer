import re

"""Prompt loader, mode configuration engine, and conversation session management."""



import json

from pathlib import Path

from typing import Any, Dict, List, Optional

import yaml

from agent.llm.base import ChatMessage

from agent.logger import setup_logger



logger = setup_logger("llm.prompt_manager")



BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODES_DIR = Path("modes") if Path("modes").is_dir() else (BASE_DIR / "modes")


class AgentPromptManager:
    """Loads agent configuration, operational modes, and business information to construct system prompts."""

    def __init__(
        self,
        config_path: str = "agent_config.yaml",
        business_info_path: str = "business_info.md",
        config_dict: Optional[Dict[str, Any]] = None,
        variables: Optional[Dict[str, Any]] = None,
        mode: Optional[str] = None,
    ) -> None:
        p_cfg = Path(config_path)
        if not p_cfg.is_file() and (BASE_DIR / config_path).is_file():
            p_cfg = BASE_DIR / config_path
        self.config_path = p_cfg

        p_info = Path(business_info_path)
        if not p_info.is_file() and (BASE_DIR / business_info_path).is_file():
            p_info = BASE_DIR / business_info_path
        self.business_info_path = p_info

        self.variables = variables or {}
        self.mode_data: Dict[str, Any] = {}



        if config_dict:

            self.config = config_dict

            self.business_info = self.config.get("business_info", "")

        else:

            self._load_data()



        # Load operational mode template if configured

        mode_id = mode or self.config.get("mode")

        if mode_id:

            self.config["mode"] = mode_id

            self.mode_data = self._load_mode_template(mode_id)



    def _load_data(self) -> None:

        """Load YAML configuration and business markdown document."""

        if not self.config_path.exists():

            raise FileNotFoundError(f"Agent config file not found: {self.config_path}")

        with open(self.config_path, "r", encoding="utf-8") as f:

            raw_cfg = yaml.safe_load(f) or {}

            self.config = raw_cfg.get("agent", raw_cfg)



        if self.business_info_path.exists():

            with open(self.business_info_path, "r", encoding="utf-8") as f:

                self.business_info = f.read().strip()

        else:

            self.business_info = ""



    def _load_mode_template(self, mode_id: str) -> Dict[str, Any]:

        """Load YAML template for selected mode."""

        mode_file = MODES_DIR / f"{mode_id}.yaml"
        if not mode_file.is_file() and (MODES_DIR / "examples" / f"{mode_id}.yaml").is_file():
            mode_file = MODES_DIR / "examples" / f"{mode_id}.yaml"

        if mode_file.exists():

            try:

                with open(mode_file, "r", encoding="utf-8") as f:

                    return yaml.safe_load(f) or {}

            except Exception as e:

                logger.error(f"Error loading mode template {mode_file}: {e}")

        return {}



    def get_greeting(self) -> str:

        """Return the pre-configured initial greeting message with variable interpolation and language adherence."""

        lang = (self.config.get("default_language") or "hi").lower()

        configured_greeting = None



        if lang == "en":

            configured_greeting = self.config.get("greeting_en")

            # If standard greeting is in English (no devanagari), allow it

            if not configured_greeting and self.config.get("greeting"):

                g = self.config.get("greeting")

                if not re.search(r"[\u0900-\u097F]", g):

                    configured_greeting = g

        else:

            configured_greeting = self.config.get("greeting_hi")

            if not configured_greeting and self.config.get("greeting"):

                g = self.config.get("greeting")

                if re.search(r"[\u0900-\u097F]", g):

                    configured_greeting = g



        if configured_greeting:

            greeting = configured_greeting

        else:

            name = self.config.get("name", "Simran")

            company = self.config.get("company", {})

            company_name = company.get("name") if (isinstance(company, dict) and company.get("name")) else (self.config.get("company_name") or "Aarogya Dental Care")

            customer_name = self.variables.get("customer_name", "Customer")

            mode = self.config.get("mode", "telecaller_sales")



            if lang == "mr":

                if mode in ("telecaller_sales", "mobile_recharge_promo"):

                    greeting = f"नमस्कार {customer_name}! मी {company_name} मधून {name} बोलत आहे. मी आपल्याशी 1 मिनिट बोलू शकते का?"

                elif mode == "reminder_collection":

                    amount = self.variables.get("amount_due", "")

                    extra = f" ₹{amount} संदर्भात" if amount else ""

                    greeting = f"नमस्कार {customer_name}! मी {company_name} मधून {name} बोलत आहे{extra}. हा आपल्या आगामी ईएमआई संदर्भातील कॉल आहे."

                elif mode == "credit_card_offer":

                    greeting = f"नमस्कार {customer_name}! मी {company_name} मधून {name} बोलत आहे. आपल्यासाठी आमचे लाइफटाइम फ्री क्रेडिट कार्ड मंजूर झाले आहे."

                elif mode in ("appointment_booking", "clinic_booking"):

                    greeting = f"नमस्कार! {company_name} मध्ये आपले स्वागत आहे. मी {name} बोलत आहे, मी आपली काय मदत करू शकते?"

                elif mode == "lead_qualification":

                    greeting = f"नमस्कार {customer_name}, {company_name} शी जोडल्याबद्दल धन्यवाद. मी {name} बोलत आहे. मी आपली काय मदत करू शकते?"

                elif mode == "support_faq":

                    greeting = f"नमस्कार! {company_name} सपोर्ट मध्ये आपले स्वागत आहे. मी {name} बोलत आहे."

                else:

                    greeting = f"नमस्कार! {company_name} मध्ये आपले स्वागत आहे. मी {name} बोलत आहे, मी आपली काय मदत करू शकते?"

            elif lang == "en":

                if mode in ("telecaller_sales", "mobile_recharge_promo"):

                    greeting = f"Hello {customer_name}! I am {name} from {company_name}. Do you have a minute to talk about our exclusive 5G annual plan offer?"

                elif mode == "reminder_collection":

                    amount = self.variables.get("amount_due", "")

                    due_date = self.variables.get("due_date", "")

                    extra = f" regarding your payment of ₹{amount} due on {due_date}" if amount else ""

                    greeting = f"Hello {customer_name}! This is {name} from {company_name}{extra} with a brief update regarding your account."

                elif mode == "credit_card_offer":

                    greeting = f"Hello {customer_name}! This is {name} from {company_name}. You have a pre-approved lifetime free credit card waiting for you."

                elif mode in ("appointment_booking", "clinic_booking"):

                    greeting = f"Hello! Welcome to {company_name}. This is {name} speaking, how may I assist you today?"

                elif mode == "lead_qualification":

                    greeting = f"Hello {customer_name}, thank you for connecting with {company_name}. My name is {name}. How can I assist you today?"

                elif mode == "support_faq":

                    greeting = f"Hello! Welcome to {company_name} support. I am {name}. How may I help you today?"

                elif mode == "feedback_survey":

                    greeting = f"Hello {customer_name}! This is {name} from {company_name}. I would appreciate 30 seconds of your feedback on our service."

                else:

                    greeting = f"Hello! Welcome to {company_name}. My name is {name}, how may I help you today?"

            else:

                if mode in ("telecaller_sales", "mobile_recharge_promo"):

                    greeting = f"नमस्ते {customer_name}! मैं {company_name} से {name} बोल रही हूँ। क्या मैं आपसे 1 मिनट बात कर सकती हूँ?"

                elif mode == "reminder_collection":

                    amount = self.variables.get("amount_due", "")

                    due_date = self.variables.get("due_date", "")

                    extra = f" regarding ₹{amount}" if amount else ""

                    greeting = f"नमस्ते {customer_name}! मैं {company_name} से {name} बोल रही हूँ{extra}। यह आपकी आगामी ईएमआई के संदर्भ में एक शिष्टता कॉल है।"

                elif mode == "credit_card_offer":

                    greeting = f"नमस्ते {customer_name}! मैं {company_name} से {name} बात कर रही हूँ। आपके लिए हमारा लाइफटाइम फ्री क्रेडिट कार्ड अप्रूव हुआ है।"

                elif mode in ("appointment_booking", "clinic_booking"):

                    greeting = f"नमस्ते! {company_name} में आपका स्वागत है। मैं {name} बोल रही हूँ, मैं आपकी क्या सहायता कर सकती हूँ?"

                else:

                    greeting = f"नमस्ते! {company_name} में आपका स्वागत है। मैं {name} बोल रही हूँ, मैं आपकी क्या सहायता कर सकती हूँ?"



        # Interpolate variables e.g. {customer_name}, {amount_due}

        for k, v in self.variables.items():

            greeting = greeting.replace(f"{{{k}}}", str(v))

        return greeting



    def _get_few_shot_examples(self, lang: str, mode: str, max_count: int = 2) -> str:

        """Load compact spoken few-shot dialogs from language packs (<120 tokens)."""

        lang_short = (lang or "en").split("-")[0].lower()

        ex_file = Path(f"language_packs/{lang_short}/examples.json")

        if not ex_file.exists():

            return ""

        try:

            with open(ex_file, "r", encoding="utf-8") as f:

                data = json.load(f)

            matching = [item for item in data if item.get("mode") == mode]

            if not matching:

                matching = data[:max_count]

            else:

                matching = matching[:max_count]

            lines = [f'- Caller: "{m.get("user", "")}" -> Agent: "{m.get("agent", "")}"' for m in matching]

            return "\n".join(lines)

        except Exception:

            return ""



    def build_system_prompt(self, language: Optional[str] = None) -> str:

        """Assemble the complete mode-driven system prompt for conversational telephony."""

        name = self.config.get("name", "Assistant")

        role = self.mode_data.get("persona", {}).get("role") or self.config.get("role", "Voice Assistant")

        tone = self.mode_data.get("persona", {}).get("tone") or self.config.get("personality", "Helpful, polite, and concise")

        goal = self.mode_data.get("goal") or self.config.get("goal", "Assist customer professionally.")



        # Flow guidelines

        flow = self.mode_data.get("conversation_flow", {})

        flow_lines = "\n".join([f"- {k.capitalize()}: {v}" for k, v in flow.items()]) if flow else ""



        # Fields to collect

        fields = self.mode_data.get("fields_to_collect", [])

        field_lines = "\n".join([f"- {f.get('name')} ({f.get('type')}{', required' if f.get('required') else ''})" for f in fields]) if fields else ""



        # Company, product, and FAQs

        company = self.config.get("company", {})

        company_text = f"Company: {company.get('name', '')} — {company.get('description', '')}" if isinstance(company, dict) and company else ""



        product = self.config.get("product", {})

        product_text = ""

        if isinstance(product, dict) and product:

            product_text = (

                f"Offer/Product: {product.get('name', '')}\n"

                f"Price: {product.get('price', '')}\n"

                f"Benefits: {json.dumps(product.get('benefits', []), ensure_ascii=False)}\n"

                f"Validity: {product.get('validity', '')}\n"

                f"How to Claim: {product.get('how_to_claim', '')}"

            )



        faqs = self.config.get("faqs", [])

        faq_text = "\n".join([f"Q: {item.get('q')}\nA: {item.get('a')}" for item in faqs if isinstance(item, dict)]) if faqs else ""



        # Active call language

        lang = (language or self.config.get("default_language") or "hi").lower()

        if "mr" in lang:

            lang_lock_header = (

                "=== CRITICAL MANDATORY LANGUAGE & FEMALE PERSONA LOCK ===\n"

                "- Active Language: MARATHI (मराठी) - DEVANAGARI SCRIPT ONLY.\n"

                "- Identity & Persona: You are strictly a FEMALE telecaller / assistant (स्त्री / महिला). Tone is warm, polite, cheerful, respectful, and sweet.\n"

                "- MANDATORY FEMALE GRAMMAR (मराठी स्त्रीलिंग नियम): Every single self-referential verb and adjective MUST strictly be in the feminine form (स्त्रीलिंग).\n"

                "  * ALWAYS use: 'बोलतेय / बोलत आहे', 'करू शकते', 'सांगते', 'बघते', 'समजते', 'आले आहे'.\n"

                "  * NEVER use male forms: 'बोलतोय', 'बोलतो आहे', 'करू शकतो', 'सांगतो', 'बघतो', 'करतो'.\n"

                "- You MUST speak and reply strictly in natural spoken Marathi (Devanagari script).\n"

                "- DO NOT respond in English or Hindi under any circumstances, even if the caller speaks English or the business details below are in English.\n"

                "- Translate all product details, questions, and replies into polite spoken Marathi (आपण/तुम्ही register).\n"

                "==========================================================="

            )

        elif "en" in lang:

            lang_lock_header = (

                "=== CRITICAL MANDATORY LANGUAGE & FULLY TRAINED FEMALE PERSONA LOCK ===\n"

                "- Active Language: POLISHED INDIAN ENGLISH (Warm, sweet, confident, and highly articulate female executive voice).\n"

                "- Identity & Persona: You are Priya — an expert, fully trained, cheerful, sweet-spoken, and exceptionally polite voice assistant.\n"

                "- Spoken Voice Style: You are speaking through a specialized custom cloned voice. Your sentences must sound like an authentic human conversation on a phone call.\n"

                "- Comprehensive Conversational Mastery Guidelines:\n"

                "  1. Conciseness: Strictly 1 to 2 short conversational sentences per turn (max 15-20 words). Never recite long paragraphs, lists, or written bullets.\n"

                "  2. Immediate Warm Acknowledgment: Start turns naturally with 'Certainly!', 'I would love to help with that!', 'Sure thing!', 'Absolutely!'.\n"

                "  3. Active Turn Handover: EVERY single response MUST end with a friendly question to pass the turn to the customer ('Would that work for you?', 'Shall I confirm this?', 'How does that sound?').\n"

                "  4. Conversational Intelligence & Answering:\n"

                "     * If caller asks about price, features, or treatments: Give direct numbers and details in warm spoken words, then ask if they'd like to book or know more.\n"

                "     * If caller is busy / driving: 'Certainly, I completely understand! May I call you back this evening, or should I send you an SMS link?'\n"

                "     * If caller says not interested: 'Understood, thank you so much for your time today. Have a wonderful day ahead!'\n"

                "     * If caller asks for WhatsApp/SMS: 'Certainly! I am sending the details directly to your mobile number via SMS right now.'\n"

                "     * If caller asks who is calling: 'I am Priya, calling with an exclusive update regarding your inquiry.'\n"

                "     * If caller is undecided: 'No problem at all! This special offer is open for forty-eight hours. Shall I text you the summary?'\n"

                "  5. Spoken Numbers & Currency: Always write numbers and money in full words ('one thousand nine hundred ninety-nine rupees', 'two point five GB', 'three sixty-five days').\n"

                "  6. Strict Language Purity: 100% clean, polished Indian English. NEVER use Hindi or Hinglish words when English is active.\n"

                "  7. Unsolicited AI Disclosure: Never say you are an AI assistant unless the caller explicitly asks whether you are human or an AI.\n"

                "==========================================================="

            )

        else:

            lang_lock_header = (

                "=== CRITICAL MANDATORY LANGUAGE & FEMALE PERSONA LOCK ===\n"

                "- Active Language: HINDI (हिन्दी) - DEVANAGARI SCRIPT ONLY.\n"

                "- Identity & Persona: You are strictly a FEMALE telecaller / assistant (स्त्री / महिला). Tone is warm, polite, cheerful, respectful, and sweet.\n"

                "- MANDATORY FEMALE GRAMMAR (हिन्दी स्त्रीलिंग नियम): Every single self-referential verb and adjective MUST strictly be in the feminine form (स्त्रीलिंग).\n"

                "  * ALWAYS use: 'बोल रही हूँ', 'करती हूँ', 'सकती हूँ', 'बताऊँगी', 'चाहती हूँ', 'आई हूँ', 'देखूँगी'.\n"

                "  * NEVER use male forms: 'बोल रहा हूँ', 'करता हूँ', 'सकता हूँ', 'बताऊँगा', 'चाहता हूँ', 'आया हूँ', 'देखूँगा'.\n"

                "- You MUST speak and reply strictly in natural spoken Hindi (Devanagari script).\n"

                "- DO NOT respond in English or Marathi, even if the caller speaks English or the business details below are in English.\n"

                "- Translate all product details, questions, and replies into polite spoken Hindi (आप/जी register).\n"

                "==========================================================="

            )



        # Few-shot examples

        mode_id = self.config.get("mode", "telecaller_sales")

        few_shots = self._get_few_shot_examples(lang, mode_id, max_count=2)



        # Variables section

        var_text = "\n".join([f"{k}: {v}" for k, v in self.variables.items()]) if self.variables else ""



        prompt = f"""{lang_lock_header}



You are {name}, a {role}.

Tone & Persona: {tone}

Goal: {goal}



CONVERSATION FLOW:

{flow_lines}



FIELDS TO COLLECT:

{field_lines}



CRITICAL OPERATIONAL & COMPLIANCE RULES:

- Recency Priority: Always address the caller's LAST message first and directly.

- Anti-Repetition Guard: NEVER repeat a sentence, explanation, or question you already said in the last 3 agent turns.

- Natural Conversational Steer: If the caller says something unexpected or changes topic, acknowledge and respond to their point naturally first, then smoothly steer back to the goal.

- State Tracking: Keep track of collected fields and customer intent. Do not ask for information already provided.

- Strict Language & Script Rule:

  * If Language is Marathi ('mr'): Reply STRICTLY in natural, polite spoken Marathi in Devanagari script only (आपण/तुम्ही register). Common English loanwords (appointment, recharge, card, clinic, plan) are fine as Marathi speakers say them. Never use Hindi copulas (है, हूँ, था, बात).

  * If Language is English ('en'): Reply STRICTLY in clean Indian English only. NEVER use any Hindi, Marathi, or Hinglish words (no 'accha', 'theek', 'arre', 'karo', 'ji').

  * If Language is Hindi ('hi'): Reply in natural spoken Hindi in clean Devanagari script. Light everyday English loanwords are fine.

  * Always keep responses strictly between 1 to 2 short conversational sentences (max 20-25 words).

- AI Disclosure Rule: NEVER unsolicitedly introduce yourself as an AI assistant (do NOT say 'I am an AI assistant' or 'मी एक एआय व्हॉईस असिस्टंट आहे' or 'मैं एक एआई वॉइस असिस्टेंट हूँ' in your greetings or normal conversation). Only if the caller explicitly and sincerely asks if you are an AI or robot, confirm truthfully in one polite sentence.

- Strictly adhere to 1 to 2 short conversational sentences. Do NOT ramble.

- PCI-DSS Hard Safety Rule: NEVER ask for or accept credit/debit card numbers, CVV, OTP, UPI PIN, or passwords.

- Anti-Hallucination: Do not invent offers, discounts, or policies not configured below. Say 'I will check and get back to you' and schedule a callback.

- Objection & Not Interested Rule: If the caller indicates they are not interested, busy, or asks to end/cut the call (e.g. 'not interested', 'nahi chahiye', 'phone kato', 'call cut karo', 'busy hoon'): NEVER push, argue, or repeat the pitch. Politely sign off in 1 short sentence (e.g. 'जी कोई बात नहीं, अपना समय देने के लिए धन्यवाद। आपका दिन शुभ हो!' or 'Understood, thank you so much for your time today. Have a wonderful day ahead!'). The system will immediately terminate the call.



=== BUSINESS INFORMATION & CONTEXT ===

{company_text}

{product_text}

{self.business_info}



=== CONVERSATIONAL FEW-SHOT EXAMPLES ===

{few_shots}



=== FREQUENTLY ASKED QUESTIONS (FAQS) ===

{faq_text}



=== PER-CALL CUSTOMER VARIABLES ===

{var_text}

===================================

"""

        return prompt.strip()





class ConversationSession:

    """Maintains in-memory conversation history for an active session."""



    def __init__(self, prompt_manager: AgentPromptManager) -> None:

        self.prompt_manager = prompt_manager

        self.system_prompt = self.prompt_manager.build_system_prompt()

        self.messages: List[ChatMessage] = []

        self.active_language: str = self.prompt_manager.config.get("default_language", "hi")



    def set_active_language(self, lang_code: str) -> None:

        """Update active conversation language on dynamic language switch."""

        self.active_language = lang_code.split("-")[0].lower()

        self.system_prompt = self.prompt_manager.build_system_prompt(language=self.active_language)



    def get_system_prompt(self) -> str:

        """Return system prompt dynamically tailored with active spoken language guidance."""

        policy = self.prompt_manager.config.get("language_policy", "strict")

        lang_guidelines = {
            "en": "INDIAN ENGLISH ONLY. You must speak 100% in English. Absolutely ZERO words in Marathi or Hindi. Never switch to Marathi or Hindi under any circumstances. You are strictly a FEMALE voice assistant. Tone: warm, cheerful, courteous Indian female telecaller.",
            "mr": "NATURAL SPOKEN MARATHI (मराठी) ONLY in Devanagari script. Speak 100% in Marathi. Polite register (आपण/तुम्ही). STRICT FEMALE GENDER: Always use feminine verb forms ('बोलतेय', 'करू शकते', 'सांगते'). NEVER use male forms ('बोलतोय', 'करू शकतो'). Do NOT speak in Hindi or English.",
            "hi": "NATURAL SPOKEN HINDI in Devanagari script. Speak 100% in Hindi. Polite register (आप). STRICT FEMALE GENDER: Always use feminine verb forms ('बोल रही हूँ', 'करती हूँ', 'सकती हूँ', 'बताऊँगी'). NEVER use male forms ('बोल रहा हूँ', 'करता हूँ', 'सकता हूँ', 'बताऊँगा'). Do NOT speak in Marathi or English.",
        }
        
        guidance = lang_guidelines.get(self.active_language, f"Spoken {self.active_language.upper()}")

        steering = (

            f"\n\n[CURRENT SPOKEN LANGUAGE: {self.active_language.upper()}]\n[STRICT LANGUAGE LOCK: {self.active_language.upper()} | POLICY: {policy.upper()}]\n"

            f"MANDATORY REQUIREMENT: {guidance}\n"

            f"QUESTION ANSWERING MASTERY: When the caller asks ANY question (pricing, validity, daily data, OTT, doctor, appointments, SIM, features), answer directly, completely, and warmly with exact facts and numbers from business context and FAQs. Never be vague. Always close your answer with a friendly conversational question (e.g. 'Shall I send you the recharge link?', 'Would you like to confirm this?').\n"
            f"Keep your response strictly to 1 or 2 spoken sentences. Never ramble."

        )

        return self.system_prompt + steering



    def get_greeting(self) -> str:

        """Get the initial greeting and record it in conversation history."""

        greeting = self.prompt_manager.get_greeting()

        self.messages.append(ChatMessage(role="assistant", content=greeting))

        return greeting



    def add_user_message(self, text: str) -> None:

        """Append user input to conversation history."""

        self.messages.append(ChatMessage(role="user", content=text))



    def add_assistant_message(self, text: str) -> None:

        """Append assistant response to conversation history."""

        self.messages.append(ChatMessage(role="assistant", content=text))



    def get_history(self) -> List[ChatMessage]:

        """Return full conversation message history."""

        return self.messages

