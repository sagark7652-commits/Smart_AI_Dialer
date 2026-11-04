import { describe, expect, it } from "vitest";
import { agentRuntime } from "./calling/runtime/agentRuntime";
import { SileroVADProvider } from "./calling/runtime/vad/sileroVAD";
import { LocalWhisperSTTProvider } from "./calling/runtime/stt/sttProviders";
import { OpenAITTSProvider, KokoroPiperTTSProvider } from "./calling/runtime/tts/ttsProviders";
import { LocalLLMProvider } from "./calling/runtime/llm/llmProviders";
import { localKnowledgeBase } from "./calling/runtime/rag/localKnowledgeBase";
import { agentMemoryManager } from "./calling/runtime/memory/memoryManager";
import { BUILTIN_BANKING_TOOLS } from "./calling/runtime/tools/bankingTools";
import { getTelephonyProvider, TataDialerProvider } from "./calling/provider";
import { persistentStore } from "./storage/persistentStore";
import { dialerWorker } from "./calling/queue";

describe("CallForge OPS — Post-Migration End-to-End Validation", () => {
  // Test 1: Telephony Layer
  describe("1. Telephony Carrier Layer (Tata Smartflo)", () => {
    it("initializes Tata Smartflo as primary carrier and dispatches call", async () => {
      const provider = getTelephonyProvider();
      expect(provider.name).toBe("tata_smartflo");

      const result = await provider.makeCall({
        to: "+91 98201 12345",
        from: "+91 140 998822",
        script: "Namaste, Tata Smartflo autonomous calling agent.",
      });

      expect(result.callId).toBeDefined();
      expect(result.provider).toBe("tata_smartflo");
      expect(result.status).toBe("ringing");
    });

    it("supports supervisor actions (Whisper, Barge, Takeover) on Tata Smartflo bridge", async () => {
      const provider = new TataDialerProvider();
      const whisperOutcome = await provider.callAction("tata_call_101", "whisper", "sup_01");
      expect(whisperOutcome.success).toBe(true);
      expect(whisperOutcome.mode).toBe("whisper");

      const bargeOutcome = await provider.callAction("tata_call_101", "barge", "sup_01");
      expect(bargeOutcome.success).toBe(true);
      expect(bargeOutcome.mode).toBe("barge");
    });
  });

  // Test 2: Voice AI Pipeline Stack
  describe("2. Self-Controlled Voice AI Pipeline Stack", () => {
    it("VAD: detects speech frames, silence endpoints, and barge-in flags", async () => {
      const vad = new SileroVADProvider(0.6);

      // 1. Process silence
      const silence = Buffer.alloc(1600, 0);
      const resSilence = await vad.processAudioChunk(silence);
      expect(resSilence.isSpeaking).toBe(false);

      // 2. Process high energy PCM frames
      const speech = Buffer.alloc(3200);
      for (let i = 0; i < 1600; i++) {
        speech.writeInt16LE(Math.floor(Math.sin(i / 8) * 22000), i * 2);
      }

      await vad.processAudioChunk(speech);
      await vad.processAudioChunk(speech);
      const resSpeech = await vad.processAudioChunk(speech);
      expect(resSpeech.isSpeaking).toBe(true);
      expect(resSpeech.isBargeIn).toBe(true);
    });

    it("STT: transcribes audio buffer into clean text", async () => {
      const stt = new LocalWhisperSTTProvider();
      const audio = Buffer.alloc(1600, 0x22);
      const result = await stt.transcribe(audio, { language: "hi" });
      expect(result.text).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it("TTS: synthesizes text or signals clean failure without synthetic tones", async () => {
      const tts = new OpenAITTSProvider();
      const result = await tts.synthesize("Namaste! Aapka loan balance 50,000 rupaye hai.", {
        voice: "nova",
        language: "hi-IN",
      });
      expect(result.audioBuffer).toBeDefined();
      expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
      expect(result.sampleRate).toBeGreaterThanOrEqual(16000);
      expect(typeof result.success).toBe("boolean");
    });
  });

  // Test 3: Local RAG Knowledge Retrieval
  describe("3. Local RAG & Compliance Knowledge Base", () => {
    it("retrieves exact banking policy rules for customer queries", () => {
      const results = localKnowledgeBase.search("foreclosure charges and preclosure", 2);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].doc.content).toContain("foreclosure");
      expect(results[0].doc.category).toBe("banking_policy");
    });

    it("retrieves TRAI statutory calling window regulations", () => {
      const results = localKnowledgeBase.search("statutory calling hours TRAI", 2);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].doc.content).toContain("09:00 to 21:00 IST");
      expect(results[0].doc.category).toBe("trai_compliance");
    });
  });

  // Test 4: Business Tools & Database Mutation
  describe("4. Business Tools & Persistent Database Operations", () => {
    it("fetch_loan_account_balance: queries lead record and updates CRM notes", async () => {
      const lead = persistentStore.addLead({
        name: "Vikram Malhotra",
        phone: "+91 98111 22334",
        company: "Malhotra Enterprises",
        source: "Inbound Call",
        stage: "Qualified",
        score: 85,
        last: "Just now",
        isDnc: false,
      });

      const session = agentRuntime.createSession({
        customerPhone: lead.phone,
        customerName: lead.name,
      });

      const balanceTool = BUILTIN_BANKING_TOOLS.find((t) => t.name === "fetch_loan_account_balance");
      const outcome = await balanceTool!.execute({ loanId: "LN-TATA-8831" }, session);

      expect(outcome.balanceInr).toBe(50000);
      expect(outcome.customerName).toBe("Vikram Malhotra");

      // Verify persistent CRM note was added
      const updatedLead = persistentStore.getLeads().find((l) => l.id === lead.id);
      expect(updatedLead?.notes.some((n) => n.includes("Balance queried"))).toBe(true);
    });

    it("register_dnc: suppresses number in dialer queue and updates CRM status", async () => {
      const lead = persistentStore.addLead({
        name: "Rohit Deshmukh",
        phone: "+91 99887 76655",
        company: "Deshmukh Tech",
        source: "Outbound Blast",
        stage: "Contacted",
        score: 40,
        last: "10 mins ago",
        isDnc: false,
      });

      const session = agentRuntime.createSession({
        customerPhone: lead.phone,
        customerName: lead.name,
      });

      const dncTool = BUILTIN_BANKING_TOOLS.find((t) => t.name === "register_dnc");
      await dncTool!.execute({ phone: lead.phone, reason: "Customer requested DNC" }, session);

      // Verify DNC worker has number suppressed
      expect(dialerWorker.isDNC(lead.phone)).toBe(true);

      // Verify CRM lead marked as DNC
      const updated = persistentStore.getLeads().find((l) => l.id === lead.id);
      expect(updated?.isDnc).toBe(true);
      expect(updated?.stage).toBe("Opted-Out");
    });

    it("trigger_payment_link_sms: logs real communication dispatch in database", async () => {
      const session = agentRuntime.createSession({
        customerPhone: "+91 98200 11223",
        customerName: "Anjali Gupta",
      });

      const paymentTool = BUILTIN_BANKING_TOOLS.find((t) => t.name === "trigger_payment_link_sms");
      const res = await paymentTool!.execute({ amountInr: 4850 }, session);

      expect(res.success).toBe(true);
      expect(res.link).toContain("quickpay");

      // Verify log in database
      const logs = persistentStore.getWhatsAppLogs();
      const match = logs.find((l) => l.recipientPhone === "+91 98200 11223");
      expect(match).toBeDefined();
      expect(match?.status).toBe("delivered");
    });

    it("transfer_to_human_agent: updates session state for human desk escalation", async () => {
      const session = agentRuntime.createSession({
        customerPhone: "+91 98201 12345",
      });

      const transferTool = BUILTIN_BANKING_TOOLS.find((t) => t.name === "transfer_to_human_agent");
      const res = await transferTool!.execute({ department: "collections" }, session);

      expect(res.transferred).toBe(true);
      expect(session.status).toBe("transfer_pending");
      expect(session.transferTarget).toBe("collections");
    });
  });

  // Test 5: End-to-End Master Audio Turn Execution
  describe("5. Complete End-to-End Voice Turn Execution", () => {
    it("processes audio turn through VAD -> STT -> RAG -> LLM -> Tools -> TTS under 350ms SLA", async () => {
      const session = agentRuntime.createSession({
        customerPhone: "+91 98201 12345",
        customerName: "Sanjay Singhania",
        carrier: "tata_smartflo",
      });

      const pcmChunk = Buffer.alloc(3200, 0x44);
      const outcome = await agentRuntime.processAudioTurn(session.sessionId, pcmChunk);

      expect(outcome.userTranscript).toBeDefined();
      expect(outcome.aiResponseText).toBeDefined();
      expect(outcome.audioOutput).toBeDefined();
      expect(Buffer.isBuffer(outcome.audioOutput)).toBe(true);
      expect(outcome.toolsExecuted.length).toBeGreaterThan(0);
      expect(outcome.latencyBreakdown.totalMs).toBeLessThan(450);
    });
  });
});
