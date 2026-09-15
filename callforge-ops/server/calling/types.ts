export type DialerMode = "preview" | "progressive" | "predictive" | "blast";

export type CampaignStatus = "draft" | "queued" | "running" | "paused" | "completed" | "cancelled";

export type AgentState = "ready" | "on_call" | "wrap_up" | "break" | "offline";

export type CallStatus = "ringing" | "in_progress" | "completed" | "busy" | "no_answer" | "failed" | "abandoned";

export type SupervisorActionType = "listen" | "whisper" | "barge" | "takeover";

export interface CampaignLead {
  id: string;
  phone: string;
  name: string;
  company?: string;
  metadata?: Record<string, unknown>;
  status: "pending" | "dialing" | "connected" | "completed" | "failed" | "dnc";
  attempts: number;
  lastAttemptAt?: string;
}

export interface CampaignJob {
  id: string;
  name: string;
  dialerMode: DialerMode;
  status: CampaignStatus;
  callingWindow: {
    startHour: number; // e.g. 9 for 09:00
    endHour: number;   // e.g. 21 for 21:00
    timezone: string;  // e.g. "Asia/Kolkata"
  };
  script: string;
  callerId: string;
  leads: CampaignLead[];
  stats: {
    totalLeads: number;
    dialed: number;
    connected: number;
    qualified: number;
    failed: number;
    abandoned: number;
    averageDurationSeconds: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ActiveCall {
  id: string;
  campaignId?: string;
  leadId?: string;
  customerPhone: string;
  customerName: string;
  agentId?: string;
  agentName?: string;
  provider: "exotel" | "bolna" | "twilio" | "mock";
  status: CallStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  sentiment: "positive" | "neutral" | "negative";
  supervisorListening?: {
    supervisorId: string;
    mode: SupervisorActionType;
  };
  talkOverAlert?: boolean;
}

export interface CDRRecord {
  id: string;
  callId: string;
  campaignId?: string;
  customerPhone: string;
  customerName: string;
  agentId?: string;
  agentName?: string;
  disposition: string;
  durationSeconds: number;
  costInr: number;
  recordingUrl?: string;
  transcript?: string;
  summary?: string;
  qaScore?: number;
  qaRubric?: {
    mandatoryDisclosure: boolean;
    greetingPoliteness: number;
    objectionHandling: number;
    talkOverInterruption: number;
  };
  createdAt: string;
}

export interface TelephonyCallPayload {
  to: string;
  from: string;
  script?: string;
  metadata?: Record<string, unknown>;
  webhookUrl?: string;
  provider?: string;
}

export interface TelephonyCallResult {
  callId: string;
  provider: string;
  status: CallStatus;
  rawResponse?: Record<string, unknown>;
}

export interface WebhookEventPayload {
  provider: string;
  event: string;
  callId: string;
  customerPhone?: string;
  durationSeconds?: number;
  disposition?: string;
  recordingUrl?: string;
  transcript?: string;
  raw?: Record<string, unknown>;
}
