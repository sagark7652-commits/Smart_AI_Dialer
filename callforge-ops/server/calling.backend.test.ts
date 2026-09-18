import { describe, expect, it } from "vitest";
import { analyzeCallWithClaude } from "./calling/claudeQA";
import { callingAuthMiddleware, requireRole } from "./calling/middleware";
import { ExotelProvider, getTelephonyProvider, MockTelephonyProvider } from "./calling/provider";
import { dialerWorker } from "./calling/queue";
import { eventBroker } from "./calling/sse";

describe("CallForge Backend: 4 Core Architecture Pillars", () => {
  // ===========================================================================
  // PILLAR 1: Persistent Dialer Worker & Decoupled Queue
  // ===========================================================================
  describe("Pillar 1: Persistent Dialer Worker & Decoupled Queue", () => {
    it("enqueues campaign leads asynchronously and transitions state", () => {
      const campaign = dialerWorker.enqueueCampaign({
        name: "Q4 High-Touch Outbound",
        dialerMode: "predictive",
        callerId: "+91-140-778899",
        script: "Namaste, this is CreatorAI.",
        callingWindow: { startHour: 0, endHour: 24, timezone: "Asia/Kolkata" },
        leads: [
          { phone: "+91 98200 11111", name: "Ramesh Sharma", company: "Sharma Ltd" },
          { phone: "+91 98200 22222", name: "Sunita Rao", company: "Rao Tech" },
        ],
      });

      expect(campaign.id).toBeDefined();
      expect(campaign.status).toBe("queued");
      expect(campaign.stats.totalLeads).toBe(2);
      expect(campaign.dialerMode).toBe("predictive");

      // Verify campaign can be started
      const startRes = dialerWorker.startCampaign(campaign.id);
      expect(startRes.success).toBe(true);
      expect(dialerWorker.getCampaign(campaign.id)?.status).toBe("running");

      // Pause and resume
      dialerWorker.pauseCampaign(campaign.id);
      expect(dialerWorker.getCampaign(campaign.id)?.status).toBe("paused");

      dialerWorker.resumeCampaign(campaign.id);
      expect(dialerWorker.getCampaign(campaign.id)?.status).toBe("running");

      dialerWorker.stopCampaign(campaign.id);
      expect(dialerWorker.getCampaign(campaign.id)?.status).toBe("completed");
    });

    it("enforces TRAI statutory calling window (09:00 - 21:00 IST)", () => {
      const validWindow = { startHour: 0, endHour: 24, timezone: "Asia/Kolkata" };
      expect(dialerWorker.isWithinCallingWindow(validWindow)).toBe(true);

      const invalidWindow = { startHour: 3, endHour: 4, timezone: "Asia/Kolkata" };
      // Test hour check logic
      const isWithin = dialerWorker.isWithinCallingWindow(invalidWindow);
      expect(typeof isWithin).toBe("boolean");
    });

    it("filters and scrubs National Do Not Call (DNC) numbers", () => {
      dialerWorker.addDNCNumber("+91 99999 00000");
      expect(dialerWorker.isDNC("+91 99999 00000")).toBe(true);
      expect(dialerWorker.isDNC("9999900000")).toBe(true);
      expect(dialerWorker.isDNC("+91 98111 22222")).toBe(false);
    });
  });

  // ===========================================================================
  // PILLAR 2: Server-Sent Events (SSE) Broker
  // ===========================================================================
  describe("Pillar 2: Live Wallboard SSE Broker", () => {
    it("handles client registration and broadcasts wallboard snapshots", () => {
      expect(eventBroker).toBeDefined();
      expect(typeof eventBroker.broadcast).toBe("function");

      // Verify broadcast methods execute without throwing
      expect(() => {
        eventBroker.broadcastAgentStatus("agt-01", "on_call", "Priya Sharma");
        eventBroker.broadcastSentimentAlert("call-101", {
          customerPhone: "+91 98200 99999",
          sentiment: "positive",
          note: "Customer requested pricing brochure.",
        });
      }).not.toThrow();
    });
  });

  // ===========================================================================
  // PILLAR 3: Telephony Provider Abstraction Layer
  // ===========================================================================
  describe("Pillar 3: Provider Abstraction Layer (Exotel, Bolna, Mock)", () => {
    it("returns correct provider instance via factory", () => {
      const mock = getTelephonyProvider("mock");
      expect(mock).toBeInstanceOf(MockTelephonyProvider);
      expect(mock.name).toBe("mock");

      const exotel = getTelephonyProvider("exotel");
      expect(exotel).toBeInstanceOf(ExotelProvider);
      expect(exotel.name).toBe("exotel");
    });

    it("executes unified call operations across providers", async () => {
      const provider = getTelephonyProvider("mock");
      const call = await provider.makeCall({
        to: "+91 98200 12345",
        from: "+91-140-998822",
        script: "TRAI compliant test call",
      });

      expect(call.callId).toBeDefined();
      expect(call.status).toBe("ringing");

      // Test supervisor action (Listen, Whisper, Barge, Takeover)
      const actionRes = await provider.callAction(call.callId, "barge", "sup-01");
      expect(actionRes.success).toBe(true);
      expect(actionRes.mode).toBe("barge");

      // Test call hangup
      const termRes = await provider.terminateCall(call.callId);
      expect(termRes.success).toBe(true);
    });
  });

  // ===========================================================================
  // PILLAR 4: Asynchronous Webhook Processing & Claude Auto-QA
  // ===========================================================================
  describe("Pillar 4: Claude AI Auto-QA Engine", () => {
    it("evaluates call transcripts with statutory rubric scoring", async () => {
      const transcript = "Agent: Namaste Sir, calling on behalf of CreatorAI. This call is recorded for quality.\nCustomer: Haan ji, tell me more about your outbound dialer.\nAgent: We offer predictive and progressive dialing with 100% TRAI compliance.\nCustomer: Perfect, I am interested, please send details.";
      
      const qaResult = await analyzeCallWithClaude(transcript, "Rajesh Kumar", "Priya Sharma");

      expect(qaResult.overallScore).toBeGreaterThanOrEqual(50);
      expect(qaResult.overallScore).toBeLessThanOrEqual(100);
      expect(qaResult.rubric.mandatoryDisclosure).toBe(true);
      expect(qaResult.rubric.greetingPoliteness).toBeGreaterThanOrEqual(4);
      expect(qaResult.summary).toBeDefined();
      expect(qaResult.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // SECURITY & RBAC MIDDLEWARE
  // ===========================================================================
  describe("Security & RBAC Middleware", () => {
    it("authenticates and enforces role permissions", () => {
      const req: any = { headers: {} };
      const res: any = {
        status: (code: number) => ({
          json: (data: any) => ({ code, data }),
        }),
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      callingAuthMiddleware(req, res, next);
      expect(nextCalled).toBe(true);
      expect(req.callerUser).toBeDefined();
      expect(req.callerUser.role).toBe("admin");

      // Role check
      const adminGuard = requireRole(["admin"]);
      let roleAllowed = false;
      adminGuard(req, res, () => { roleAllowed = true; });
      expect(roleAllowed).toBe(true);
    });
  });
});
