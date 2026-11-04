"""Context-aware Mock LLM for offline testing, benchmarks, and multi-mode simulations.
Features natural human-like telecaller tone, cadence, and strict mode isolation.
"""

import re
from typing import Any, AsyncIterator, Dict, List, Optional, Union
from agent.logger import setup_logger

logger = setup_logger("llm.mock")


class MockLLM:
    """Intelligent rule-based mock LLM supporting multi-mode conversational flows.
    Strictly adheres to chosen mode and language with human-like conversational tone.
    """

    def __init__(self, model_name: str = "mock-conversational-agent") -> None:
        self.model_name = model_name

    async def generate_stream(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> AsyncIterator[Union[str, Dict[str, Any]]]:
        """Stream simulated tokens or tool calls based on caller utterance and persona."""
        sys_lower = (system_prompt or "").lower()
        if messages:
            last_item = messages[-1]
            if isinstance(last_item, dict):
                last_msg = last_item.get("content", "")
            else:
                last_msg = getattr(last_item, "content", str(last_item))
        else:
            last_msg = ""
        lower = last_msg.lower().strip()

        # Strict Single-Mode Identification (No Cross-Contamination)
        if "clinic" in sys_lower or "aarogya" in sys_lower or "dental" in sys_lower:
            active_mode = "clinic"
        elif "telecaller_sales" in sys_lower or "mobile_recharge" in sys_lower or "swifttel" in sys_lower:
            active_mode = "sales"
        elif "credit_card" in sys_lower or "apex bank" in sys_lower:
            active_mode = "card"
        elif "reminder_collection" in sys_lower or "easyfinance" in sys_lower:
            active_mode = "reminder"
        elif "lead_qualification" in sys_lower or "techsolutions" in sys_lower:
            active_mode = "lead"
        elif "feedback_survey" in sys_lower or "csat" in sys_lower:
            active_mode = "feedback"
        elif "support_faq" in sys_lower or "caredesk" in sys_lower:
            active_mode = "support"
        else:
            active_mode = "clinic" if ("aarogya" in sys_lower or "dental" in sys_lower) else "sales"

        # Strict Language Identification
        is_english = "[current spoken language: en]" in sys_lower
        is_marathi = "[current spoken language: mr]" in sys_lower
        if not is_english and not is_marathi:
            from agent.languages import detect_language
            det = detect_language(last_msg)
            if det.short_code == "en":
                is_english = True
            elif det.short_code == "mr":
                is_marathi = True

        # Extract agent name
        name_match = re.search(r"you are\s+([a-zA-Z]+)", system_prompt or "", re.IGNORECASE)
        agent_name = name_match.group(1) if name_match else (
            "Simran" if active_mode == "sales"
            else ("Ananya" if active_mode == "card"
            else ("Aarti" if active_mode == "reminder"
            else ("Kavita" if active_mode == "lead"
            else ("Pooja" if active_mode == "support"
            else ("Sneha" if active_mode == "feedback"
            else "Priya")))))
        )

        # 1. Follow-up responses after tool execution (Warm & Natural)
        if last_msg.startswith("Tool '") or "returned:" in last_msg or "output:" in last_msg:
            if "schedule_callback" in last_msg:
                if is_english:
                    yield "Perfect, I've got that noted down! Our team will give you a quick ring at that time. Have a great day ahead!"
                else:
                    yield "Haanji bilkul, maine time note kar liya hai! Hamari team aapko theek usi time call back kar legi. Have a great day ahead!"
                return
            elif "capture_lead" in last_msg:
                if is_english:
                    yield "Awesome, thank you so much! I have securely saved your details. Our specialist will reach out shortly to help you out."
                else:
                    yield "बहुत-बहुत धन्यवाद! आपकी डिटेल्स नोट हो गई हैं, और हमारी टीम जल्द ही आपसे आगे की बातचीत के लिए कनेक्ट करेगी।"
                return
            elif "send_payment_link" in last_msg:
                if is_english:
                    yield "All done! I've sent the secure payment link straight to your mobile via SMS. You can complete it whenever you're free."
                else:
                    yield "जी, मैंने आपके नंबर पर सुरक्षित पेमेंट लिंक एसएमएस कर दिया है। आप आराम से उस पर क्लिक करके पेमेंट कर सकते हैं।"
                return
            elif "transfer_call" in last_msg:
                if is_english:
                    yield "Sure thing, please hold for just a few seconds while I get you connected to my senior colleague."
                else:
                    yield "जी ज़रूर, बस कुछ सेकंड लाइन पर बने रहिए, मैं आपकी बात हमारे सीनियर स्पेशलिस्ट से करवा देती हूँ।"
                return
            elif "check_availability" in last_msg:
                if is_english:
                    yield "Great! We have slots open tomorrow at 10:30 in the morning and 3:30 in the afternoon. Which time suits you best?"
                else:
                    yield "जी, कल सुबह 10:30 बजे और शाम 3:30 बजे के स्लॉट बिल्कुल खाली हैं। आपको कौन सा समय ज़्यादा सही लगेगा?"
                return
            elif "book_appointment" in last_msg:
                if is_english:
                    yield "You're all set! Your appointment is successfully booked, and I've texted you the confirmation. Anything else I can help with?"
                else:
                    yield "लीजिए, आपकी अपॉइंटमेंट कन्फर्म हो गई है और कन्फर्मेशन मैसेज भी भेज दिया है। क्या मैं आपकी कुछ और मदद करूँ?"
                return
            else:
                if is_english:
                    yield "I've checked that for you. Please let me know what else you'd like to find out!"
                else:
                    yield "जी मैंने डिटेल्स चेक कर ली हैं। आप बताइए, क्या मैं किसी और चीज़ में आपकी मदद करूँ?"
                return

        # 2. Natural AI Disclosure
        if re.search(r"\b(robot|ai|bot|real person|insan|machine|माणूस|रोबोट|who are you|what are you)\b", lower):
            if is_english:
                yield f"Yes! I am {agent_name}, an AI calling assistant. I'm right here to help you out, so please feel free to tell me what you need!"
            elif is_marathi:
                yield f"होय! मी {agent_name} बोलत आहे, एक AI व्हॉइस असिस्टंट. मी आपल्या मदतीसाठी येथे आहे, सांगा मी कशी मदत करू?"
            else:
                yield f"जी हाँ! मैं {agent_name} बात कर रही हूँ, एक AI वॉइस असिस्टेंट। मैं आपकी पूरी मदद के लिए यहाँ हूँ, बताइए मैं कैसे मदद कर सकती हूँ?"
            return

        # 3. PCI-DSS Card / CVV / OTP Refusal
        if re.search(r"\b(card|cvv|4111|otp|pin|password|expiry)\b", lower) and any(c.isdigit() for c in last_msg):
            if is_english:
                yield "For your safety, please never share card numbers or OTP over a phone call. I'll simply send you a secure official payment link via SMS."
            else:
                yield "आपकी सुरक्षा के लिए कृपया फोन पर कार्ड नंबर या ओटीपी शेयर न करें। मैं आपको सुरक्षित आधिकारिक पेमेंट लिंक एसएमएस कर देती हूँ।"
            return

        # 4. Human Transfer
        if re.search(r"\b(human|operator|reception|receptionist|manager|senior|doctor|इंसान|जोडून|बात करा|agent)\b", lower):
            yield {"type": "tool_call", "name": "transfer_call", "arguments": {"destination": "+919876543210"}}
            return

        # 5. Callback / Busy / Later
        if re.search(r"\b(busy|later|baad mein|kal|dopahar|call karna|time nahi|व्यस्त|उद्या|call me later)\b", lower):
            yield {"type": "tool_call", "name": "schedule_callback", "arguments": {"preferred_time": "tomorrow 2:00 PM", "reason": "Customer busy"}}
            return

        # 6. Not Interested / Polite Decline
        if re.search(r"\b(not interested|no interest|nahi chahiye|nahi lena|kuch nahi chahiye|nahi karna|no thanks|nako|mat karo|don't want|bye|stop|cut|kato|rakho|phone kato|call cut|phone rakho|disconnect|baat nahi karni|time nahi|busy hoon|nahi bolna)\b|^(nahi|no|na|nhi)$", lower):
            if is_english:
                yield "Understood, thank you so much for your time today. Have a wonderful day ahead!"
            else:
                yield "Ji koi baat nahi, thank you so much aapke time ke liye. Have a wonderful day!"
            return

        # 7. MODE-SPECIFIC HUMAN-LIKE RESPONSES
        # A. Telecaller Sales / 5G Mobile Recharge Promo
        if active_mode == "sales":
            if re.search(r"\b(offer|plan|recharge|data|5g|price|kitne|batao|kya hai|details|package|pack|discount|benefit|cost|tell me|what plan|kya offer)\b", lower):
                if is_english:
                    yield "Right now, our 5G Unlimited Annual Super Plan gives you 2.5GB high-speed data every single day, unlimited calling anywhere in India, and free Hotstar for just ₹1,999 a year. Pretty amazing deal! Would you like me to activate this for your number?"
                else:
                    yield "Haanji! Hamare 5G Unlimited Super Plan mein pure saal daily 2.5GB high-speed data, unlimited calling aur free Hotstar sirf ₹1,999 mein mil raha hai. Kya main ise aapke number par activate kar doon?"
                return
            elif re.search(r"\b(yes|haan|theek hai|karo|activate|bhej do|le lo|agree|sahi|sure|okay|proceed|kar do|yes please)\b", lower):
                yield {"type": "tool_call", "name": "capture_lead", "arguments": {"name": "Customer", "phone_number": "9876543210", "interest_level": "high"}}
                return
            elif re.search(r"\b(hello|namaste|kaun|who are you|sun rahe ho|kahan se|kya naam|number|telecaller|who is this|hi|hey|haan bol)\b", lower):
                if is_english:
                    yield f"Hey there! I am {agent_name} calling from SwiftTel 5G. I'm reaching out with an exclusive annual 5G plan we've rolled out today. Do you have just a quick minute?"
                else:
                    yield f"Namaste! Main SwiftTel 5G se {agent_name} baat kar rahi hoon. Hamare naye 5G annual offer ke baare mein quick 1 minute baat karni thi. Kya main details share kar sakti hoon?"
                return
            else:
                if is_english:
                    yield "Yes, I'm right here with you! We have fantastic 5G high-speed plans for you today. Would you like me to run through the best benefits?"
                else:
                    yield "Haanji, main sun rahi hoon! Hamare paas aapke liye best 5G data aur calling offers hain. Kya main details share karoon?"
                return

        # B. Banking / Credit Card Offer
        if active_mode == "card":
            if re.search(r"\b(card|credit|offer|cashback|lounge|annual fee|charges|kya offer|details|tell me|benefits)\b", lower):
                if is_english:
                    yield "You have an exclusive pre-approval for the Apex Bank Signature Credit Card with 5% unlimited cashback on online shopping and zero annual fee for life! Would you like to claim it today?"
                else:
                    yield "Haanji! Aapke liye Apex Bank ka lifetime free credit card offer hai jisme 5% unlimited cashback milega aur koi annual charges nahi honge. Kya main application aage badha doon?"
                return
            elif re.search(r"\b(yes|haan|chahiye|apply|le lo|bhejo|sure|interested|proceed)\b", lower):
                yield {"type": "tool_call", "name": "capture_lead", "arguments": {"name": "Customer", "phone_number": "9876543210", "interest_level": "high"}}
                return
            else:
                if is_english:
                    yield f"Hello! This is {agent_name} from Apex Bank. You've got an approved lifetime free credit card waiting. Would you like me to share the perks?"
                else:
                    yield f"Namaste! Main Apex Bank se {agent_name} bol rahi hoon. Aapke liye pre-approved lifetime free credit card ready hai. Kya main benefits share karoon?"
                return

        # C. Collections / Loan EMI Reminder
        if active_mode == "reminder":
            if re.search(r"\b(due|amount|kitna|bill|emi|paisa|bharna|baki|date|kab tak|how much)\b", lower):
                if is_english:
                    yield "Your upcoming loan EMI of ₹4,850 is due by the 5th of this month. Can I quickly text you the safe online payment link right now?"
                else:
                    yield "Ji aapki ₹4,850 ki loan EMI 5th date tak due hai. Kya main payment ke liye safe SMS link bhej doon?"
                return
            elif re.search(r"\b(link|sms|bhejo|send|kar do|pay|send link)\b", lower):
                yield {"type": "tool_call", "name": "send_payment_link", "arguments": {"amount": "4850", "phone_number": "9876543210"}}
                return
            elif re.search(r"\b(paid|kar diya|bhar diya|jama|already paid)\b", lower):
                if is_english:
                    yield "Thank you so much! Bank updates can take a short while to reflect. If you've already paid, please feel free to ignore this reminder."
                else:
                    yield "बहुत-बहुत धन्यवाद! बैंक में अपडेट होने में थोड़ा समय लग जाता है। अगर आपने पेमेंट कर दिया है तो कृपया इस कॉल को अनदेखा करें।"
                return
            else:
                if is_english:
                    yield f"Hello! This is {agent_name} calling from EasyFinance with a friendly courtesy update regarding your loan account. How may I help?"
                else:
                    yield f"Namaste! Main EasyFinance se {agent_name} bol rahi hoon aapke loan account ke regarding. Bataiye main aapki kya help kar sakti hoon?"
                return

        # D. Sales: B2B Enterprise Lead Qualification
        if active_mode == "lead":
            if re.search(r"\b(reach out|team|demo|enterprise|price|kavita|priya|interested|cloud|platform|features)\b", lower):
                yield {"type": "tool_call", "name": "capture_lead", "arguments": {"name": "Enterprise Lead", "phone_number": "9876543210", "interest_level": "high"}}
                return
            else:
                if is_english:
                    yield f"Hello! This is {agent_name} from TechSolutions. We help growing teams scale their cloud infrastructure. Roughly how many team members would be using this?"
                else:
                    yield f"Namaste! Main TechSolutions se {agent_name} baat kar rahi hoon. Aapki team mein lagbhag kitne log is cloud platform ko use karenge?"
                return

        # E. CSAT 5-Star Feedback Survey
        if active_mode == "feedback":
            if any(w in lower for w in ["rating", "star", "feedback", "5", "4", "3", "good", "great", "excellent", "bad"]):
                if is_english:
                    yield "Thank you so much for your feedback! It really helps us make our service even better for you. Have a fantastic day!"
                else:
                    yield "Aapke feedback ke liye thank you so much! Isse hamari service aur improve karne mein help milegi. Have a wonderful day!"
                return
            else:
                if is_english:
                    yield f"Hello! This is {agent_name} from Customer Insights. On a scale of 1 to 5, how would you rate your recent experience with us?"
                else:
                    yield f"Namaste! Main {agent_name} bol rahi hoon Customer Care se. 1 se 5 star scale par aap hamari service ko kitna rate karenge?"
                return

        # F. Customer Support & CareDesk
        if active_mode == "support":
            if is_english:
                yield f"Hello! Welcome to CareDesk Customer Support. My name is {agent_name}. What issue can I help resolve for you today?"
            else:
                yield f"Hello! CareDesk Support mein aapka welcome hai. Main {agent_name} hoon, bataiye main aapki kya help kar sakti hoon?"
            return

        # G. Doctor & Clinic Appointment Booking (Aarogya Dental Care)
        if active_mode == "clinic":
            if "root canal" in lower or "रूट कैनाल" in lower:
                if is_english:
                    yield "Our painless root canal treatment starts at ₹3,500 and takes around 45 minutes with Dr. Sharma. Would you like me to book a consultation for you?"
                else:
                    yield "Painless root canal treatment ₹3,500 se start hota hai aur lagbhag 45 minutes lagte hain. Kya main Dr. Sharma ke sath aapka slot book kar doon?"
                return
            if "cleaning" in lower or "सफाई" in lower:
                if is_english:
                    yield "Professional teeth cleaning is ₹1,200. Which day would you like to visit our clinic?"
                else:
                    yield "Teeth cleaning ka charge ₹1,200 hai. Aap kaunse din clinic aana prefer karenge?"
                return
            if "दर्द" in lower or "pain" in lower or "dard" in lower:
                if is_english:
                    yield "Oh, I'm sorry to hear you're in pain! Dr. Sharma attends emergency dental cases right away at our clinic. Shall I reserve an emergency slot for you immediately?"
                else:
                    yield "दांत के दर्द के लिए डॉक्टर शर्मा क्लिनिक में इमरजेंसी पेशेंट्स को तुरंत देखते हैं। क्या मैं तुरंत आपके लिए स्लॉट बुक कर दूँ?"
                return
            if any(w in lower for w in ["name is", "नाव", "नाम"]) and any(c.isdigit() for c in last_msg):
                yield {
                    "type": "tool_call",
                    "name": "book_appointment",
                    "arguments": {
                        "caller_name": "Valued Patient",
                        "phone_number": "9876543210",
                        "date": "tomorrow",
                        "time_slot": "10:00 AM",
                        "service": "Dental Consultation",
                    },
                }
                return
            if any(w in lower for w in ["book", "अपॉइंटमेंट", "appointment", "schedule", "slot"]):
                yield {"type": "tool_call", "name": "check_availability", "arguments": {"date": "tomorrow", "time_slot": "10:00 AM"}}
                return
            if any(w in lower for w in ["fee", "cost", "charge", "फीस", "खर्चा"]):
                if is_english:
                    yield "Dr. Sharma's consultation fee is just ₹500, and our clinic is open daily from 9:00 AM to 8:00 PM near Shivaji Nagar Metro. Would you like to drop by tomorrow?"
                else:
                    yield "डॉक्टर शर्मा की कंसल्टेशन फीस पांच सौ रुपये है और क्लिनिक सुबह 9 बजे से रात 8 बजे तक खुला है। क्या मैं कल का स्लॉट चेक करूँ?"
                return
            else:
                if is_english:
                    yield f"Hello! Welcome to Aarogya Dental Care. I am {agent_name}. How can I assist you with your dental health today?"
                else:
                    yield f"Namaste! Aarogya Dental Care mein aapka swagat hai. Main {agent_name} bol rahi hoon, bataiye main aapki kya help kar sakti hoon?"
                return

        # General Friendly Fallback
        if is_english:
            yield f"Hello! I am {agent_name}, and I'm listening closely. Please let me know how I can help you today!"
        else:
            yield f"Haanji, main {agent_name} sun rahi hoon! Please bataiye main aapki kya help kar sakti hoon?"
