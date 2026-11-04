/**
 * Core Voice AI Agent Runtime Types & Provider Abstractions
 * Architecture: Telephony -> Realtime Audio -> VAD -> STT -> Agent Runtime (LLM + Tools + RAG + Memory) -> TTS -> Telephony
 */

export interface VADEvent {
  isSpeaking: boolean;
  confidence: number;
  speechStartMs?: number;
  speechEndMs?: number;
  isBargeIn?: boolean;
}

export interface VADProvider {
  name: string;
  processAudioChunk(pcmChunk: Buffer): Promise<VADEvent>;
  reset(): void;
}

export interface STTOptions {
  language?: string;
  sampleRate?: number;
  stream?: boolean;
}

export interface STTProvider {
  name: string;
  transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<{ text: string; confidence: number; language?: string }>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
  execute: (args: Record<string, any>, context: AgentSession) => Promise<Record<string, any>>;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface LLMCompletionOptions {
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  language?: string;
}

export interface LLMCompletionResult {
  text: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  finishReason: "stop" | "tool_calls" | "length";
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface LLMProvider {
  name: string;
  generate(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
}

export interface TTSOptions {
  voice?: string;
  language?: string;
  sampleRate?: number;
  speed?: number;
}

export interface TTSProvider {
  name: string;
  synthesize(text: string, options?: TTSOptions): Promise<{ audioBuffer: Buffer; format: "wav" | "pcm" | "mulaw"; sampleRate: number; success?: boolean }>;
}

export interface RAGDocument {
  id: string;
  title: string;
  content: string;
  category: "banking_policy" | "emi_schedule" | "kyc_rules" | "trai_compliance" | "general_faq" | "dental_clinic" | "dental_services" | string;
  tags: string[];
}

export interface AgentMemory {
  customerName?: string;
  phone?: string;
  accountNumber?: string;
  verifiedKYC: boolean;
  sentimentTrend: Array<"positive" | "neutral" | "negative">;
  extractedEntities: Record<string, any>;
  callSummary?: string;
  lastIntent?: string;
}

export interface AgentPersonaConfig {
  id: string;
  name: string;
  roleTitle: string;
  systemPrompt: string;
  language: "hi-IN" | "en-IN" | "mr-IN" | "mixed-indic";
  voiceId: string;
  ttsProvider: "kokoro_piper" | "riva_magpie" | "openai" | "local_tts";
  sttProvider: "whisper_local" | "deepgram" | "nemotron";
  llmProvider: "local_llm" | "groq_nemotron" | "openai_compatible";
  vadSensitivity: number; // 0.0 - 1.0
  bargeInEnabled: boolean;
  maxTurnDurationMs: number;
}

export interface AgentSession {
  sessionId: string;
  callId: string;
  carrier: "tata_smartflo" | "twilio" | "exotel" | "mock";
  customerPhone: string;
  agentConfig: AgentPersonaConfig;
  messages: LLMMessage[];
  memory: AgentMemory;
  startedAt: number;
  endedAt?: number;
  status: "initializing" | "in_conversation" | "transfer_pending" | "completed" | "terminated";
  transferTarget?: string;
  terminationReason?: string;
}
