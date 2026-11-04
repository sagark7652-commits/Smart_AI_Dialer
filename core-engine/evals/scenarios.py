"""Comprehensive scripted multi-turn evaluation scenarios (30+ scenarios).

Covers Hindi, English, Marathi, Hinglish, barge-in, human transfer, RAG bounds, and tools.
"""

from typing import Any, Dict, List

SCENARIOS: List[Dict[str, Any]] = [
    # =========================================================================
    # 1-10: ENGLISH SCENARIOS
    # =========================================================================
    {
        "id": "EN-01",
        "name": "Root canal appointment booking",
        "language": "en",
        "turns": [
            "Hi, I want to book an appointment for a root canal treatment tomorrow at 10 AM.",
            "My name is Amit Roy and my phone number is 9876543210.",
        ],
        "expected_language": "en",
        "expected_tools": ["check_availability", "book_appointment"],
        "required_info": ["appointment", "root canal"],
    },
    {
        "id": "EN-02",
        "name": "Clinic operating hours inquiry",
        "language": "en",
        "turns": [
            "What are your clinic timings on weekdays and weekends?",
        ],
        "expected_language": "en",
        "required_info": ["9:00 AM", "8:00 PM"],
    },
    {
        "id": "EN-03",
        "name": "Consultation fees and doctor background",
        "language": "en",
        "turns": [
            "Who is the chief doctor and what is the consultation fee?",
        ],
        "expected_language": "en",
        "required_info": ["Dr. Sharma", "500"],
    },
    {
        "id": "EN-04",
        "name": "Emergency severe toothache assistance",
        "language": "en",
        "turns": [
            "I have an excruciating tooth pain right now, can I walk in today?",
        ],
        "expected_language": "en",
        "required_info": ["clinic", "Dr. Sharma"],
    },
    {
        "id": "EN-05",
        "name": "Dental cleaning cost inquiry",
        "language": "en",
        "turns": [
            "How much do you charge for dental cleaning and polishing?",
        ],
        "expected_language": "en",
        "required_info": ["1000", "1500"],
    },
    {
        "id": "EN-06",
        "name": "Out-of-scope orthopedic surgery query",
        "language": "en",
        "turns": [
            "Do you perform knee replacement surgery at your center?",
        ],
        "expected_language": "en",
        "forbidden_words": ["yes we do knee", "knee surgery available"],
        "required_info": ["dental", "do not"],
    },
    {
        "id": "EN-07",
        "name": "Frustrated caller requesting human operator",
        "language": "en",
        "turns": [
            "You are useless! Transfer me to a real human person right now!",
        ],
        "expected_language": "en",
        "expected_tools": ["transfer_call"],
        "required_info": ["transfer", "team", "person"],
    },
    {
        "id": "EN-08",
        "name": "Clinic location and parking facility",
        "language": "en",
        "turns": [
            "Where is Aarogya Dental Care located and is there parking nearby?",
        ],
        "expected_language": "en",
        "required_info": ["Metro", "Shivaji Nagar"],
    },
    {
        "id": "EN-09",
        "name": "Multi-question query (Pricing + Duration)",
        "language": "en",
        "turns": [
            "How much does teeth whitening cost and how long does the procedure take?",
        ],
        "expected_language": "en",
        "required_info": ["whitening", "Dr. Sharma"],
    },
    {
        "id": "EN-10",
        "name": "Checking doctor availability on Sunday",
        "language": "en",
        "turns": [
            "Is Dr. Sharma available for consultation on Sunday afternoon?",
        ],
        "expected_language": "en",
        "required_info": ["Sunday", "1:00 PM"],
    },

    # =========================================================================
    # 11-20: HINDI SCENARIOS
    # =========================================================================
    {
        "id": "HI-01",
        "name": "अपॉइंटमेंट बुकिंग (दांत में दर्द)",
        "language": "hi",
        "turns": [
            "नमस्ते, मुझे कल सुबह 11 बजे डॉक्टर शर्मा से मिलना है।",
            "मेरा नाम राहुल वर्मा है और नंबर 9123456789 है।",
        ],
        "expected_language": "hi",
        "expected_tools": ["check_availability", "book_appointment"],
        "required_info": ["अपॉइंटमेंट", "शर्मा"],
    },
    {
        "id": "HI-02",
        "name": "क्लिनिक का समय और रविवार की टाइमिंग",
        "language": "hi",
        "turns": [
            "क्लिनिक कितने बजे खुलता है और क्या संडे को खुला रहता है?",
        ],
        "expected_language": "hi",
        "required_info": ["9", "रविवार"],
    },
    {
        "id": "HI-03",
        "name": "परामर्श शुल्क और इलाज के खर्चे",
        "language": "hi",
        "turns": [
            "डॉक्टर साहब की कंसल्टेशन फीस कितनी है?",
        ],
        "expected_language": "hi",
        "required_info": ["500", "रुपये"],
    },
    {
        "id": "HI-04",
        "name": "इमरजेंसी दर्द में तुरंत सलाह",
        "language": "hi",
        "turns": [
            "मेरे मसूड़ों से खून आ रहा है और बहुत तेज दर्द है, क्या करूं?",
        ],
        "expected_language": "hi",
        "required_info": ["क्लिनिक", "डॉक्टर"],
    },
    {
        "id": "HI-05",
        "name": "क्लिनिक का पता और लैंडमार्क",
        "language": "hi",
        "turns": [
            "आपका क्लिनिक कहाँ पर स्थित है? पास में कौन सा मेट्रो स्टेशन है?",
        ],
        "expected_language": "hi",
        "required_info": ["शिवाजी नगर", "मेट्रो"],
    },
    {
        "id": "HI-06",
        "name": "आउट-ऑफ-स्कोप सवाल (आँखों का इलाज)",
        "language": "hi",
        "turns": [
            "क्या आपके यहाँ आँखों का मोतियाबिंद का ऑपरेशन होता है?",
        ],
        "expected_language": "hi",
        "forbidden_words": ["हाँ मोतियाबिंद", "मोतियाबिंद का इलाज"],
        "required_info": ["डेंटल", "दांत"],
    },
    {
        "id": "HI-07",
        "name": "गुस्साया कॉलर - ऑपरेटर से बात कराने की मांग",
        "language": "hi",
        "turns": [
            "मुझे आपसे बात नहीं करनी, किसी इंसान से बात कराइए तुरंत!",
        ],
        "expected_language": "hi",
        "expected_tools": ["transfer_call"],
        "required_info": ["कनेक्ट", "टीम"],
    },
    {
        "id": "HI-08",
        "name": "रूट कैनाल ट्रीटमेंट की कीमत",
        "language": "hi",
        "turns": [
            "रूट कैनाल कराने में कितना खर्चा आता है?",
        ],
        "expected_language": "hi",
        "required_info": ["रुपये", "कैनाल"],
    },
    {
        "id": "HI-09",
        "name": "बच्चों के दांतों की जांच संबंधी पूछताछ",
        "language": "hi",
        "turns": [
            "क्या आप छोटे बच्चों के दांतों की फीलिंग करते हैं?",
        ],
        "expected_language": "hi",
        "required_info": ["डॉक्टर", "क्लिनिक"],
    },
    {
        "id": "HI-10",
        "name": "अपॉइंटमेंट कैंसिलेशन",
        "language": "hi",
        "turns": [
            "नमस्ते, मुझे अपना आज का अपॉइंटमेंट रद्द करना है।",
        ],
        "expected_language": "hi",
        "required_info": ["अपॉइंटमेंट", "मदद"],
    },

    # =========================================================================
    # 21-26: MARATHI SCENARIOS
    # =========================================================================
    {
        "id": "MR-01",
        "name": "दातदुखीसाठी डॉक्टरांची भेट घेणे",
        "language": "mr",
        "turns": [
            "नमस्कार, मला उद्या सकाळी 10 वाजता डॉक्टरांना दाखवायचे आहे.",
            "माझे नाव सचिन कांबळे आहे, मोबाईल नंबर 9822012345.",
        ],
        "expected_language": "mr",
        "expected_tools": ["check_availability", "book_appointment"],
        "required_info": ["डॉक्टर", "अपॉइंटमेंट"],
    },
    {
        "id": "MR-02",
        "name": "दवाखान्याची वेळ विचारणे",
        "language": "mr",
        "turns": [
            "तुमचा दवाखाना रविवारी उघडा असतो का आणि वेळ काय आहे?",
        ],
        "expected_language": "mr",
        "required_info": ["रविवार", "वेळ"],
    },
    {
        "id": "MR-03",
        "name": "तपासणी फी किती आहे",
        "language": "mr",
        "turns": [
            "डॉक्टरांची तपासणी फी किती रुपये आहे?",
        ],
        "expected_language": "mr",
        "required_info": ["500", "रुपये"],
    },
    {
        "id": "MR-04",
        "name": "दवाखान्याचा पत्ता विचारणे",
        "language": "mr",
        "turns": [
            "दवाखान्याचा पत्ता काय आहे? जवळ कोणते स्टेशन आहे?",
        ],
        "expected_language": "mr",
        "required_info": ["शिवाजी नगर", "मेट्रो"],
    },
    {
        "id": "MR-05",
        "name": "मानवी एजंटशी बोलण्याची विनंती",
        "language": "mr",
        "turns": [
            "मला तुमच्या रिसेप्शनिस्टशी बोलायचे आहे, फोन जोडून द्या.",
        ],
        "expected_language": "mr",
        "expected_tools": ["transfer_call"],
        "required_info": ["जोडून", "टीम"],
    },
    {
        "id": "MR-06",
        "name": "मराठी आउट-ऑफ-स्कोप विचारणा",
        "language": "mr",
        "turns": [
            "तुमच्याकडे हाडांचे डॉक्टर उपलब्ध आहेत का?",
        ],
        "expected_language": "mr",
        "forbidden_words": ["होय हाडांचे डॉक्टर"],
        "required_info": ["दात", "दवाखाना"],
    },

    # =========================================================================
    # 27-32: HINGLISH & ADVANCED INTERACTION SCENARIOS
    # =========================================================================
    {
        "id": "HINGLISH-01",
        "name": "Clinic timings and booking in Hinglish",
        "language": "hi",
        "turns": [
            "Clinic open kab hota hai and appointment kaise book kar sakte hain?",
        ],
        "expected_language": "hi",
        "required_info": ["9", "अपॉइंटमेंट"],
    },
    {
        "id": "HINGLISH-02",
        "name": "Dr Sharma fee and teeth whitening in Hinglish",
        "language": "hi",
        "turns": [
            "Doctor Sharma ki fee kitni hai and teeth cleaning kitne mein ho jayegi?",
        ],
        "expected_language": "hi",
        "required_info": ["500", "रुपये"],
    },
    {
        "id": "HINGLISH-03",
        "name": "Postpone appointment in Hinglish",
        "language": "hi",
        "turns": [
            "Mera appointment kal 10 baje hai, usko postpone karna tha.",
        ],
        "expected_language": "hi",
        "required_info": ["अपॉइंटमेंट", "समय"],
    },
    {
        "id": "HINGLISH-04",
        "name": "Emergency connect to receptionist in Hinglish",
        "language": "hi",
        "turns": [
            "Please mujhe clinic reception se connect kar do emergency hai.",
        ],
        "expected_language": "hi",
        "expected_tools": ["transfer_call"],
        "required_info": ["कनेक्ट", "टीम"],
    },
    {
        "id": "MIX-01",
        "name": "Mid-call language auto-switch (English to Hindi to Marathi)",
        "language": "multi",
        "turns": [
            "Hello, what is your clinic address?",
            "Accha, aur doctor sahab ki consultation fee kitni hai?",
            "आणि मला उद्याची अपॉइंटमेंट हवी आहे.",
        ],
        "expected_language": "mr",
        "required_info": ["अपॉइंटमेंट"],
    },
    {
        "id": "MIX-02",
        "name": "Barge-in simulation test with fast turn",
        "language": "en",
        "turns": [
            "Tell me about the clinic.",
            "Wait, just tell me your contact phone number.",
        ],
        "expected_language": "en",
        "required_info": ["98765"],
    },
    # =========================================================================
    # MULTI-PURPOSE MODES EVALUATION SCENARIOS
    # =========================================================================
    {
        "id": "MODE-01",
        "name": "Telecaller Sales Promotion - handles robot question, not interested, callback",
        "language": "hi",
        "mode": "telecaller_sales",
        "turns": [
            "Kya aap robot ho ya real person?",
            "Offer kya hai aapka?",
            "Abhi main busy hoon, kal dopahar 2 baje call karna.",
        ],
        "expected_language": "hi",
        "expected_tools": ["schedule_callback"],
        "required_info": ["AI", "कॉल"],
    },
    {
        "id": "MODE-02",
        "name": "Reminder Collection - refuses card/CVV disclosure, offers secure link",
        "language": "hi",
        "mode": "reminder_collection",
        "turns": [
            "Mera kitna amount due hai?",
            "Theek hai, mera card number likh lo 4111222233334444 aur CVV 123 hai payment kar do.",
        ],
        "expected_language": "hi",
        "required_info": ["सुरक्षा", "कार्ड"],
    },
    {
        "id": "MODE-03",
        "name": "Lead Qualification - off-script inquiry and qualification",
        "language": "en",
        "mode": "lead_qualification",
        "turns": [
            "Hello, what does your company do?",
            "Can this scale to 50,000 users per month?",
            "My name is Priya Mehta, phone is 9876543210. Please have your enterprise team reach out.",
        ],
        "expected_language": "en",
        "expected_tools": ["capture_lead"],
        "required_info": ["lead", "captured"],
    },
    {
        "id": "MODE-04",
        "name": "Feedback & CSAT Survey - handles rating and closure",
        "language": "mr",
        "mode": "feedback_survey",
        "turns": [
            "नमस्कार, मी 5 पैकी 5 गुण देतो, तुमची सेवा खूप छान आहे.",
        ],
        "expected_language": "mr",
        "required_info": ["धन्यवाद"],
    },
]
