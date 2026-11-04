import { describe, it, expect } from "vitest";
import { agentRuntime, SWIFTTEL_5G_PERSONA, PRIYA_AAROGYA_PERSONA } from "./calling/runtime/agentRuntime";
import { persistentStore } from "./storage/persistentStore";

describe("Real-Time Context-Aware Conversational AI Voice Agent E2E Tests", () => {
  describe("1. SwiftTel 5G Multi-Turn Promotional Telecalling Benchmark", () => {
    it("conducts the complete human-like conversation with memory, price inquiry, WhatsApp delivery, and callback", async () => {
      // Create session
      const session = agentRuntime.createSession({
        customerName: "Rajesh Varma",
        customerPhone: "+91 98201 55432",
        language: "en-IN",
        persona: SWIFTTEL_5G_PERSONA,
      });

      expect(session.sessionId).toBeDefined();
      const initialGreeting = session.messages.find((m) => m.role === "assistant")?.content;
      expect(initialGreeting).toContain("Simran");
      expect(initialGreeting).toContain("SwiftTel 5G");

      // Turn 1: Customer asks to explain the plan
      const turn1 = await agentRuntime.processTextTurn(
        session.sessionId,
        "Yes, tell me about the plan",
        { language: "en-IN" }
      );
      expect(turn1.aiResponseText).toBeDefined();
      expect(turn1.aiResponseText.length).toBeGreaterThan(10);
      expect(turn1.shouldEndCall).toBe(false);

      // Turn 2: Customer asks about the price
      const turn2 = await agentRuntime.processTextTurn(
        session.sessionId,
        "What is the price?",
        { language: "en-IN" }
      );
      expect(turn2.aiResponseText).toMatch(/(1,999|1999|annual)/i);

      // Turn 3: Customer asks to send details via WhatsApp
      const turn3 = await agentRuntime.processTextTurn(
        session.sessionId,
        "Can you send me the details through WhatsApp?",
        { language: "en-IN" }
      );
      // Verify tool execution
      const sendTool = turn3.toolsExecuted.find((t) => t.name === "send_plan_details");
      expect(sendTool).toBeDefined();
      expect(sendTool?.result?.channel).toBe("whatsapp");

      // Turn 4: Customer asks to call back in next two days
      const turn4 = await agentRuntime.processTextTurn(
        session.sessionId,
        "I am driving right now, please call me in next two days",
        { language: "en-IN" }
      );
      const cbTool = turn4.toolsExecuted.find((t) => t.name === "schedule_callback");
      expect(cbTool).toBeDefined();
      expect(cbTool?.result?.success).toBe(true);
      expect(turn4.intent).toBe("callback_scheduled");
    });
  });

  describe("2. Aarogya Dental Care Multi-Turn Clinic Booking Benchmark", () => {
    it("handles dental procedures, Dr. Sharma appointments, and callback scheduling", async () => {
      const session = agentRuntime.createSession({
        customerName: "Anita Joshi",
        customerPhone: "+91 98765 43210",
        language: "hi-IN",
        persona: PRIYA_AAROGYA_PERSONA,
      });

      // Turn 1: Inquiry about teeth cleaning & RCT
      const turn1 = await agentRuntime.processTextTurn(
        session.sessionId,
        "Teeth cleaning aur root canal ka kitna charge hai?",
        { language: "hi-IN" }
      );
      expect(turn1.aiResponseText).toMatch(/(1,200|1200|3,500|3500|cleaning|root canal)/i);

      // Turn 2: Booking appointment with Dr. Sharma
      const turn2 = await agentRuntime.processTextTurn(
        session.sessionId,
        "Dr. Sharma ke paas appointment book kar dijiye kal subah 10:30 baje",
        { language: "hi-IN" }
      );
      expect(turn2.aiResponseText).toBeDefined();

      // Turn 3: Callback request
      const turn3 = await agentRuntime.processTextTurn(
        session.sessionId,
        "Theek hai, kal 11 baje call karna",
        { language: "hi-IN" }
      );
      const cbTool = turn3.toolsExecuted.find((t) => t.name === "schedule_callback");
      expect(cbTool).toBeDefined();
    });
  });

  describe("3. Marathi Language Telecalling Support (मराठी)", () => {
    it("processes Marathi turn and generates fluent Marathi responses", async () => {
      const session = agentRuntime.createSession({
        customerName: "Sachin Kulkarni",
        customerPhone: "+91 99223 34455",
        language: "mr-IN",
        persona: SWIFTTEL_5G_PERSONA,
      });

      const turn = await agentRuntime.processTextTurn(
        session.sessionId,
        "५G वार्षिक प्लॅन ची किंमत किती आहे?",
        { language: "mr-IN" }
      );
      expect(turn.language).toBe("mr-IN");
      expect(turn.aiResponseText).toBeDefined();
      expect(turn.aiResponseText.length).toBeGreaterThan(5);
    });
  });

  describe("4. Operational DTMF Keypad Actions", () => {
    it("triggers plan confirmation when DTMF 1 is pressed", async () => {
      const session = agentRuntime.createSession({
        customerName: "Sunil Patil",
        customerPhone: "+91 98111 22233",
        language: "en-IN",
        persona: SWIFTTEL_5G_PERSONA,
      });

      const res = await agentRuntime.processTextTurn(session.sessionId, "", {
        dtmfDigit: "1",
        language: "en-IN",
      });

      expect(res.intent).toBe("dtmf_confirmed");
      const confirmTool = res.toolsExecuted.find((t) => t.name === "confirm_plan_activation");
      expect(confirmTool).toBeDefined();
      expect(confirmTool?.result?.success).toBe(true);
    });

    it("triggers 2-day callback when DTMF 2 is pressed", async () => {
      const session = agentRuntime.createSession({
        customerName: "Sunil Patil",
        customerPhone: "+91 98111 22233",
        language: "hi-IN",
        persona: SWIFTTEL_5G_PERSONA,
      });

      const res = await agentRuntime.processTextTurn(session.sessionId, "", {
        dtmfDigit: "2",
        language: "hi-IN",
      });

      expect(res.intent).toBe("dtmf_callback");
      const cbTool = res.toolsExecuted.find((t) => t.name === "schedule_callback");
      expect(cbTool).toBeDefined();
    });

    it("triggers human agent transfer when DTMF 9 is pressed", async () => {
      const session = agentRuntime.createSession({
        customerName: "Sunil Patil",
        customerPhone: "+91 98111 22233",
        language: "hi-IN",
        persona: SWIFTTEL_5G_PERSONA,
      });

      const res = await agentRuntime.processTextTurn(session.sessionId, "", {
        dtmfDigit: "9",
        language: "hi-IN",
      });

      expect(res.intent).toBe("dtmf_transfer");
      expect(session.status).toBe("transfer_pending");
      expect(session.transferTarget).toBe("senior_specialist");
    });
  });
});
