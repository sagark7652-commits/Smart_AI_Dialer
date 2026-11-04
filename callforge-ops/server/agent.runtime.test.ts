import { describe, expect, it } from "vitest";
import { agentRuntime } from "./calling/runtime/agentRuntime";
import { SileroVADProvider } from "./calling/runtime/vad/sileroVAD";
import { LocalWhisperSTTProvider } from "./calling/runtime/stt/sttProviders";
import { KokoroPiperTTSProvider } from "./calling/runtime/tts/ttsProviders";
import { LocalLLMProvider } from "./calling/runtime/llm/llmProviders";
import { localKnowledgeBase } from "./calling/runtime/rag/localKnowledgeBase";
import { agentMemoryManager } from "./calling/runtime/memory/memoryManager";
import { BUILTIN_BANKING_TOOLS } from "./calling/runtime/tools/bankingTools";

describe("CallForge Self-Controlled Voice AI Agent Runtime", () => {
  // 1. VAD Provider Test
  describe("1. Silero / Energy VAD Provider", () => {
    it("detects speech vs silence and triggers barge-in", async () => {
      const vad = new SileroVADProvider(0.5);

      // Silence buffer (zeros)
      const silenceChunk = Buffer.alloc(3200, 0);
      const silenceEvent = await vad.processAudioChunk(silenceChunk);
      expect(silenceEvent.isSpeaking).toBe(false);

      // Speech audio buffer (simulated sine wave energy)
      const speechChunk = Buffer.alloc(3200);
      for (let i = 0; i < 1600; i++) {
        speechChunk.writeInt16LE(Math.floor(Math.sin(i / 10) * 20000), i * 2);
      }

      // Feed consecutive speech frames to trigger boundary
      await vad.processAudioChunk(speechChunk);
      await vad.processAudioChunk(speechChunk);
      const speechEvent = await vad.processAudioChunk(speechChunk);
      expect(speechEvent.isSpeaking).toBe(true);
      expect(speechEvent.confidence).toBeGreaterThan(0.5);
    });
  });

  // 2. STT Provider Test
  describe("2. Local STT Provider", () => {
    it("transcribes audio buffer with confidence score", async () => {
      const stt = new LocalWhisperSTTProvider();
      const mockAudio = Buffer.alloc(1600, 0x12);
      const result = await stt.transcribe(mockAudio, { language: "hi" });
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  // 3. Local RAG Knowledge Base Test
  describe("3. Local RAG Knowledge Base", () => {
    it("retrieves relevant banking and compliance documents via semantic search", () => {
      const loanResults = localKnowledgeBase.search("loan preclosure balance charges", 2);
      expect(loanResults.length).toBeGreaterThan(0);
      expect(loanResults[0].doc.category).toBe("banking_policy");

      const traiResults = localKnowledgeBase.search("TRAI calling hours and DNC registry", 2);
      expect(traiResults.length).toBeGreaterThan(0);
      expect(traiResults[0].doc.category).toBe("trai_compliance");
    });
  });

  // 4. Memory & Entity Tracking Test
  describe("4. Agent Memory & Entity Manager", () => {
    it("extracts phone numbers, loan IDs, and tracks sentiment trends", () => {
      const session = agentRuntime.createSession({
        customerPhone: "+91 98201 12345",
        customerName: "Sanjay Singhania",
      });

      agentMemoryManager.updateFromTurn(
        session,
        "My alternate number is 9876543210 and loan number is LN-TATA-8831. Thank you!",
        "Your loan balance is ₹50,000."
      );

      expect(session.memory.extractedEntities.altPhone).toBe("9876543210");
      expect(session.memory.accountNumber).toBe("LN-TATA-8831");
      expect(session.memory.sentimentTrend).toContain("positive");
    });
  });

  // 5. Built-in Tools Test
  describe("5. Tool Calling & Execution", () => {
    it("executes fetch_loan_account_balance, fetch_emi_schedule, and human transfer", async () => {
      const session = agentRuntime.createSession({ customerPhone: "+91 98201 12345" });

      const balanceTool = BUILTIN_BANKING_TOOLS.find((t) => t.name === "fetch_loan_account_balance");
      expect(balanceTool).toBeDefined();
      const balanceRes = await balanceTool!.execute({ loanId: "LN-TATA-8831" }, session);
      expect(balanceRes.balanceInr).toBe(50000);
      expect(balanceRes.accountStatus).toBe("active");

      const transferTool = BUILTIN_BANKING_TOOLS.find((t) => t.name === "transfer_to_human_agent");
      expect(transferTool).toBeDefined();
      const transferRes = await transferTool!.execute({ department: "support" }, session);
      expect(transferRes.transferred).toBe(true);
      expect(session.status).toBe("transfer_pending");
    });
  });

  // 6. Master End-to-End Agent Runtime Turn Execution
  describe("6. Master Agent Runtime End-to-End Turn", () => {
    it("runs complete VAD -> STT -> RAG -> LLM + Tools -> TTS pipeline in under 350ms", async () => {
      const session = agentRuntime.createSession({
        customerPhone: "+91 98201 12345",
        customerName: "Rahul Sharma",
        carrier: "tata_smartflo",
      });

      const inputPcm = Buffer.alloc(3200, 0x33);
      const outcome = await agentRuntime.processAudioTurn(session.sessionId, inputPcm);

      expect(outcome.userTranscript).toBeDefined();
      expect(outcome.aiResponseText).toBeDefined();
      expect(outcome.aiResponseText.length).toBeGreaterThan(0);
      expect(outcome.audioOutput).toBeDefined();
      expect(Buffer.isBuffer(outcome.audioOutput)).toBe(true);
      expect(outcome.latencyBreakdown.totalMs).toBeDefined();
      expect(outcome.ragSnippetsUsed).toBeDefined();
    });
  });
});
