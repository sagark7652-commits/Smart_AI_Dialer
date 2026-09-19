import { nanoid } from "nanoid";
import {
  NvidiaPipelineSimulationResult,
  NvidiaPipelineStep,
  NvidiaVoicePipelineConfig,
} from "./types";

// Default production configuration for NVIDIA Voice Stack on Tata Dialer
export const defaultNvidiaConfig: NvidiaVoicePipelineConfig = {
  rivaServerUrl: process.env.RIVA_SERVER_URL || "grpc://riva-speech.internal.callforge:50051",
  rivaAsrModel: "nemotron-asr-streaming",
  nemotronLlmModel: "nemotron-4-340b-instruct",
  magpieTtsVoice: "riva-magpie-multilingual-v1",
  sampleRateHz: 16000,
  channels: 1,
  vadThreshold: 0.65,
  maxTokens: 120,
  temperature: 0.2,
  enabled: true,
};

// Customer financial & business context mock database for agentic reasoning
interface CustomerContext {
  name: string;
  phone: string;
  loanAccount: {
    loanId: string;
    balanceInr: number;
    emiAmountInr: number;
    nextDueDate: string;
    status: "active" | "overdue" | "closed";
  };
}

const mockCustomerDb: Record<string, CustomerContext> = {
  default: {
    name: "Sanjay Singhania",
    phone: "+91 98201 12345",
    loanAccount: {
      loanId: "LN-TATA-8831",
      balanceInr: 50000,
      emiAmountInr: 4850,
      nextDueDate: "05-Oct-2026",
      status: "active",
    },
  },
};

export class NvidiaVoicePipelineService {
  private config: NvidiaVoicePipelineConfig;

  constructor() {
    this.config = { ...defaultNvidiaConfig };
  }

  getConfig(): NvidiaVoicePipelineConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<NvidiaVoicePipelineConfig>): NvidiaVoicePipelineConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  getStatus(): {
    status: "healthy" | "degraded" | "offline";
    stack: {
      rivaAudioGateway: { name: string; status: string; latencyMs: number };
      nemotronAsr: { model: string; status: string; latencyMs: number; mode: string };
      nemotronLlm: { model: string; status: string; latencyMs: number; mode: string };
      rivaMagpieTts: { model: string; status: string; latencyMs: number; languages: string[] };
    };
    telephonyBridge: {
      carrier: string;
      sipProtocol: string;
      codec: string;
      activeTrunk: string;
    };
  } {
    return {
      status: "healthy",
      stack: {
        rivaAudioGateway: {
          name: "NVIDIA Riva Audio Ingestion & VAD Gateway",
          status: "connected",
          latencyMs: 14,
        },
        nemotronAsr: {
          model: this.config.rivaAsrModel,
          status: "serving",
          latencyMs: 82,
          mode: "streaming-chunked",
        },
        nemotronLlm: {
          model: this.config.nemotronLlmModel,
          status: "ready",
          latencyMs: 108,
          mode: "agentic-reasoning",
        },
        rivaMagpieTts: {
          model: this.config.magpieTtsVoice,
          status: "ready",
          latencyMs: 76,
          languages: ["en-IN", "hi-IN", "mr-IN", "ta-IN", "te-IN"],
        },
      },
      telephonyBridge: {
        carrier: "Tata Dialer / Tata Smartflo Cloud Telephony",
        sipProtocol: "SIP/2.0 over TLS / RTP",
        codec: "G.711u / 16kHz PCM Linear",
        activeTrunk: "Tata SIP-02 (Mumbai Gateway)",
      },
    };
  }

  /**
   * Executes the full 4-tier Tata Dialer voice-AI flow:
   * 1. NVIDIA Riva (Audio Processing & VAD)
   * 2. Nemotron Speech ASR (Speech -> Text)
   * 3. Nemotron LLM (Understand/Think + Business Logic / Loan balance lookup)
   * 4. Riva Magpie TTS (Text -> Speech)
   */
  async simulatePipeline(
    userVoiceQuery?: string,
    customerPhone: string = "+91 98201 12345"
  ): Promise<NvidiaPipelineSimulationResult> {
    const startTime = Date.now();
    const query = userVoiceQuery?.trim() || "I want to know my loan balance.";
    const customer = mockCustomerDb[customerPhone] || mockCustomerDb.default;

    const steps: NvidiaPipelineStep[] = [];

    // -------------------------------------------------------------
    // STEP 1: NVIDIA Riva Audio Ingestion & VAD
    // -------------------------------------------------------------
    const step1Start = Date.now();
    const rivaAudioDuration = 16 + Math.floor(Math.random() * 6);
    steps.push({
      step: "riva_audio",
      title: "1. Audio Ingestion & VAD",
      technology: "NVIDIA Riva Audio Processing",
      durationMs: rivaAudioDuration,
      status: "success",
      input: "Incoming 16kHz PCM audio stream from Tata Dialer SIP Trunk",
      output: "VAD Speech Boundary Detected (End-of-Utterance confirmed, SNR: 28.4 dB)",
      details: {
        samplingRate: `${this.config.sampleRateHz} Hz`,
        channels: this.config.channels,
        vadConfidence: 0.96,
        noiseFloorDb: -42.8,
      },
    });

    // -------------------------------------------------------------
    // STEP 2: Nemotron Speech ASR (Speech -> Text)
    // -------------------------------------------------------------
    const asrDuration = 78 + Math.floor(Math.random() * 12);
    // STT produces exact speech transcription
    const sttTranscript = query;
    steps.push({
      step: "nemotron_asr",
      title: "2. Speech-to-Text (STT)",
      technology: `NVIDIA Nemotron ASR (${this.config.rivaAsrModel}) via Riva NIM`,
      durationMs: asrDuration,
      status: "success",
      input: "Streamed audio buffer (0.84s duration)",
      output: `"${sttTranscript}"`,
      details: {
        streamingChunkMs: 40,
        wordErrorRateEst: "1.8%",
        language: "en-IN / Indic Mixed",
        confidence: 0.984,
      },
    });

    // -------------------------------------------------------------
    // STEP 3: Nemotron LLM & Business Logic (Understand/Think)
    // -------------------------------------------------------------
    const llmDuration = 104 + Math.floor(Math.random() * 16);
    let agentResponse = "";
    let businessActionTaken = "";

    const lower = query.toLowerCase();
    if (lower.includes("loan balance") || lower.includes("balance") || lower.includes("outstanding")) {
      const formattedBalance = customer.loanAccount.balanceInr.toLocaleString("en-IN");
      agentResponse = `Your current loan balance is ₹${formattedBalance}.`;
      businessActionTaken = `Executed tool: fetch_loan_account_balance(loanId="${customer.loanAccount.loanId}"). Found active balance: ₹${formattedBalance}.`;
    } else if (lower.includes("emi") || lower.includes("due date")) {
      const formattedEmi = customer.loanAccount.emiAmountInr.toLocaleString("en-IN");
      agentResponse = `Your upcoming EMI of ₹${formattedEmi} is scheduled for ${customer.loanAccount.nextDueDate}.`;
      businessActionTaken = `Executed tool: fetch_emi_schedule(loanId="${customer.loanAccount.loanId}"). Next due: ${customer.loanAccount.nextDueDate}.`;
    } else if (lower.includes("interest") || lower.includes("rate")) {
      agentResponse = "Your existing personal loan has a fixed interest rate of 10.5% per annum.";
      businessActionTaken = `Executed tool: fetch_loan_terms(loanId="${customer.loanAccount.loanId}").`;
    } else if (lower.includes("pay") || lower.includes("repay")) {
      agentResponse = "I have sent a secure Tata Smartflo UPI payment link to your registered mobile number.";
      businessActionTaken = `Executed tool: trigger_payment_link_sms(phone="${customer.phone}").`;
    } else {
      agentResponse = `Namaste ${customer.name}, I understand you are inquiring regarding your account. How else may I assist you today?`;
      businessActionTaken = "Contextual conversational greeting dispatched via Nemotron LLM.";
    }

    steps.push({
      step: "nemotron_llm",
      title: "3. LLM / Response Generation",
      technology: `NVIDIA Nemotron (${this.config.nemotronLlmModel})`,
      durationMs: llmDuration,
      status: "success",
      input: `Transcript: "${sttTranscript}" | Intent: Banking / Loan Query`,
      output: `"${agentResponse}"`,
      details: {
        businessLogic: businessActionTaken,
        tokensGenerated: 18,
        tokenPerSec: 165.2,
        firstTokenLatencyMs: 44,
      },
    });

    // -------------------------------------------------------------
    // STEP 4: Riva Magpie TTS (Text -> Speech)
    // -------------------------------------------------------------
    const ttsDuration = 72 + Math.floor(Math.random() * 14);
    steps.push({
      step: "riva_magpie_tts",
      title: "4. Text-to-Speech (TTS)",
      technology: `NVIDIA Riva Magpie TTS (${this.config.magpieTtsVoice})`,
      durationMs: ttsDuration,
      status: "success",
      input: `"${agentResponse}"`,
      output: "Synthesized 24kHz human-like neural audio with conversational prosody",
      details: {
        voiceModel: "Riva Magpie Multilingual Agentic",
        audioFormat: "Linear PCM 24kHz / G.711 Telephony Transcoded",
        rtf: 0.12, // Real-time factor (under 0.15 = exceptional)
        prosodyQuality: "Natural Conversational Native",
      },
    });

    const totalDurationMs = rivaAudioDuration + asrDuration + llmDuration + ttsDuration;

    // Generate simulated audio waveform sample heights for visualization
    const waveform = Array.from({ length: 32 }, (_, i) => {
      const v = Math.sin((i / 32) * Math.PI * 4) * 0.4 + Math.random() * 0.5 + 0.3;
      return Math.min(1, Math.max(0.15, Number(v.toFixed(2))));
    });

    return {
      id: `nv_sim_${nanoid(10)}`,
      query,
      finalSpeechText: agentResponse,
      totalDurationMs,
      steps,
      telemetry: {
        sttLatencyMs: asrDuration,
        llmFirstTokenMs: 44,
        ttsLatencyMs: ttsDuration,
        networkRttMs: rivaAudioDuration,
        audioQualityScore: 4.88, // MOS Score
        vadSpeechDurationMs: 840,
      },
      audioWaveform: waveform,
      timestamp: new Date().toISOString(),
    };
  }
}

export const nvidiaVoicePipeline = new NvidiaVoicePipelineService();
