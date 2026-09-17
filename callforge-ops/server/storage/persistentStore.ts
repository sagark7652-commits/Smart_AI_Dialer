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

interface DatabaseStructure {
  leads: StoredLead[];
  cdrLogs: StoredCDR[];
  carrierConfig: StoredCarrierConfig;
  subscription: StoredSubscription;
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
        return JSON.parse(raw);
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
}

export const persistentStore = new PersistentStorage();
