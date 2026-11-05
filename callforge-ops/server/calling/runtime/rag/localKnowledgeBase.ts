import { RAGDocument } from "../types";

export const DEFAULT_KNOWLEDGE_DOCS: RAGDocument[] = [
  {
    id: "kb_loan_policy_01",
    title: "Personal Loan Repayment & Pre-closure Policy",
    category: "banking_policy",
    tags: ["loan", "balance", "preclosure", "charges"],
    content:
      "Customers can check their outstanding loan balance and pre-closure amount anytime. Zero foreclosure charges apply after 12 successful EMIs. Current standard personal loan interest rate is 10.5% fixed p.a.",
  },
  {
    id: "kb_emi_grace_02",
    title: "EMI Due Date and Auto-Debit Guidelines",
    category: "emi_schedule",
    tags: ["emi", "due_date", "nach", "mandate"],
    content:
      "EMIs are debited automatically on the 5th of every month via NACH mandate. A 3-day statutory grace period is offered without bounce charges.",
  },
  {
    id: "kb_trai_compliance_03",
    title: "TRAI Statutory Calling Window and AI Disclosure",
    category: "trai_compliance",
    tags: ["trai", "dnc", "disclosure", "compliance", "hours"],
    content:
      "All automated calls must state: 'This is an automated voice assistant from CallForge on a recorded line'. Statutory calling hours are strictly 09:00 to 21:00 IST. Numbers registered on NDNC must be suppressed immediately upon request.",
  },
  {
    id: "kb_kyc_security_04",
    title: "KYC Verification & Re-KYC Rules",
    category: "kyc_rules",
    tags: ["kyc", "aadhaar", "pan", "verification"],
    content:
      "Periodic re-KYC can be completed online via Video KYC or OTP authentication. Agents must never ask for customer ATM PIN, CVV, or net-banking passwords.",
  },
  {
    id: "kb_aarogya_clinic_05",
    title: "Aarogya Dental Care - Clinic Details & Doctor Information",
    category: "dental_clinic",
    tags: ["aarogya", "dental", "clinic", "address", "timings", "pune", "doctor", "sharma"],
    content:
      "Aarogya Dental Care & Implant Center is located at Office 204, Fortune Plaza, FC Road, Shivaji Nagar, Pune 411005 near Goodluck Cafe (opposite Metro Pillar 42). Senior Dentist Dr. Sharma has 15+ years experience (BDS MDS). Timings: Monday to Saturday 9:00 AM to 8:30 PM; Sunday 10:00 AM to 2:00 PM (emergency only). Phone: +91 98765 43210.",
  },
  {
    id: "kb_aarogya_services_06",
    title: "Aarogya Dental Care - Treatment Services & Pricing",
    category: "dental_services",
    tags: ["cleaning", "rct", "root canal", "implants", "whitening", "consultation", "price", "fees"],
    content:
      "Consultation Fee: ₹400. Teeth Cleaning & Polishing: ₹1,200. Root Canal Treatment (RCT): starts at ₹3,500 (approx 45 minutes). Dental Implants: ₹25,000 onwards. Teeth Whitening: ₹5,000. Invisible Aligners: Consultation required for exact plan. Payment accepted: UPI (GPay, PhonePe, Paytm), Cards, Cash.",
  },
  {
    id: "kb_swifttel_annual_07",
    title: "SwiftTel 5G Annual Plan ₹1,999 Details & Benefits",
    category: "telecom_plans",
    tags: ["swifttel", "5g", "annual", "plan", "price", "1999", "data", "ott", "calls"],
    content:
      "SwiftTel 5G Annual Plan costs ₹1,999 for 365 days validity. Benefits: 2.5 GB daily high-speed 5G data (unlimited post-quota at 64 Kbps), truly unlimited voice calls to any network in India, 100 SMS per day, and free annual subscriptions to Disney+ Hotstar Mobile and SonyLIV Premium. Details can be delivered via WhatsApp or SMS.",
  },
  {
    id: "kb_swifttel_features_08",
    title: "SwiftTel 5G Network Features & Activation",
    category: "telecom_features",
    tags: ["swifttel", "activation", "whatsapp", "sms", "sim", "esim", "coverage"],
    content:
      "Customers can activate SwiftTel 5G on physical SIM or instant eSIM. If the customer requests plan details via WhatsApp or SMS, use the send_plan_details tool. If the customer agrees to proceed, use confirm_plan_activation. True 5G SA standalone network is active across 500+ Indian cities.",
  },
    {
    id: "kb_marathi_dental_09",
    title: "Aarogya Dental Clinic Marathi Language Guide (मराठी)",
    category: "dental_marathi",
    tags: ["marathi", "aarogya", "dental", "pune", "dant", "sharma", "क्लिनिक", "पत्ता", "फी", "अपॉइंटमेंट", "वेळ", "डॉक्टर"],
    content:
      "मराठी संभाषण मार्गदर्शक: आरोग्य डेंटल केअर एफसी रोड, शिवाजी नगर, पुणे येथे गुडलक कॅफेजवळ (मेट्रो पिलर ४२ समोर) आहे. मुख्य दंतवैद्य डॉ. शर्मा आहेत ज्यांना १५+ वर्षांचा अनुभव आहे. तपासणी फी ₹४०० आहे. दात स्वच्छ करण्याचे शुल्क ₹१,२०० आणि वेदनारहित रूट कॅनॉल ₹३,५०० पासून सुरू होते. क्लिनिक सोमवार ते शनिवार सकाळी ९ ते रात्री ८:३० चालू असते. इमारतीसमोर मोफत पार्किंग उपलब्ध आहे. UPI, कार्ड आणि रोख पेमेंट स्वीकारले जाते.",
  },
  {
    id: "kb_marathi_dental_services",
    title: "Aarogya Dental Clinic Marathi Services and Procedures",
    category: "dental_marathi",
    tags: ["रूट कॅनॉल", "क्लीनिंग", "इम्प्लांट", "दातदुखी", "वेदना", "फी", "खर्च", "शुल्क", "उपचार", "स्वच्छ"],
    content:
      "आरोग्य डेंटल केअर उपचार व दर: १. कन्सल्टेशन व तपासणी फी: ₹४००. २. दात स्वच्छता व पॉलिशिंग: ₹१,२०० (वेळ ३० मिनिटे). ३. रूट कॅनॉल ट्रीटमेंट (RCT): ₹३,५०० पासून (पूर्णपणे वेदनारहित). ४. डेंटल इम्प्लांट्स: ₹२५,००० पासून. ५. पारदर्शक अलाइनर्स व ब्रेसेस: तपासणीनंतर योग्य प्लॅन. ६. दातदुखीसाठी तातडीने आपत्कालीन सेवा उपलब्ध.",
  },
  {
    id: "kb_marathi_dental_timings_location",
    title: "Aarogya Dental Clinic Marathi Timings and Location",
    category: "dental_marathi",
    tags: ["पत्ता", "स्थान", "वेळ", "रविवार", "पार्किंग", "कुठे", "कधी", "गाडी", "पत्ता काय आहे"],
    content:
      "क्लिनिक पत्ता व वेळ: ऑफिस २०४, फॉर्च्युन प्लाझा, एफसी रोड, शिवाजी नगर, पुणे ४११००५ (गुडलक कॅफे जवळ, मेट्रो पिलर ४२). वेळ: सोमवार ते शनिवार सकाळी ९:०० ते रात्री ८:३०. रविवार सकाळी १०:०० ते दुपारी २:०० (केवळ इमर्जन्सी). दुचाकी व चारचाकी वाहनांसाठी मोफत पार्किंग आणि लिफ्ट सुविधा उपलब्ध आहे.",
  },
  {
    id: "kb_marathi_swifttel_10",
    title: "SwiftTel 5G Marathi Language Guide (मराठी)",
    category: "telecom_marathi",
    tags: ["marathi", "swifttel", "5g", "plan", "recharge"],
    content:
      "मराठी संभाषण मार्गदर्शक: स्विफ्टटेल ५G वार्षिक प्लॅन ₹१,९९९ मध्ये २.५ GB दररोज डेटा आणि मोफत कॉलिंग मिळते.",
  },
];

export class LocalKnowledgeBase {
  private docs: RAGDocument[];

  constructor(initialDocs?: RAGDocument[]) {
    this.docs = initialDocs || [...DEFAULT_KNOWLEDGE_DOCS];
  }

  addDocument(doc: RAGDocument) {
    this.docs.push(doc);
  }

  getAllDocuments(): RAGDocument[] {
    return [...this.docs];
  }

  /**
   * Fast local lexical / TF-IDF scoring over documents
   */
  search(query: string, limit: number = 2, personaId?: string): Array<{ doc: RAGDocument; score: number }> {
    if (!query || query.trim().length === 0) return [];

    const terms = query
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((t: string) => t.length > 2);

    if (terms.length === 0) return [];

    let pool = this.docs;
    if (personaId === "agent_aarogya_dental") {
      pool = pool.filter((d) => d.category.includes("dental"));
    } else if (personaId === "agent_swifttel_5g") {
      pool = pool.filter((d) => d.category.includes("telecom") || d.category === "trai_compliance");
    } else if (personaId === "agent_tata_banking_01") {
      pool = pool.filter((d) => d.category.includes("banking") || d.category.includes("emi") || d.category.includes("kyc"));
    }

    const scored = pool.map((doc) => {
      let matchScore = 0;
      const lowerContent = (doc.title + " " + doc.content + " " + doc.tags.join(" ")).toLowerCase();

      for (const term of terms) {
        if (lowerContent.includes(term)) {
          matchScore += 1;
          // Higher weight for tag or title matches
          if (doc.tags.some((t: string) => t.includes(term))) matchScore += 2;
          if (doc.title.toLowerCase().includes(term)) matchScore += 2;
        }
      }

      return { doc, score: matchScore };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const localKnowledgeBase = new LocalKnowledgeBase();
