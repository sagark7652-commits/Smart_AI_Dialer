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
    id: "kb_marathi_clinic_support_09",
    title: "Aarogya Dental & SwiftTel Marathi Language Support (मराठी)",
    category: "marathi_support",
    tags: ["marathi", "aarogya", "swifttel", "pune", "dant", "5g"],
    content:
      "मराठी संभाषण मार्गदर्शक: आरोग्य डेंटल केअर एफसी रोड, पुणे येथे आहे. दात स्वच्छ करणे ₹१,२०० आणि रूट कॅनॉल ₹३,५०० पासून सुरू होते. स्विफ्टटेल ५G वार्षिक प्लॅन ₹१,९९९ मध्ये २.५ GB दररोज डेटा आणि मोफत कॉलिंग मिळते. जर ग्राहकाने २ दिवसांनी फोन करण्यास सांगितले तर कॉलबॅक शेड्यूल करा.",
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
  search(query: string, limit: number = 2): Array<{ doc: RAGDocument; score: number }> {
    if (!query || query.trim().length === 0) return [];

    const terms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((t: string) => t.length > 2);

    if (terms.length === 0) return [];

    const scored = this.docs.map((doc) => {
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
