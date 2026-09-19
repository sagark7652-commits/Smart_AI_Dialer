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
  provider: "exotel" | "bolna" | "twilio" | "mock" | "tata" | "tata_smartflo";
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

// NVIDIA Voice Pipeline Stack Types (Tata Dialer Speech Layer)
export interface NvidiaVoicePipelineConfig {
  rivaServerUrl: string; // e.g. "grpc://riva-speech.internal:50051" or NIM microservice
  rivaAsrModel: string; // "nemotron-asr-streaming"
  nemotronLlmModel: string; // "nemotron-4-340b-instruct" | "nemotron-mini-4b" | "llama-3.1-nemotron-70b"
  magpieTtsVoice: string; // "riva-magpie-multilingual-v1" | "magpie-aditi" | "magpie-arjun"
  sampleRateHz: number; // 16000
  channels: number; // 1 (mono)
  vadThreshold: number; // 0.65
  maxTokens: number; // 150
  temperature: number; // 0.2
  enabled: boolean;
}

export interface NvidiaPipelineStep {
  step: "riva_audio" | "nemotron_asr" | "nemotron_llm" | "business_logic" | "riva_magpie_tts";
  title: string;
  technology: string;
  durationMs: number;
  status: "success" | "streaming" | "pending" | "error";
  input: string;
  output: string;
  details?: Record<string, unknown>;
}

export interface NvidiaPipelineSimulationResult {
  id: string;
  query: string;
  finalSpeechText: string;
  totalDurationMs: number;
  steps: NvidiaPipelineStep[];
  telemetry: {
    sttLatencyMs: number;
    llmFirstTokenMs: number;
    ttsLatencyMs: number;
    networkRttMs: number;
    audioQualityScore: number;
    vadSpeechDurationMs: number;
  };
  audioWaveform?: number[];
  timestamp: string;
}
