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

interface DatabaseStructure {
  leads: StoredLead[];
  cdrLogs: StoredCDR[];
  carrierConfig: StoredCarrierConfig;
  subscription: StoredSubscription;
  autoRecharge: StoredAutoRecharge;
  ivrNodes: StoredIVRNode[];
  rolesMatrix: StoredRoleMatrix;
  abSplitConfig: StoredABSplit;
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
}

export const persistentStore = new PersistentStorage();
