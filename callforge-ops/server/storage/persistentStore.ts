import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

export interface StoredLead {
  id: string;
  name: string;
  phone: string;
  company: string;
  source: string;
  stage: string;
  score: number;
  last: string;
  email?: string;
  notes: string[];
  isDnc: boolean;
  createdAt: string;
}

export interface StoredCDR {
  id: string;
  customerName: string;
  customerPhone: string;
  agentName: string;
  campaign: string;
  duration: string;
  durationSeconds: number;
  status: "Completed" | "No Answer" | "Busy" | "Failed";
  sentiment: "Positive" | "Neutral" | "Negative";
  qaScore: number;
  recordingUrl?: string;
  createdAt: string;
}

export interface StoredCarrierConfig {
  provider: "mock" | "twilio" | "exotel" | "bolna";
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioCallerId?: string;
  exotelApiKey?: string;
  exotelApiToken?: string;
  exotelSid?: string;
  updatedAt: string;
}

export interface StoredSubscription {
  planId: string;
  planName: string;
  price: number;
  status: "active" | "trial" | "expired";
  callingMinutesRemaining: number;
  renewalDate: string;
  lastPaymentId?: string;
}

export interface StoredAutoRecharge {
  enabled: boolean;
  threshold: number;
  rechargeAmount: number;
  paymentMethod: string;
  gstin: string;
  updatedAt: string;
}

export interface StoredIVRNode {
  id: string;
  type: string;
  title: string;
  description: string;
  config: Record<string, any>;
  next?: string[];
}

export interface StoredRoleMatrix {
  roles: Record<string, Record<string, boolean>>;
  updatedAt: string;
}

export interface StoredABSplit {
  splitPercentA: number;
  splitPercentB: number;
  scriptA: string;
  scriptB: string;
  winnerVariant?: "A" | "B";
  updatedAt: string;
}

export interface ClinicAppointment {
  id: string;
  tokenNumber: number;
  patientName: string;
  patientPhone: string;
  patientAge: number;
  gender: "Male" | "Female" | "Other";
  doctorName: string;
  slot: string;
  status: "Waiting" | "Consulting" | "Completed" | "Cancelled";
  chiefComplaint: string;
  fee: number;
  paid: boolean;
  createdAt: string;
}

export interface PatientVitals {
  bp: string;
  pulse: number;
  spo2: number;
  weight: number;
  temperature: number;
}

export interface ClinicPatient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  bloodGroup: string;
  allergies?: string[];
  vitals: PatientVitals;
  history: Array<{
    date: string;
    diagnosis: string;
    medicines: Array<{ name: string; dosage: string; duration: string }>;
    notes: string;
  }>;
}

export interface ClinicMedicine {
  id: string;
  name: string;
  category: "Tablet" | "Syrup" | "Capsule" | "Injection" | "Ointment";
  batchNo: string;
  stockQty: number;
  unitPrice: number;
  expiryDate: string;
  reorderLevel: number;
}

export interface ClinicInvoice {
  id: string;
  invoiceNo: string;
  patientName: string;
  patientPhone: string;
  consultationFee: number;
  pharmacyAmount: number;
  labAmount: number;
  discount: number;
  totalAmount: number;
  paymentMode: "Cash" | "UPI" | "Card";
  createdAt: string;
}

interface DatabaseStructure {
  leads: StoredLead[];
  cdrLogs: StoredCDR[];
  carrierConfig: StoredCarrierConfig;
  subscription: StoredSubscription;
  autoRecharge: StoredAutoRecharge;
  ivrNodes: StoredIVRNode[];
  rolesMatrix: StoredRoleMatrix;
  abSplitConfig: StoredABSplit;
  clinicAppointments: ClinicAppointment[];
  clinicPatients: ClinicPatient[];
  clinicMedicines: ClinicMedicine[];
  clinicInvoices: ClinicInvoice[];
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "storage.json");

const INITIAL_LEADS: StoredLead[] = [
  {
    id: "lead-01",
    name: "Aarav Mehta",
    phone: "+91 99887 11002",
    company: "Northstar Foods Pvt Ltd",
    source: "Website Callback",
    stage: "Interested",
    score: 88,
    last: "2 min ago",
    notes: ["Customer requested pricing for 12 retail outlets.", "Interested in Hindi voice reminders."],
    isDnc: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "lead-02",
    name: "Neha Iyer",
    phone: "+91 97654 30781",
    company: "Bloom Retail Mart",
    source: "Meta Ads Campaign",
    stage: "Callback",
    score: 74,
    last: "8 min ago",
    notes: ["Asked for demo call on weekend."],
    isDnc: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "lead-03",
    name: "Kabir Singh",
    phone: "+91 98990 48210",
    company: "Suncore Energy Logistics",
    source: "Partner Referral",
    stage: "New",
    score: 66,
    last: "16 min ago",
    notes: ["Direct inquiry about IVR routing flows."],
    isDnc: false,
    createdAt: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: "lead-04",
    name: "Ishita Rao",
    phone: "+91 98731 22912",
    company: "Mango Tree Labs",
    source: "Landing page demo",
    stage: "Converted",
    score: 94,
    last: "24 min ago",
    notes: ["Subscribed to Pro Annual calling plan."],
    isDnc: false,
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: "lead-05",
    name: "Vikram Shah",
    phone: "+91 98203 55180",
    company: "Bharat Machines Corporation",
    source: "Cold outreach import",
    stage: "DNC",
    score: 38,
    last: "31 min ago",
    notes: ["Lead requested removal from promotional dialer."],
    isDnc: true,
    createdAt: new Date(Date.now() - 18000000).toISOString(),
  },
];

const INITIAL_CDR: StoredCDR[] = [
  {
    id: "call-901",
    customerName: "Aarav Mehta",
    customerPhone: "+91 99887 11002",
    agentName: "Asha (AI Voice)",
    campaign: "Festive season follow-up",
    duration: "01:42",
    durationSeconds: 102,
    status: "Completed",
    sentiment: "Positive",
    qaScore: 96,
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: "call-902",
    customerName: "Neha Iyer",
    customerPhone: "+91 97654 30781",
    agentName: "Rahul Verma",
    campaign: "Enterprise renewal desk",
    duration: "02:18",
    durationSeconds: 138,
    status: "Completed",
    sentiment: "Positive",
    qaScore: 89,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "call-903",
    customerName: "Kabir Singh",
    customerPhone: "+91 98990 48210",
    agentName: "Asha (AI Voice)",
    campaign: "Inbound demo callbacks",
    duration: "00:45",
    durationSeconds: 45,
    status: "Completed",
    sentiment: "Neutral",
    qaScore: 82,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const DEFAULT_AUTO_RECHARGE: StoredAutoRecharge = {
  enabled: true,
  threshold: 5000,
  rechargeAmount: 25000,
  paymentMethod: "upi_autopay",
  gstin: "27AABCC1234F1Z8",
  updatedAt: new Date().toISOString(),
};

const DEFAULT_IVR_NODES: StoredIVRNode[] = [
  {
    id: "node-1",
    type: "greeting",
    title: "1. Welcome Greeting",
    description: "Plays bilingual TRAI audio greeting and compliance disclosure.",
    config: {
      audioPrompt: "Welcome to CallForge Solutions. Calls are recorded for quality assurance.",
      voice: "Asha (Hindi/English)",
    },
    next: ["node-2"],
  },
  {
    id: "node-2",
    type: "menu",
    title: "2. DTMF Keypress Menu",
    description: "Press 1 for Autonomous AI qualifier, Press 2 for Enterprise Sales.",
    config: {
      options: [
        { key: "1", target: "node-3", label: "Connect with AI Agent" },
        { key: "2", target: "node-4", label: "Connect with Live Specialist" },
      ],
      timeoutSeconds: 5,
    },
    next: ["node-3", "node-4"],
  },
  {
    id: "node-3",
    type: "ai_agent",
    title: "3. Asha AI Qualifier",
    description: "Answers queries, captures lead requirements, schedules calendar appointments.",
    config: {
      agent: "Asha · Retail Qualifier",
      model: "Claude 3.5 Sonnet Telephony",
      language: "Hinglish",
    },
    next: ["node-5"],
  },
  {
    id: "node-4",
    type: "human_queue",
    title: "4. Senior Agent Queue",
    description: "Routes call to available human supervisor with round-robin strategy.",
    config: {
      queueName: "Enterprise Tier 1",
      maxWaitSeconds: 45,
      fallback: "node-5",
    },
    next: ["node-5"],
  },
  {
    id: "node-5",
    type: "voicemail",
    title: "5. Voicemail & SMS Confirmation",
    description: "If busy or after-hours, records audio voicemail and dispatches WhatsApp alert.",
    config: {
      sendSms: true,
      whatsappTemplate: "callforge_enquiry_ack",
    },
  },
];

const DEFAULT_ROLES_MATRIX: StoredRoleMatrix = {
  roles: {
    admin: {
      view_billing: true,
      start_campaigns: true,
      barge_whisper: true,
      export_cdr: true,
      edit_script: true,
      override_qa: true,
    },
    supervisor: {
      view_billing: false,
      start_campaigns: true,
      barge_whisper: true,
      export_cdr: true,
      edit_script: true,
      override_qa: true,
    },
    agent: {
      view_billing: false,
      start_campaigns: false,
      barge_whisper: false,
      export_cdr: false,
      edit_script: false,
      override_qa: false,
    },
  },
  updatedAt: new Date().toISOString(),
};

const DEFAULT_AB_SPLIT: StoredABSplit = {
  splitPercentA: 50,
  splitPercentB: 50,
  scriptA:
    "Namaste {lead_name} ji. We are offering an exclusive 20% discount on festive calling agent packs. Would you like to schedule a 10-minute demo with our team?",
  scriptB:
    "Namaste {lead_name} ji! Most retail businesses in {city} are saving 4 hours daily using CallForge AI calling. Can we demonstrate how it handles your festive inbound rush?",
  updatedAt: new Date().toISOString(),
};

const DEFAULT_CLINIC_APPOINTMENTS: ClinicAppointment[] = [
  {
    id: "apt-01",
    tokenNumber: 1,
    patientName: "Amit Patel",
    patientPhone: "+91 98201 44520",
    patientAge: 38,
    gender: "Male",
    doctorName: "Dr. Arjun Mehta (MD Medicine)",
    slot: "10:00 AM",
    status: "Consulting",
    chiefComplaint: "Persistent dry cough, mild fever since 3 days",
    fee: 500,
    paid: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt-02",
    tokenNumber: 2,
    patientName: "Sunita Deshmukh",
    patientPhone: "+91 98450 11982",
    patientAge: 52,
    gender: "Female",
    doctorName: "Dr. Arjun Mehta (MD Medicine)",
    slot: "10:20 AM",
    status: "Waiting",
    chiefComplaint: "Routine hypertension & diabetes follow-up",
    fee: 500,
    paid: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt-03",
    tokenNumber: 3,
    patientName: "Rahul Joshi",
    patientPhone: "+91 97110 88231",
    patientAge: 29,
    gender: "Male",
    doctorName: "Dr. Arjun Mehta (MD Medicine)",
    slot: "10:40 AM",
    status: "Waiting",
    chiefComplaint: "Severe migraine and neck stiffness",
    fee: 500,
    paid: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt-04",
    tokenNumber: 4,
    patientName: "Pooja Sharma",
    patientPhone: "+91 98990 33412",
    patientAge: 34,
    gender: "Female",
    doctorName: "Dr. Arjun Mehta (MD Medicine)",
    slot: "11:00 AM",
    status: "Waiting",
    chiefComplaint: "Seasonal allergy and throat irritation",
    fee: 500,
    paid: true,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_CLINIC_PATIENTS: ClinicPatient[] = [
  {
    id: "pat-01",
    name: "Amit Patel",
    phone: "+91 98201 44520",
    age: 38,
    gender: "Male",
    bloodGroup: "B+",
    allergies: ["Sulfa drugs"],
    vitals: {
      bp: "124/82",
      pulse: 78,
      spo2: 98,
      weight: 72,
      temperature: 99.1,
    },
    history: [
      {
        date: "12 Aug 2026",
        diagnosis: "Upper Respiratory Tract Infection",
        medicines: [
          { name: "Amoxicillin 500mg", dosage: "1-0-1", duration: "5 days" },
          { name: "Paracetamol 650mg", dosage: "1-0-1", duration: "3 days" },
        ],
        notes: "Advised warm saline gargles and steam inhalation.",
      },
    ],
  },
  {
    id: "pat-02",
    name: "Sunita Deshmukh",
    phone: "+91 98450 11982",
    age: 52,
    gender: "Female",
    bloodGroup: "O+",
    allergies: [],
    vitals: {
      bp: "138/88",
      pulse: 74,
      spo2: 99,
      weight: 65,
      temperature: 98.4,
    },
    history: [
      {
        date: "01 Sep 2026",
        diagnosis: "Essential Hypertension Stage 1",
        medicines: [
          { name: "Telmisartan 40mg", dosage: "1-0-0", duration: "30 days" },
        ],
        notes: "BP under control. Advised low sodium diet.",
      },
    ],
  },
];

const DEFAULT_CLINIC_MEDICINES: ClinicMedicine[] = [
  {
    id: "med-01",
    name: "Paracetamol 650mg (Dolo)",
    category: "Tablet",
    batchNo: "DL-8841",
    stockQty: 480,
    unitPrice: 32,
    expiryDate: "12/2027",
    reorderLevel: 50,
  },
  {
    id: "med-02",
    name: "Amoxicillin 500mg (Mox)",
    category: "Capsule",
    batchNo: "MX-2091",
    stockQty: 240,
    unitPrice: 85,
    expiryDate: "08/2027",
    reorderLevel: 30,
  },
  {
    id: "med-03",
    name: "Pantoprazole 40mg (Pan-40)",
    category: "Tablet",
    batchNo: "PN-4019",
    stockQty: 320,
    unitPrice: 95,
    expiryDate: "05/2028",
    reorderLevel: 40,
  },
  {
    id: "med-04",
    name: "Cough Syrup (Ascoril-D 100ml)",
    category: "Syrup",
    batchNo: "AS-1102",
    stockQty: 18,
    unitPrice: 125,
    expiryDate: "03/2027",
    reorderLevel: 25,
  },
  {
    id: "med-05",
    name: "Cetirizine 10mg (Cetzine)",
    category: "Tablet",
    batchNo: "CZ-9081",
    stockQty: 500,
    unitPrice: 28,
    expiryDate: "11/2027",
    reorderLevel: 50,
  },
];

const DEFAULT_CLINIC_INVOICES: ClinicInvoice[] = [
  {
    id: "inv-101",
    invoiceNo: "INV-2026-0891",
    patientName: "Amit Patel",
    patientPhone: "+91 98201 44520",
    consultationFee: 500,
    pharmacyAmount: 117,
    labAmount: 0,
    discount: 0,
    totalAmount: 617,
    paymentMode: "UPI",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "inv-102",
    invoiceNo: "INV-2026-0892",
    patientName: "Sunita Deshmukh",
    patientPhone: "+91 98450 11982",
    consultationFee: 500,
    pharmacyAmount: 95,
    labAmount: 250,
    discount: 45,
    totalAmount: 800,
    paymentMode: "Cash",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

class PersistentStorage {
  private data: DatabaseStructure;

  constructor() {
    this.ensureDir();
    this.data = this.load();
  }

  private ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private load(): DatabaseStructure {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        // Ensure defaults if keys are missing in existing file
        if (!parsed.autoRecharge) parsed.autoRecharge = DEFAULT_AUTO_RECHARGE;
        if (!parsed.ivrNodes || !Array.isArray(parsed.ivrNodes)) parsed.ivrNodes = DEFAULT_IVR_NODES;
        if (!parsed.rolesMatrix || !parsed.rolesMatrix.roles) parsed.rolesMatrix = DEFAULT_ROLES_MATRIX;
        if (!parsed.abSplitConfig) parsed.abSplitConfig = DEFAULT_AB_SPLIT;
        if (!parsed.clinicAppointments || !Array.isArray(parsed.clinicAppointments)) parsed.clinicAppointments = DEFAULT_CLINIC_APPOINTMENTS;
        if (!parsed.clinicPatients || !Array.isArray(parsed.clinicPatients)) parsed.clinicPatients = DEFAULT_CLINIC_PATIENTS;
        if (!parsed.clinicMedicines || !Array.isArray(parsed.clinicMedicines)) parsed.clinicMedicines = DEFAULT_CLINIC_MEDICINES;
        if (!parsed.clinicInvoices || !Array.isArray(parsed.clinicInvoices)) parsed.clinicInvoices = DEFAULT_CLINIC_INVOICES;
        this.save(parsed);
        return parsed;
      }
    } catch (e) {
      console.warn("[PersistentStorage] Failed reading storage file, initializing default", e);
    }

    const defaultData: DatabaseStructure = {
      leads: INITIAL_LEADS,
      cdrLogs: INITIAL_CDR,
      carrierConfig: {
        provider: (process.env.DEFAULT_TELEPHONY_PROVIDER as any) || "mock",
        twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
        twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
        twilioCallerId: process.env.TWILIO_CALLER_ID || "+18005550199",
        exotelApiKey: process.env.EXOTEL_API_KEY || "",
        exotelApiToken: process.env.EXOTEL_API_TOKEN || "",
        exotelSid: process.env.EXOTEL_SID || "",
        updatedAt: new Date().toISOString(),
      },
      subscription: {
        planId: "plan_pro",
        planName: "Pro Enterprise Calling",
        price: 5999,
        status: "active",
        callingMinutesRemaining: 4850,
        renewalDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
      autoRecharge: DEFAULT_AUTO_RECHARGE,
      ivrNodes: DEFAULT_IVR_NODES,
      rolesMatrix: DEFAULT_ROLES_MATRIX,
      abSplitConfig: DEFAULT_AB_SPLIT,
      clinicAppointments: DEFAULT_CLINIC_APPOINTMENTS,
      clinicPatients: DEFAULT_CLINIC_PATIENTS,
      clinicMedicines: DEFAULT_CLINIC_MEDICINES,
      clinicInvoices: DEFAULT_CLINIC_INVOICES,
    };

    this.save(defaultData);
    return defaultData;
  }

  private save(data: DatabaseStructure) {
    try {
      this.ensureDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error("[PersistentStorage] Error writing storage file", e);
    }
  }

  // --- Leads Operations ---
  getLeads(): StoredLead[] {
    return this.data.leads;
  }

  addLead(lead: Omit<StoredLead, "id" | "createdAt" | "notes"> & { notes?: string[] }): StoredLead {
    const newLead: StoredLead = {
      id: `lead_${nanoid(8)}`,
      ...lead,
      notes: lead.notes || [],
      createdAt: new Date().toISOString(),
    };
    this.data.leads.unshift(newLead);
    this.save(this.data);
    return newLead;
  }

  updateLead(id: string, updates: Partial<StoredLead>): StoredLead | null {
    const idx = this.data.leads.findIndex((l) => l.id === id || l.phone === updates.phone);
    if (idx === -1) return null;
    this.data.leads[idx] = { ...this.data.leads[idx], ...updates };
    this.save(this.data);
    return this.data.leads[idx];
  }

  // --- CDR Logs Operations ---
  getCDRLogs(): StoredCDR[] {
    return this.data.cdrLogs;
  }

  addCDRLog(cdr: Omit<StoredCDR, "id" | "createdAt">): StoredCDR {
    const newCDR: StoredCDR = {
      id: `call_${nanoid(8)}`,
      ...cdr,
      createdAt: new Date().toISOString(),
    };
    this.data.cdrLogs.unshift(newCDR);
    this.save(this.data);
    return newCDR;
  }

  // --- Carrier Configuration Operations ---
  getCarrierConfig(): StoredCarrierConfig {
    return this.data.carrierConfig;
  }

  updateCarrierConfig(config: Partial<StoredCarrierConfig>): StoredCarrierConfig {
    this.data.carrierConfig = {
      ...this.data.carrierConfig,
      ...config,
      updatedAt: new Date().toISOString(),
    };

    // Reflect to process.env immediately for runtime provider dispatch
    if (config.twilioAccountSid) process.env.TWILIO_ACCOUNT_SID = config.twilioAccountSid;
    if (config.twilioAuthToken) process.env.TWILIO_AUTH_TOKEN = config.twilioAuthToken;
    if (config.twilioCallerId) process.env.TWILIO_CALLER_ID = config.twilioCallerId;
    if (config.exotelApiKey) process.env.EXOTEL_API_KEY = config.exotelApiKey;
    if (config.exotelApiToken) process.env.EXOTEL_API_TOKEN = config.exotelApiToken;
    if (config.exotelSid) process.env.EXOTEL_SID = config.exotelSid;
    if (config.provider) process.env.DEFAULT_TELEPHONY_PROVIDER = config.provider;

    this.save(this.data);
    return this.data.carrierConfig;
  }

  // --- Subscription & Billing Operations ---
  getSubscription(): StoredSubscription {
    return this.data.subscription;
  }

  activateSubscription(planId: string, planName: string, price: number, paymentId: string): StoredSubscription {
    this.data.subscription = {
      planId,
      planName,
      price,
      status: "active",
      callingMinutesRemaining: (this.data.subscription.callingMinutesRemaining || 0) + (planId === "plan_pro" ? 5000 : 2000),
      renewalDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      lastPaymentId: paymentId,
    };
    this.save(this.data);
    return this.data.subscription;
  }

  // --- Auto-Recharge Operations ---
  getAutoRecharge(): StoredAutoRecharge {
    return this.data.autoRecharge || DEFAULT_AUTO_RECHARGE;
  }

  updateAutoRecharge(settings: Partial<StoredAutoRecharge>): StoredAutoRecharge {
    this.data.autoRecharge = {
      ...(this.data.autoRecharge || DEFAULT_AUTO_RECHARGE),
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    this.save(this.data);
    return this.data.autoRecharge;
  }

  // --- Visual IVR Operations ---
  getIVRNodes(): StoredIVRNode[] {
    return this.data.ivrNodes && this.data.ivrNodes.length > 0 ? this.data.ivrNodes : DEFAULT_IVR_NODES;
  }

  saveIVRNodes(nodes: StoredIVRNode[]): StoredIVRNode[] {
    this.data.ivrNodes = nodes;
    this.save(this.data);
    return this.data.ivrNodes;
  }

  // --- Roles & RBAC Matrix Operations ---
  getRoleMatrix(): Record<string, Record<string, boolean>> {
    return this.data.rolesMatrix?.roles || DEFAULT_ROLES_MATRIX.roles;
  }

  saveRoleMatrix(roles: Record<string, Record<string, boolean>>): Record<string, Record<string, boolean>> {
    this.data.rolesMatrix = {
      roles,
      updatedAt: new Date().toISOString(),
    };
    this.save(this.data);
    return this.data.rolesMatrix.roles;
  }

  // --- A/B Voice & Pitch Split Operations ---
  getABSplit(): StoredABSplit {
    return this.data.abSplitConfig || DEFAULT_AB_SPLIT;
  }

  updateABSplit(config: Partial<StoredABSplit>): StoredABSplit {
    this.data.abSplitConfig = {
      ...(this.data.abSplitConfig || DEFAULT_AB_SPLIT),
      ...config,
      updatedAt: new Date().toISOString(),
    };
    this.save(this.data);
    return this.data.abSplitConfig;
  }

  // --- Clinic Management System 2026 Operations ---

  getClinicAppointments(): ClinicAppointment[] {
    return this.data.clinicAppointments || DEFAULT_CLINIC_APPOINTMENTS;
  }

  addClinicAppointment(data: Omit<ClinicAppointment, "id" | "tokenNumber" | "createdAt">): ClinicAppointment {
    const list = this.data.clinicAppointments || [];
    const maxToken = list.reduce((max, a) => Math.max(max, a.tokenNumber || 0), 0);
    const newAppointment: ClinicAppointment = {
      id: `apt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tokenNumber: maxToken + 1,
      ...data,
      createdAt: new Date().toISOString(),
    };
    this.data.clinicAppointments = [newAppointment, ...list];
    this.save(this.data);

    // Auto add or update patient profile if not exists
    const existingPatient = (this.data.clinicPatients || []).find(
      (p) => p.phone === data.patientPhone || p.name.toLowerCase() === data.patientName.toLowerCase()
    );
    if (!existingPatient) {
      this.addOrUpdateClinicPatient({
        name: data.patientName,
        phone: data.patientPhone,
        age: data.patientAge,
        gender: data.gender,
        bloodGroup: "Unknown",
        vitals: { bp: "120/80", pulse: 72, spo2: 98, weight: 65, temperature: 98.6 },
        history: [],
      });
    }

    return newAppointment;
  }

  updateAppointmentStatus(id: string, status: ClinicAppointment["status"]): ClinicAppointment | null {
    const list = this.data.clinicAppointments || [];
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    list[idx].status = status;
    this.save(this.data);
    return list[idx];
  }

  deleteClinicAppointment(id: string): boolean {
    const initialLen = (this.data.clinicAppointments || []).length;
    this.data.clinicAppointments = (this.data.clinicAppointments || []).filter((a) => a.id !== id);
    if (this.data.clinicAppointments.length !== initialLen) {
      this.save(this.data);
      return true;
    }
    return false;
  }

  getClinicPatients(): ClinicPatient[] {
    return this.data.clinicPatients || DEFAULT_CLINIC_PATIENTS;
  }

  getClinicPatientById(id: string): ClinicPatient | undefined {
    return (this.data.clinicPatients || []).find((p) => p.id === id);
  }

  addOrUpdateClinicPatient(patientData: Partial<ClinicPatient> & { name: string; phone: string }): ClinicPatient {
    const list = this.data.clinicPatients || [];
    const idx = list.findIndex((p) => p.phone === patientData.phone);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...patientData,
      };
      this.save(this.data);
      return list[idx];
    } else {
      const newPatient: ClinicPatient = {
        id: `pat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: patientData.name,
        phone: patientData.phone,
        age: patientData.age || 30,
        gender: patientData.gender || "Other",
        bloodGroup: patientData.bloodGroup || "B+",
        allergies: patientData.allergies || [],
        vitals: patientData.vitals || { bp: "120/80", pulse: 72, spo2: 98, weight: 65, temperature: 98.6 },
        history: patientData.history || [],
      };
      this.data.clinicPatients = [newPatient, ...list];
      this.save(this.data);
      return newPatient;
    }
  }

  updatePatientVitals(patientId: string, vitals: PatientVitals): ClinicPatient | null {
    const list = this.data.clinicPatients || [];
    const patient = list.find((p) => p.id === patientId);
    if (!patient) return null;
    patient.vitals = vitals;
    this.save(this.data);
    return patient;
  }

  addConsultationRecord(
    patientId: string,
    record: { date: string; diagnosis: string; medicines: Array<{ name: string; dosage: string; duration: string }>; notes: string }
  ): ClinicPatient | null {
    const list = this.data.clinicPatients || [];
    const patient = list.find((p) => p.id === patientId);
    if (!patient) return null;
    if (!patient.history) patient.history = [];
    patient.history.unshift(record);
    this.save(this.data);
    return patient;
  }

  getClinicMedicines(): ClinicMedicine[] {
    return this.data.clinicMedicines || DEFAULT_CLINIC_MEDICINES;
  }

  addClinicMedicine(med: Omit<ClinicMedicine, "id">): ClinicMedicine {
    const list = this.data.clinicMedicines || [];
    const newMed: ClinicMedicine = {
      id: `med-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...med,
    };
    this.data.clinicMedicines = [...list, newMed];
    this.save(this.data);
    return newMed;
  }

  updateClinicMedicine(id: string, updates: Partial<ClinicMedicine>): ClinicMedicine | null {
    const list = this.data.clinicMedicines || [];
    const idx = list.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    this.save(this.data);
    return list[idx];
  }

  dispenseMedicine(id: string, qty: number): { success: boolean; medicine?: ClinicMedicine; error?: string } {
    const list = this.data.clinicMedicines || [];
    const med = list.find((m) => m.id === id);
    if (!med) return { success: false, error: "Medicine not found in inventory" };
    if (med.stockQty < qty) {
      return { success: false, error: `Insufficient stock. Only ${med.stockQty} units available` };
    }
    med.stockQty -= qty;
    this.save(this.data);
    return { success: true, medicine: med };
  }

  getClinicInvoices(): ClinicInvoice[] {
    return this.data.clinicInvoices || DEFAULT_CLINIC_INVOICES;
  }

  createClinicInvoice(invoiceData: Omit<ClinicInvoice, "id" | "invoiceNo" | "createdAt">): ClinicInvoice {
    const list = this.data.clinicInvoices || [];
    const invNum = `INV-2026-${(list.length + 893).toString().padStart(4, "0")}`;
    const newInvoice: ClinicInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNo: invNum,
      ...invoiceData,
      createdAt: new Date().toISOString(),
    };
    this.data.clinicInvoices = [newInvoice, ...list];
    this.save(this.data);
    return newInvoice;
  }

  getClinicStats() {
    const appointments = this.getClinicAppointments();
    const medicines = this.getClinicMedicines();
    const invoices = this.getClinicInvoices();

    const waitingCount = appointments.filter((a) => a.status === "Waiting").length;
    const consultingCount = appointments.filter((a) => a.status === "Consulting").length;
    const completedCount = appointments.filter((a) => a.status === "Completed").length;
    const totalTokensToday = appointments.length;

    const todayRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
    const lowStockCount = medicines.filter((m) => m.stockQty <= m.reorderLevel).length;

    return {
      totalTokensToday,
      waitingCount,
      consultingCount,
      completedCount,
      todayRevenue,
      lowStockCount,
    };
  }
}

export const persistentStore = new PersistentStorage();
