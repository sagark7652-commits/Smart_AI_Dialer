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
  supervisorNotes?: string;
  isManualOverride?: boolean;
  criteria?: any[];
  createdAt: string;
}

export interface StoredCarrierConfig {
  provider: "mock" | "twilio" | "exotel" | "bolna" | "tata" | "tata_smartflo";
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioCallerId?: string;
  exotelApiKey?: string;
  exotelApiToken?: string;
  exotelSid?: string;
  tataApiKey?: string;
  tataToken?: string;
  tataCallerId?: string;
  tataSipTrunk?: string;
  rivaServerUrl?: string;
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

export interface StoredTransaction {
  id: string;
  type: "recharge" | "deduction" | "subscription_payment";
  amount: number;
  description: string;
  paymentMethod: string;
  status: "success" | "pending" | "failed";
  timestamp: string;
  referenceId: string;
}

export interface StoredInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  description: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  status: "paid" | "pending";
  paymentMethod: string;
}

export interface StoredTeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "supervisor" | "agent";
  status: "active" | "invited" | "suspended";
  extension: string;
  joinedAt: string;
  avatarInitials: string;
}

export interface StoredAuditLog {
  id: string;
  action: string;
  user: string;
  ip: string;
  timestamp: string;
  details: string;
  category: "billing" | "security" | "carrier" | "campaign" | "system";
}

export interface StoredWhatsAppMessage {
  id: string;
  recipientName: string;
  recipientPhone: string;
  templateName: string;
  body: string;
  status: "delivered" | "read" | "sent" | "failed";
  timestamp: string;
  disposition: string;
}

export interface StoredSupportTicket {
  id: string;
  ticketId: string;
  subject: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  message: string;
  userEmail?: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
}

export interface StoredConsentRecord {
  id: string;
  phone: string;
  name: string;
  source: string;
  timestamp: string;
  ipAddress: string;
  dltReference: string;
  status: "Verified Opt-in" | "DNC Scrub Blocked";
}

export interface StoredAppSettings {
  workspaceName?: string;
  callerId?: string;
  defaultLanguage?: string;
  provider?: string;
  codec?: string;
  maxRetries?: number;
  pacingMode?: string;
  audioChime?: boolean;
  autoWrapUp?: boolean;
  webhookUrl?: string;
  updatedAt?: string;
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
  walletBalance: number;
  transactions: StoredTransaction[];
  invoices: StoredInvoice[];
  teamMembers: StoredTeamMember[];
  auditLogs: StoredAuditLog[];
  whatsappLogs: StoredWhatsAppMessage[];
  supportTickets?: StoredSupportTicket[];
  consentRecords?: StoredConsentRecord[];
  appSettings?: StoredAppSettings;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "storage.json");

const INITIAL_LEADS: StoredLead[] = [];

const INITIAL_CDR: StoredCDR[] = [];

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
  winnerVariant: "B",
  updatedAt: new Date().toISOString(),
};

const DEFAULT_TEAM_MEMBERS: StoredTeamMember[] = [];

const DEFAULT_INVOICES: StoredInvoice[] = [];

const DEFAULT_TRANSACTIONS: StoredTransaction[] = [];

const DEFAULT_AUDIT_LOGS: StoredAuditLog[] = [];

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
        if (typeof parsed.walletBalance !== "number") parsed.walletBalance = 0;
        if (!parsed.transactions || !Array.isArray(parsed.transactions)) parsed.transactions = DEFAULT_TRANSACTIONS;
        if (!parsed.invoices || !Array.isArray(parsed.invoices)) parsed.invoices = DEFAULT_INVOICES;
        if (!parsed.teamMembers || !Array.isArray(parsed.teamMembers)) parsed.teamMembers = DEFAULT_TEAM_MEMBERS;
        if (!parsed.auditLogs || !Array.isArray(parsed.auditLogs)) parsed.auditLogs = DEFAULT_AUDIT_LOGS;
        if (!parsed.whatsappLogs || !Array.isArray(parsed.whatsappLogs)) parsed.whatsappLogs = [];
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
        planId: "plan_starter",
        planName: "Starter Tier",
        price: 0,
        status: "active",
        callingMinutesRemaining: 0,
        renewalDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
      autoRecharge: DEFAULT_AUTO_RECHARGE,
      ivrNodes: DEFAULT_IVR_NODES,
      rolesMatrix: DEFAULT_ROLES_MATRIX,
      abSplitConfig: DEFAULT_AB_SPLIT,
      walletBalance: 0.0,
      transactions: DEFAULT_TRANSACTIONS,
      invoices: DEFAULT_INVOICES,
      teamMembers: DEFAULT_TEAM_MEMBERS,
      auditLogs: DEFAULT_AUDIT_LOGS,
      whatsappLogs: [],
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

  bulkAddLeads(
    rawLeads: Array<Omit<StoredLead, "id" | "createdAt" | "notes"> & { notes?: string[] }>
  ): { added: number; total: number; leads: StoredLead[] } {
    const newlyAdded: StoredLead[] = [];
    const existingPhones = new Set(this.data.leads.map((l) => l.phone));

    for (const item of rawLeads) {
      if (!item.phone || existingPhones.has(item.phone)) continue;
      const lead: StoredLead = {
        id: `lead_${nanoid(8)}`,
        name: item.name || "Enterprise Lead",
        phone: item.phone,
        company: item.company || "General Prospect",
        source: item.source || "CSV Bulk Ingestion",
        stage: item.stage || "New",
        score: typeof item.score === "number" ? item.score : 70,
        last: "Just imported",
        notes: item.notes || ["Imported via Bulk CSV Uploader."],
        isDnc: item.isDnc || false,
        createdAt: new Date().toISOString(),
      };
      this.data.leads.unshift(lead);
      existingPhones.add(lead.phone);
      newlyAdded.push(lead);
    }

    if (newlyAdded.length > 0) {
      this.addAuditLog(
        "Bulk Leads Imported",
        "Arjun Mehta (Admin)",
        `Imported ${newlyAdded.length} new leads into dialing queue.`,
        "campaign"
      );
      this.save(this.data);
    }

    return {
      added: newlyAdded.length,
      total: this.data.leads.length,
      leads: newlyAdded,
    };
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

  updateCDRLog(id: string, updates: Partial<StoredCDR>): StoredCDR | null {
    const idx = this.data.cdrLogs.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.data.cdrLogs[idx] = { ...this.data.cdrLogs[idx], ...updates };
    this.save(this.data);
    return this.data.cdrLogs[idx];
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

  // --- Wallet & Telephony Billing Operations ---
  getWalletData() {
    return {
      balance: typeof this.data.walletBalance === "number" ? this.data.walletBalance : 28450.0,
      burnRatePerMin: 14.2,
      minutesUsed: 3682,
      minutesRemaining: this.data.subscription?.callingMinutesRemaining || 4850,
      subscription: this.data.subscription,
      autoRecharge: this.data.autoRecharge,
      transactions: this.data.transactions || DEFAULT_TRANSACTIONS,
      invoices: this.data.invoices || DEFAULT_INVOICES,
    };
  }

  topupWallet(amount: number, paymentMethod: string, notes?: string) {
    const current = typeof this.data.walletBalance === "number" ? this.data.walletBalance : 28450.0;
    this.data.walletBalance = +(current + amount).toFixed(2);

    const txnId = `txn_${nanoid(8)}`;
    const refId = `UPI-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const newTxn: StoredTransaction = {
      id: txnId,
      type: "recharge",
      amount,
      description: notes || `Prepaid Telephony Wallet Top-Up (${paymentMethod})`,
      paymentMethod,
      status: "success",
      timestamp: new Date().toISOString(),
      referenceId: refId,
    };
    if (!this.data.transactions) this.data.transactions = [...DEFAULT_TRANSACTIONS];
    this.data.transactions.unshift(newTxn);

    // GST Invoice
    const gstRate = 0.18;
    const subtotal = +(amount / (1 + gstRate)).toFixed(2);
    const gstAmount = +(amount - subtotal).toFixed(2);
    const invNum = `CF-INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newInvoice: StoredInvoice = {
      id: `inv_${nanoid(8)}`,
      invoiceNumber: invNum,
      date: new Date().toISOString(),
      description: `Telephony Trunk Wallet Top-Up - ${paymentMethod}`,
      subtotal,
      gstAmount,
      totalAmount: amount,
      status: "paid",
      paymentMethod,
    };
    if (!this.data.invoices) this.data.invoices = [...DEFAULT_INVOICES];
    this.data.invoices.unshift(newInvoice);

    this.addAuditLog(
      "Wallet Recharged",
      "Arjun Mehta (Admin)",
      `Added ₹${amount.toLocaleString()} via ${paymentMethod}. New balance: ₹${this.data.walletBalance.toLocaleString()}.`,
      "billing"
    );

    this.save(this.data);
    return {
      balance: this.data.walletBalance,
      transaction: newTxn,
      invoice: newInvoice,
    };
  }

  deductWallet(amount: number, description: string) {
    const current = typeof this.data.walletBalance === "number" ? this.data.walletBalance : 28450.0;
    this.data.walletBalance = Math.max(0, +(current - amount).toFixed(2));
    this.save(this.data);
    return this.data.walletBalance;
  }

  getInvoices(): StoredInvoice[] {
    return this.data.invoices || DEFAULT_INVOICES;
  }

  // --- Team & User Operations ---
  getTeamMembers(): StoredTeamMember[] {
    return this.data.teamMembers && this.data.teamMembers.length > 0
      ? this.data.teamMembers
      : DEFAULT_TEAM_MEMBERS;
  }

  addTeamMember(member: {
    name: string;
    email: string;
    role: "admin" | "supervisor" | "agent";
    extension?: string;
  }): StoredTeamMember {
    const initials = member.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const ext = member.extension || `${Math.floor(1000 + Math.random() * 9000)}`;
    const newMember: StoredTeamMember = {
      id: `team_${nanoid(8)}`,
      name: member.name,
      email: member.email,
      role: member.role,
      status: "active",
      extension: ext,
      joinedAt: new Date().toISOString(),
      avatarInitials: initials || "OP",
    };
    if (!this.data.teamMembers) this.data.teamMembers = [...DEFAULT_TEAM_MEMBERS];
    this.data.teamMembers.push(newMember);

    this.addAuditLog(
      "Added Team Member",
      "Arjun Mehta (Admin)",
      `Added ${member.name} (${member.role.toUpperCase()}) with extension ${ext}.`,
      "security"
    );

    this.save(this.data);
    return newMember;
  }

  updateTeamMember(id: string, updates: Partial<StoredTeamMember>): StoredTeamMember | null {
    if (!this.data.teamMembers) this.data.teamMembers = [...DEFAULT_TEAM_MEMBERS];
    const idx = this.data.teamMembers.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    this.data.teamMembers[idx] = { ...this.data.teamMembers[idx], ...updates };

    this.addAuditLog(
      "Updated Team Member",
      "Arjun Mehta (Admin)",
      `Updated profile for ${this.data.teamMembers[idx].name}.`,
      "security"
    );

    this.save(this.data);
    return this.data.teamMembers[idx];
  }

  deleteTeamMember(id: string): boolean {
    if (!this.data.teamMembers) this.data.teamMembers = [...DEFAULT_TEAM_MEMBERS];
    const member = this.data.teamMembers.find((m) => m.id === id);
    this.data.teamMembers = this.data.teamMembers.filter((m) => m.id !== id);
    if (member) {
      this.addAuditLog(
        "Removed Team Member",
        "Arjun Mehta (Admin)",
        `Removed ${member.name} from workspace.`,
        "security"
      );
    }
    this.save(this.data);
    return true;
  }

  // --- Platform Audit Logs ---
  getAuditLogs(): StoredAuditLog[] {
    return this.data.auditLogs && this.data.auditLogs.length > 0
      ? this.data.auditLogs
      : DEFAULT_AUDIT_LOGS;
  }

  addAuditLog(
    action: string,
    user: string,
    details: string,
    category: StoredAuditLog["category"] = "system"
  ): StoredAuditLog {
    const log: StoredAuditLog = {
      id: `log_${nanoid(8)}`,
      action,
      user,
      ip: "10.107.157.9",
      timestamp: new Date().toISOString(),
      details,
      category,
    };
    if (!this.data.auditLogs) this.data.auditLogs = [...DEFAULT_AUDIT_LOGS];
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 100) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 100);
    }
    this.save(this.data);
    return log;
  }

  // --- WhatsApp Automation Operations ---
  getWhatsAppLogs(): StoredWhatsAppMessage[] {
    return this.data.whatsappLogs || [];
  }

  sendWhatsAppMessage(msg: {
    recipientName: string;
    recipientPhone: string;
    templateName: string;
    body: string;
    disposition?: string;
  }): StoredWhatsAppMessage {
    const newMsg: StoredWhatsAppMessage = {
      id: `wa_${nanoid(8)}`,
      recipientName: msg.recipientName,
      recipientPhone: msg.recipientPhone,
      templateName: msg.templateName,
      body: msg.body,
      status: "delivered",
      timestamp: new Date().toISOString(),
      disposition: msg.disposition || "Interested",
    };

    if (!this.data.whatsappLogs) this.data.whatsappLogs = [];
    this.data.whatsappLogs.unshift(newMsg);

    this.addAuditLog(
      "WhatsApp Follow-up Sent",
      "Arjun Mehta (Automated)",
      `Delivered template '${msg.templateName}' to ${msg.recipientPhone} (${msg.recipientName}).`,
      "campaign"
    );

    this.save(this.data);
    return newMsg;
  }

  // --- Support Tickets Operations ---
  getSupportTickets(): StoredSupportTicket[] {
    return this.data.supportTickets || [];
  }

  addSupportTicket(ticket: Omit<StoredSupportTicket, "id" | "createdAt">): StoredSupportTicket {
    const newTicket: StoredSupportTicket = {
      id: `tkt_${nanoid(8)}`,
      ...ticket,
      createdAt: new Date().toISOString(),
    };
    if (!this.data.supportTickets) this.data.supportTickets = [];
    this.data.supportTickets.unshift(newTicket);
    this.addAuditLog(
      "NOC Ticket Created",
      "Support Desk",
      `Ticket #${newTicket.ticketId} logged: ${newTicket.subject} (${newTicket.category}).`,
      "system"
    );
    this.save(this.data);
    return newTicket;
  }

  // --- Consent & DLT Records Operations ---
  getConsentRecords(): StoredConsentRecord[] {
    if (this.data.consentRecords && this.data.consentRecords.length > 0) {
      return this.data.consentRecords;
    }
    // Generate records from leads and default entries
    const recordsFromLeads: StoredConsentRecord[] = this.data.leads.map((l, idx) => ({
      id: `CNS-${48900 + idx + 1}`,
      phone: l.phone,
      name: l.name,
      source: l.source === "CSV Bulk Ingestion" ? "CSV Ingestion (Scrubbed)" : "Web Inquiry Form (OTP Verified)",
      timestamp:
        new Date(l.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " IST",
      ipAddress: "103.21.144." + (((idx * 7) % 250) + 10),
      dltReference: l.isDnc ? "DLT-SCRUB-MATCH-FAIL" : "DLT-PE-1401552890014",
      status: l.isDnc ? "DNC Scrub Blocked" : "Verified Opt-in",
    }));

    return recordsFromLeads;
  }

  addConsentRecord(record: Omit<StoredConsentRecord, "id" | "timestamp">): StoredConsentRecord {
    const newRecord: StoredConsentRecord = {
      id: `CNS-${Math.floor(10000 + Math.random() * 90000)}`,
      ...record,
      timestamp:
        new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " IST",
    };
    if (!this.data.consentRecords) this.data.consentRecords = [];
    this.data.consentRecords.unshift(newRecord);
    this.save(this.data);
    return newRecord;
  }

  // --- App Settings Operations ---
  getAppSettings(): StoredAppSettings {
    return (
      this.data.appSettings || {
        workspaceName: "CreatorAI Telephony Ops",
        callerId: "+91 22 6988 4000 (Mumbai PBX)",
        defaultLanguage: "Hindi + Hinglish",
        provider: "Airtel PRI Trunk 01",
        codec: "Opus 48kHz HD Audio",
        maxRetries: 3,
        pacingMode: "Predictive",
        audioChime: true,
        autoWrapUp: true,
        webhookUrl: "https://api.callforge.io/webhooks/cdr",
        updatedAt: new Date().toISOString(),
      }
    );
  }

  updateAppSettings(settings: Partial<StoredAppSettings>): StoredAppSettings {
    this.data.appSettings = {
      ...this.getAppSettings(),
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    this.save(this.data);
    return this.data.appSettings;
  }
}

export const persistentStore = new PersistentStorage();
