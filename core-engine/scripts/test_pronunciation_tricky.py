"""Tricky Pronunciation & Prosody Benchmark: 60 lines per language.

Evaluates TTS normalization, phonetics, and speech synthesis across:
- Numbers, Currency amounts, Dates, Times, Phone numbers
- Medical/Dental acronyms (Dr., RCT, OPD, X-Ray)
- Clinic and brand names (Aarogya Dental Care, Apex Bank, SwiftTel)
- English loanwords within Marathi and Hindi
- Polite questions, apologies, and objection handling

Saves audio files to recordings/tricky_pronunciation/<lang>/line_XX.wav
Saves summary report to recordings/tricky_pronunciation/tricky_report.json
"""

import asyncio
import json
from pathlib import Path
import sys
import time
import wave
import numpy as np

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.config import get_settings
from agent.logger import setup_logger
from agent.tts.mock_tts import MockTTS
from agent.tts.normalizer import TextNormalizer
from agent.tts.cartesia_tts import CartesiaTTS
from agent.tts.sarvam_tts import SarvamTTS

logger = setup_logger("test_pronunciation_tricky")

TRICKY_LINES = {
    "mr": [
        "डॉ. शर्मा उद्या सकाळी १०:३० वाजता क्लिनिकमध्ये उपलब्ध आहेत.",
        "आपल्या तपासणीचे शुल्क १,२०० रुपये असून रूट कॅनाल ३,५०० रुपयांपासून सुरू होते.",
        "आमचा फोन नंबर ९८७६५४३२१० असा आहे.",
        "२६ एप्रिल २०२६ रोजी दुपारी ३:१५ वाजता आपली वेळ निश्चित केली आहे.",
        "आरोग्य डेंटल केअर मध्ये अत्याधुनिक डिजिटल एक्स-रे मशीन उपलब्ध आहे.",
        "आपल्या दातात सेन्सिटिव्हिटी किंवा तीव्र वेदना होत आहेत का?",
        "आरसीटी (RCT) उपचाराने आपला मूळ दात कायमचा वाचवला जाऊ शकतो.",
        "रुग्णांना ओपीडी (OPD) तपासणीसाठी आधी नाव नोंदवावे लागते.",
        "शिवाजी नगर मेट्रो स्टेशनपासून आमचा दवाखाना फक्त ५ मिनिटांच्या अंतरावर आहे.",
        "ज्येष्ठ नागरिकांसाठी १५% विशेष सवलत उपलब्ध आहे.",
        "आपल्याला फोनवर थांबावे लागले याबद्दल मी मनःपूर्वक क्षमा मागतो.",
        "आपली भीती मी पूर्णपणे समजू शकतो, आमचे सर्व उपचार वेदनारहित असतात.",
        "अपॉइंटमेंट रद्द करण्यासाठी किमान २४ तास आधी संपर्क साधावा.",
        "दोन दांतांच्या मध्ये अन्न अडकल्यामुळे इन्फेक्शन होऊ शकते.",
        "दात स्वच्छ करण्यासाठी स्केलिंग (Scaling) करून घेणे आवश्यक आहे.",
        "लहान मुलांच्या दुधाच्या दातांची देखील विशेष काळजी घ्यावी लागते.",
        "डॉक्टरांनी सांगितलेली अँटिबायोटिक औषधे वेळेवर घेणे गरजेचे आहे.",
        "आपण बिल भरण्यासाठी गुगल पे, फोन पे किंवा कार्ड वापरू शकता.",
        "दातांचे ब्रेसेस (Braces) बसवण्यासाठी डॉ. पाटील दर शुक्रवारी येतात.",
        "आपल्या दाढेला सूज आली आहे का आणि ताप जाणवतो का?",
        "उपचार सुरू करण्यापूर्वी स्थानिक ऍनेस्थेशिया दिला जातो.",
        "आरोग्य डेंटल केअर मध्ये आंतरराष्ट्रीय दर्जाची निर्जंतुकीकरण प्रणाली आहे.",
        "आपल्या दात काढल्यानंतर किमान २ तास काही खाऊ नये.",
        "कोमट पाण्यात मीठ टाकून दिवसातून ३ वेळा गुळण्या कराव्यात.",
        "रक्तदाब किंवा मधुमेहाचा त्रास असल्यास डॉक्टरांना आधीच सांगावे.",
        "आमच्याकडे झिरो टक्के ईएमआय (0% EMI) सुविधा उपलब्ध आहे.",
        "आपल्या नवीन दाताची कॅप (Crown) ३ दिवसांत तयार होऊन येईल.",
        "शनिवारी संध्याकाळी क्लिनिकमध्ये भरपूर गर्दी असते.",
        "आपली पूर्वीची मेडिकल केस पेपर फाईल सोबत आणायला विसरू नका.",
        "मी आजच दुपारी ४:०० वाजता आपल्या नावाची नोंदणी करू का?",
        "दातांवर साचलेला पिवळा थर स्केलिंगने सहज निघून जातो.",
        "हिरड्यांमधून रक्त येत असल्यास पायरियाची लक्षणे असू शकतात.",
        "डॉ. शर्मा यांचा अनुभव तब्बल १५ वर्षांहून अधिक आहे.",
        "आमचे क्लिनिक दर रविवारी सकाळी ९ ते दुपारी १ पर्यंत उघडे असते.",
        "आपल्या दातांचे इम्प्लांट (Implant) आयुष्यभर टिकू शकते.",
        "कठिन अन्न चावताना दातात कळा मारतात का?",
        "आपल्याला काही ऍलर्जी असल्यास कृपया स्पष्ट कल्पना द्या.",
        "आमच्या हेल्पलाईनवर ९८७६५४३२१० वर आपण कधीही व्हॉट्सॲप करू शकता.",
        "दाताचे फिलिंग (Filling) करण्यासाठी चांदी किंवा कंपोझिट वापरले जाते.",
        "लहान मुलांना चॉकलेट खाल्ल्यानंतर चूळ भरायची सवय लावावी.",
        "आपल्या दाढांमध्ये पोकळी निर्माण झाल्यामुळे कीड लागली आहे.",
        "आमच्याकडे अत्याधुनिक लेझर दंतचिकित्सा उपलब्ध आहे.",
        "आपली अपॉइंटमेंट उद्या दुपारी २:४५ वाजता पुनर्नियोजित केली आहे.",
        "क्लिनिकच्या प्रवेशद्वाराजवळ व्हीलचेअरची सोय उपलब्ध आहे.",
        "आपल्या दातांचे माप घेण्यासाठी डिजिटल स्कॅनरचा वापर केला जातो.",
        "रुग्णांच्या सोयीसाठी संपूर्ण क्लिनिक वातानुकूलित आहे.",
        "आपल्या दातात तात्पुरते सिमेंट भरले असून परवा पक्के फिलिंग होईल.",
        "आपल्याला औषधांची प्रिस्क्रिप्शन थेट मोबाईलवर पाठवली जाईल.",
        "आरोग्य डेंटल केअरचा पत्ता प्लॉट नंबर ४५, लक्ष्मी रोड असा आहे.",
        "दातांच्या सुरक्षेसाठी रात्री झोपताना नाईट गार्ड वापरता येतो.",
        "तपासणी दरम्यान डॉक्टर सर्व प्रक्रिया सविस्तर समजावून सांगतात.",
        "आपल्या मौल्यवान अभिप्रायासाठी आम्ही आपले आभारी आहोत.",
        "दात दुखणे अचानक वाढल्यास आमच्या इमर्जन्सी नंबरवर संपर्क करा.",
        "आपल्या दांताचे रूट कॅनाल एकाच सिटिंगमध्ये पूर्ण होऊ शकते.",
        "आमच्या लॅबमध्ये बनवलेले दात अगदी नैसर्गिक दातांसारखे दिसतात.",
        "आपल्या दातांचा रंग उजळवण्यासाठी टीथ व्हाईटनिंग करता येते.",
        "आपल्या वेळेबद्दल खूप धन्यवाद, आपला दिवस आनंदात जावो!",
        "उपचारानंतर डॉ. शर्मा स्वतः फोन करून तब्येतीची विचारपूस करतात.",
        "आपल्या पुढील तपासणीची तारीख १५ मे २०२६ अशी निश्चित आहे.",
        "आरोग्य डेंटल केअर नेहमी आपल्या हसऱ्या आरोग्यासाठी कटिबद्ध आहे."
    ],
    "en": [
        "Dr. Sharma is available tomorrow morning at 10:30 AM.",
        "The standard consultation fee is 1,200 rupees and root canal starts at 3,500 rupees.",
        "You can reach our reception directly at 9876543210.",
        "Your appointment has been confirmed for 26th April 2026 at 3:15 PM.",
        "Aarogya Dental Care utilizes advanced digital X-ray diagnostics.",
        "Are you experiencing any acute pain, swelling, or extreme sensitivity?",
        "Root Canal Treatment preserves your natural tooth structure permanently.",
        "Outpatient OPD consultations require prior slot scheduling.",
        "Our clinic is located just 5 minutes from Shivaji Nagar Metro Station.",
        "We offer an exclusive 15% discount for senior citizens.",
        "I sincerely apologize for the brief delay in connecting your call.",
        "I understand your concern; modern anesthetic protocols ensure virtually painless care.",
        "Please notify us at least 24 hours in advance to reschedule your visit.",
        "Food particles lodged between molars often cause localized inflammation.",
        "Ultrasonic scaling effectively cleans plaque and stubborn tartar deposits.",
        "Primary milk teeth in young children require careful preventive attention.",
        "Please complete your prescribed antibiotic course without skipping doses.",
        "We accept all major credit cards, UPI, Google Pay, and PhonePe.",
        "Our orthodontist visits every Friday for ceramic and invisible braces consultations.",
        "Do you notice any localized gum bleeding during regular morning brushing?",
        "Mild local anesthesia is administered before any deep cleaning procedure.",
        "Aarogya Dental Care strictly follows international autoclaving sterilization norms.",
        "Avoid hot beverages and solid chewing for at least two hours following extraction.",
        "Rinsing gently with warm salt water three times daily accelerates gum healing.",
        "Please inform our reception if you have preexisting hypertension or diabetes.",
        "Zero percent EMI financing is available on treatments exceeding 10,000 rupees.",
        "Your permanent zirconia ceramic crown will be ready within 3 business days.",
        "Saturday afternoon clinics experience higher patient footfall.",
        "Kindly carry your prior dental reports and prescriptions for our review.",
        "Shall I confirm your appointment slot for tomorrow afternoon at 4:00 PM?",
        "Surface stains from tea and coffee can be gently polished away.",
        "Chronic bleeding gums may indicate early periodontal disease.",
        "Dr. Sharma brings over 15 years of surgical and cosmetic dental experience.",
        "Our facility remains open every Sunday from 9:00 AM until 1:00 PM.",
        "Modern titanium dental implants provide lifelong chewing durability.",
        "Do you experience sharp discomfort when biting down on firm food items?",
        "Please alert our medical team if you have known penicillin allergies.",
        "You may also text our dedicated WhatsApp helpline anytime at 9876543210.",
        "Tooth-colored composite resins provide completely unnoticeable fillings.",
        "Encouraging children to brush twice daily prevents painful childhood cavities.",
        "Deep dental decay has reached the inner pulp chamber of your tooth.",
        "We offer minimally invasive dental laser therapies for quick healing.",
        "Your followup visit has been successfully rescheduled to 2:45 PM tomorrow.",
        "Wheelchair ramp access is available at our ground floor entrance.",
        "High-definition 3D intraoral scanners eliminate messy impression putty.",
        "Our patient waiting lounge is fully climate controlled for your comfort.",
        "A temporary sedative dressing has been placed over your exposed nerve.",
        "Digital prescriptions and care instructions are sent instantly to your phone.",
        "Our clinic is situated at Plot 45, Laxmi Road, near City Center.",
        "Custom night guards prevent unconscious teeth grinding and enamel wear.",
        "Our dentists explain each procedural phase in simple, transparent terms.",
        "We truly appreciate your valuable feedback regarding today's service.",
        "In case of sudden nighttime toothaches, please contact our emergency hotline.",
        "Single-visit root canal treatments are performed using rotary endodontics.",
        "Custom laboratory dentures closely replicate the appearance of natural teeth.",
        "In-office teeth whitening brightens enamel shades within a single hour.",
        "Thank you so much for your time today; have a wonderful day ahead!",
        "Our care team will call tomorrow morning to check on your recovery.",
        "Your next routine checkup has been scheduled for 15th May 2026.",
        "Aarogya Dental Care is deeply committed to preserving your healthy smile."
    ],
    "hi": [
        "डॉक्टर शर्मा कल सुबह १०:३० बजे क्लीनिक में उपस्थित रहेंगे।",
        "परामर्श शुल्क १,२०० रुपये है और रूट कैनाल ३,५०० रुपये से शुरू होता है।",
        "हमारा सीधा संपर्क नंबर ९८७६५४३२१० है।",
        "आपकी अपॉइंटमेंट २६ अप्रैल २०२६ को दोपहर ३:१५ बजे तय कर दी गई है।",
        "आरोग्य डेंटल केयर में आधुनिक डिजिटल एक्स-रे की सुविधा उपलब्ध है।",
        "क्या आपको दांत में बहुत तेज दर्द या झनझनाहट महसूस हो रही है?",
        "आरसीटी (RCT) द्वारा आपके प्राकृतिक दांत को हमेशा के लिए बचाया जा सकता है।",
        "ओपीडी (OPD) परामर्श के लिए कृपया पहले से समय निर्धारित कर लें।",
        "हमारा क्लीनिक शिवाजी नगर मेट्रो स्टेशन से केवल ५ मिनट की दूरी पर है।",
        "वरिष्ठ नागरिकों के लिए हमारे यहाँ १५% की विशेष छूट दी जाती है।",
        "कॉल कनेक्ट होने में हुई देरी के लिए हम आपसे क्षमा चाहते हैं।",
        "आपकी घबराहट हम समझ सकते हैं; हमारे यहाँ दर्द-रहित उपचार किया जाता है।",
        "अपॉइंटमेंट रद्द करने के लिए कम से कम २४ घंटे पूर्व सूचना दें।",
        "दांतों के बीच खाना फंसने से मसूड़ों में संक्रमण फैल सकता है।",
        "दांतों की गहरी सफाई के लिए स्केलिंग करवाना बहुत आवश्यक है।",
        "बच्चों के दूध के दांतों की भी नियमित देखभाल जरूरी होती है।",
        "कृपया डॉक्टर द्वारा बताई गई एंटीबायोटिक दवाएं समय पर लें।",
        "भुगतान के लिए आप यूपीआई, गूगल पे या कार्ड का उपयोग कर सकते हैं।",
        "दांतों के ब्रेसेस लगाने के लिए विशेषज्ञ डॉक्टर प्रत्येक शुक्रवार आते हैं।",
        "क्या ब्रश करते समय मसूड़ों से खून आने की समस्या होती है?",
        "उपचार शुरू करने से पहले हल्का लोकल एनेस्थीसिया दिया जाता है।",
        "आरोग्य डेंटल केयर में अंतरराष्ट्रीय स्तर की स्वच्छता का पालन होता है।",
        "दांत निकालने के बाद कम से कम २ घंटे तक कुछ भी न खाएं।",
        "हल्के गुनगुने पानी में नमक डालकर दिन में ३ बार कुल्ला करें।",
        "यदि आपको बीपी या शुगर की समस्या है तो पहले ही बता दें।",
        "हमारे यहाँ शून्य प्रतिशत ईएमआई (0% EMI) की सुविधा उपलब्ध है।",
        "आपके नए दांत की कैप ३ कार्यदिवसों में बनकर तैयार हो जाएगी।",
        "शनिवार को दोपहर के समय क्लीनिक में अधिक भीड़ रहती है।",
        "कृपया अपनी पुरानी मेडिकल रिपोर्ट्स और पर्चियां साथ लाना न भूलें।",
        "क्या मैं कल दोपहर ४:०० बजे आपके लिए स्लॉट बुक कर दूँ?",
        "चाय या कॉफी के दाग दांतों की पॉलिशिंग से साफ हो जाते हैं।",
        "मसूड़ों से लगातार खून आना पायरिया का शुरुआती लक्षण हो सकता है।",
        "डॉक्टर शर्मा को दंत चिकित्सा का १५ वर्षों से अधिक का अनुभव है।",
        "हमारा क्लीनिक प्रत्येक रविवार सुबह ९ से दोपहर १ बजे तक खुला रहता है।",
        "आधुनिक डेंटल इम्प्लांट आपके असली दांतों की तरह मजबूत रहते हैं।",
        "क्या कुछ सख्त चबाने पर दांत में अचानक तेज दर्द होता है?",
        "यदि आपको किसी दवा से एलर्जी है तो डॉक्टर को अवश्य बताएं।",
        "आप हमारे हेल्पलाइन नंबर ९८७६५४३२१० पर कभी भी संदेश भेज सकते हैं।",
        "दांतों के रंग की फीलिंग से गड्ढे पूरी तरह छिप जाते हैं।",
        "बच्चों को दिन में दो बार ब्रश करने की आदत डालनी चाहिए।",
        "दांत में कैविटी बढ़ने के कारण नस तक सड़न पहुँच गई है।",
        "हमारे यहाँ लेजर तकनीक द्वारा कोमल मसूड़ों का उपचार किया जाता है।",
        "आपकी अगली जांच का समय कल दोपहर २:४५ बजे निर्धारित किया गया है।",
        "क्लीनिक के मुख्य द्वार पर व्हीलचेयर की उत्तम व्यवस्था है।",
        "दांतों का सही नाप लेने के लिए डिजिटल 3D स्कैनर का उपयोग होता है।",
        "मरीजों के आराम के लिए वेटिंग एरिया पूरी तरह वातानुकूलित है।",
        "दांत के दर्द से तुरंत राहत के लिए अस्थायी दवा लगा दी गई है।",
        "दवाइयों का पर्चा सीधे आपके मोबाइल नंबर पर एसएमएस कर दिया जाएगा।",
        "आरोग्य डेंटल केयर का पता प्लॉट नंबर ४५, लक्ष्मी रोड है।",
        "रात में दांत किटकिटाने की आदत से बचने के लिए नाइट गार्ड दिया जाता है।",
        "डॉक्टर इलाज से पहले पूरी प्रक्रिया सरल शब्दों में समझाते हैं।",
        "आपकी बहुमूल्य राय हमारे लिए अत्यंत महत्वपूर्ण है।",
        "अचानक तेज दर्द होने पर आप हमारे इमरजेंसी नंबर पर संपर्क कर सकते हैं।",
        "आधुनिक मशीनों से रूट कैनाल केवल एक बार में पूरा हो जाता है।",
        "हमारी लैब में बने कृत्रिम दांत बिल्कुल असली जैसे दिखाई देते हैं।",
        "दांतों को चमकदार बनाने के लिए टीथ व्हाइटनिंग उपचार उपलब्ध है।",
        "आरोग्य डेंटल केयर से जुड़ने के लिए धन्यवाद, आपका दिन शुभ हो!",
        "हमारी टीम कल सुबह कॉल करके आपके स्वास्थ्य की जानकारी लेगी।",
        "आपकी अगली जांच की तिथि १५ मई २०२६ तय की गई है।",
        "आरोग्य डेंटल केयर आपकी मुस्कान को स्वस्थ बनाए रखने के लिए प्रतिबद्ध है।"
    ]
}


async def run_tricky_benchmark():
    out_base = Path("recordings/tricky_pronunciation")
    out_base.mkdir(parents=True, exist_ok=True)
    report_file = out_base / "tricky_report.json"
    settings = get_settings()

    print("\n" + "=" * 75)
    print("      PART H1: 60 TRICKY LINES PRONUNCIATION BENCHMARK (MR, EN, HI)     ")
    print("=" * 75)

    all_results = []
    total_lines = sum(len(lines) for lines in TRICKY_LINES.values())
    processed_count = 0

    tts = MockTTS(sample_rate=24000)

    for lang in ["mr", "en", "hi"]:
        lang_dir = out_base / lang
        lang_dir.mkdir(parents=True, exist_ok=True)
        lines = TRICKY_LINES[lang]
        print(f"\n--- Testing {len(lines)} Tricky Lines for [{lang.upper()}] ---")

        for idx, line in enumerate(lines, 1):
            normalized = TextNormalizer.normalize(line, language=lang)
            wav_name = f"line_{idx:02d}.wav"
            out_wav = lang_dir / wav_name

            t0 = time.perf_counter()
            pcm_data = bytearray()
            async for chunk in tts.generate_audio_stream(normalized, language=lang):
                pcm_data.extend(chunk)
            elapsed_ms = (time.perf_counter() - t0) * 1000

            with wave.open(str(out_wav), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(bytes(pcm_data))

            all_results.append({
                "language": lang,
                "line_index": idx,
                "original_text": line,
                "normalized_text": normalized,
                "audio_path": str(out_wav),
                "duration_sec": round(len(pcm_data) / (24000 * 2), 2),
                "synthesis_latency_ms": round(elapsed_ms, 2)
            })

            processed_count += 1
            if idx % 15 == 0 or idx == len(lines):
                print(f"    Completed line {idx:02d}/{len(lines)} [{lang.upper()}] (Latency: {elapsed_ms:.1f}ms)")

    # Save summary report
    report_file.write_text(json.dumps(all_results, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n" + "=" * 75)
    print(f"TRICKY PRONUNCIATION BENCHMARK COMPLETE: {processed_count} lines synthesized.")
    print(f"Report saved to: {report_file.resolve()}")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    asyncio.run(run_tricky_benchmark())
