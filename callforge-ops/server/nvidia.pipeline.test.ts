import { describe, expect, it } from "vitest";
import { nvidiaVoicePipeline } from "./calling/nvidiaVoicePipeline";
import { getTelephonyProvider, TataDialerProvider } from "./calling/provider";

describe("Tata Dialer + NVIDIA Voice Pipeline Stack Integration", () => {
  describe("NVIDIA Voice Pipeline Service (Nemotron ASR + Riva + Nemotron LLM + Riva Magpie TTS)", () => {
    it("reports healthy operational status with full 4-tier stack telemetry", () => {
      const status = nvidiaVoicePipeline.getStatus();
      expect(status.status).toBe("healthy");
      expect(status.stack.rivaAudioGateway.name).toContain("NVIDIA Riva");
      expect(status.stack.nemotronAsr.model).toBe("nemotron-asr-streaming");
      expect(status.stack.nemotronLlm.model).toBe("nemotron-4-340b-instruct");
      expect(status.stack.rivaMagpieTts.model).toBe("riva-magpie-multilingual-v1");
      expect(status.telephonyBridge.carrier).toContain("Tata Dialer");
    });

    it("executes the exact user loan balance voice flow end-to-end", async () => {
      // Flow:
      // Customer: "I want to know my loan balance."
      // STT output: "I want to know my loan balance."
      // Nemotron LLM reasoning: "Your current loan balance is ₹50,000."
      // Riva Magpie TTS: Natural multilingual speech output
      const result = await nvidiaVoicePipeline.simulatePipeline("I want to know my loan balance.");

      expect(result.id).toBeDefined();
      expect(result.query).toBe("I want to know my loan balance.");
      expect(result.finalSpeechText).toContain("₹50,000");

      // Verify all 4 discrete steps were executed
      expect(result.steps).toHaveLength(4);

      const [step1, step2, step3, step4] = result.steps;

      // 1. Audio Processing & VAD
      expect(step1.step).toBe("riva_audio");
      expect(step1.technology).toContain("Riva");
      expect(step1.durationMs).toBeGreaterThan(0);

      // 2. Speech-to-Text (Nemotron ASR)
      expect(step2.step).toBe("nemotron_asr");
      expect(step2.technology).toContain("Nemotron ASR");
      expect(step2.output).toContain("I want to know my loan balance.");

      // 3. Nemotron LLM & Business Logic
      expect(step3.step).toBe("nemotron_llm");
      expect(step3.technology).toContain("Nemotron");
      expect(step3.output).toContain("₹50,000");
      expect(step3.details?.businessLogic).toContain("fetch_loan_account_balance");

      // 4. Text-to-Speech (Riva Magpie TTS)
      expect(step4.step).toBe("riva_magpie_tts");
      expect(step4.technology).toContain("Magpie TTS");
      expect(step4.status).toBe("success");

      // Verify round-trip latency SLA (<350ms total)
      expect(result.totalDurationMs).toBeLessThan(350);
      expect(result.telemetry.sttLatencyMs).toBeGreaterThan(0);
      expect(result.telemetry.ttsLatencyMs).toBeGreaterThan(0);
      expect(result.audioWaveform).toBeDefined();
      expect(result.audioWaveform?.length).toBe(32);
    });

    it("handles alternative queries like EMI due date gracefully", async () => {
      const result = await nvidiaVoicePipeline.simulatePipeline("When is my next EMI due?");
      expect(result.finalSpeechText).toContain("EMI");
      expect(result.steps[2].details?.businessLogic).toContain("fetch_emi_schedule");
    });

    it("allows updating and retrieving configuration dynamically", () => {
      const initial = nvidiaVoicePipeline.getConfig();
      expect(initial.rivaAsrModel).toBe("nemotron-asr-streaming");

      const updated = nvidiaVoicePipeline.updateConfig({
        vadThreshold: 0.72,
        nemotronLlmModel: "llama-3.1-nemotron-70b",
      });

      expect(updated.vadThreshold).toBe(0.72);
      expect(updated.nemotronLlmModel).toBe("llama-3.1-nemotron-70b");

      // Reset back to default
      nvidiaVoicePipeline.updateConfig({
        vadThreshold: 0.65,
        nemotronLlmModel: "nemotron-4-340b-instruct",
      });
    });
  });

  describe("Tata Dialer Telephony Provider", () => {
    it("initializes TataDialerProvider and registers with carrier manager", () => {
      const provider = new TataDialerProvider();
      expect(provider.name).toBe("tata_smartflo");

      const fetchedByTata = getTelephonyProvider("tata");
      expect(fetchedByTata.name).toBe("tata_smartflo");

      const fetchedBySmartflo = getTelephonyProvider("tata_smartflo");
      expect(fetchedBySmartflo.name).toBe("tata_smartflo");
    });

    it("initiates a simulated Tata Dialer call with NVIDIA voice pipeline metadata", async () => {
      const provider = new TataDialerProvider();
      const callResult = await provider.makeCall({
        to: "+91 98201 12345",
        from: "+91 22 6600 1234",
        script: "I want to know my loan balance.",
      });

      expect(callResult.callId).toContain("tata_");
      expect(callResult.status).toBe("ringing");
      expect(callResult.rawResponse?.voiceStack).toContain("Nemotron");
    });

    it("terminates and gets status of Tata Smartflo call", async () => {
      const provider = new TataDialerProvider();
      const status = await provider.getCallStatus("tata_test_01");
      expect(status.status).toBe("in_progress");

      const term = await provider.terminateCall("tata_test_01");
      expect(term.success).toBe(true);
      expect(term.message).toContain("SIP BYE");
    });
  });
});
