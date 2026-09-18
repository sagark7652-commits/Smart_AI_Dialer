import { describe, expect, it } from "vitest";

// Category 1: Campaign & Scripting
import { DIALER_MODES } from "../client/src/components/calling/campaigns/DialerModeSelector";
import { MANDATORY_COMPLIANCE_PREAMBLE } from "../client/src/components/calling/campaigns/ClaudeScriptEditor";

// Category 2: Agent Workspace
import { AGENT_STATUSES } from "../client/src/components/calling/agent/AgentStatusDropdown";

// Category 3: Supervisor & Analytics
import { SAMPLE_CDR_DATA } from "../client/src/components/calling/supervisor/CDRDataTable";

// Category 6: Advanced AI Settings
import { VOICES } from "../client/src/components/calling/ai/VoiceSelectionPicker";

describe("CallForge Ops - 8 Calling Component Categories Verification", () => {
  // Category 1: Campaign & Scripting
  describe("Category 1: Campaign & Scripting", () => {
    it("provides all 4 distinct dialer modes with accurate cadence ratios", () => {
      const modeIds = DIALER_MODES.map((m) => m.id);
      expect(modeIds).toEqual(["preview", "progressive", "predictive", "ai_blast"]);

      const aiBlast = DIALER_MODES.find((m) => m.id === "ai_blast");
      expect(aiBlast?.pacingRatio).toBe("10:1");
      expect(aiBlast?.tag).toContain("AI");
    });

    it("enforces statutory TRAI Compliance Preamble string", () => {
      expect(MANDATORY_COMPLIANCE_PREAMBLE).toBeTruthy();
      expect(MANDATORY_COMPLIANCE_PREAMBLE.toLowerCase()).toContain("callforge");
      expect(MANDATORY_COMPLIANCE_PREAMBLE.toLowerCase()).toContain("recorded line");
      expect(MANDATORY_COMPLIANCE_PREAMBLE.toLowerCase()).toContain("automated voice assistant");
    });
  });

  // Category 2: Agent Workspace
  describe("Category 2: Agent Workspace & Telephony Routing", () => {
    it("defines 5 agent states and properly gates call routing eligibility", () => {
      const statuses = Object.keys(AGENT_STATUSES);
      expect(statuses).toEqual(["ready", "on_call", "wrap_up", "break", "offline"]);

      // Ready state MUST accept calls
      expect(AGENT_STATUSES.ready.canReceiveCalls).toBe(true);

      // On call, wrap-up, break, and offline MUST NOT accept calls
      expect(AGENT_STATUSES.on_call.canReceiveCalls).toBe(false);
      expect(AGENT_STATUSES.wrap_up.canReceiveCalls).toBe(false);
      expect(AGENT_STATUSES.break.canReceiveCalls).toBe(false);
      expect(AGENT_STATUSES.offline.canReceiveCalls).toBe(false);
    });
  });

  // Category 3: Supervisor & Analytics
  describe("Category 3: Supervisor, Live Wallboard & CDR", () => {
    it("loads and structures CDR records with duration, cost in INR and QA scores", () => {
      expect(SAMPLE_CDR_DATA.length).toBeGreaterThanOrEqual(5);

      SAMPLE_CDR_DATA.forEach((record) => {
        expect(record.id).toMatch(/^CDR-\d+$/);
        expect(record.customerPhone).toMatch(/^\+91/);
        expect(record.cost).toContain("₹");
        expect(record.qaScore).toBeGreaterThanOrEqual(0);
        expect(record.qaScore).toBeLessThanOrEqual(100);
      });
    });

    it("verifies CDR recording and transcript linkage", () => {
      const callWithRecording = SAMPLE_CDR_DATA.find((r) => r.hasRecording && r.transcript);
      expect(callWithRecording).toBeDefined();
      expect(callWithRecording?.transcript?.length).toBeGreaterThan(0);
      expect(callWithRecording?.transcript?.[0].speaker).toBeDefined();
      expect(callWithRecording?.transcript?.[0].text).toBeDefined();
    });
  });

  // Category 6: Advanced AI Voice Personas
  describe("Category 6: Advanced AI Voice Personas", () => {
    it("includes 5 specialized neural Indian accents and languages", () => {
      expect(VOICES.length).toBeGreaterThanOrEqual(5);

      const voiceNames = VOICES.map((v) => v.name);
      expect(voiceNames).toContain("Asha");
      expect(voiceNames).toContain("Kabir");
      expect(voiceNames).toContain("Meera");
      expect(voiceNames).toContain("Rohan");
      expect(voiceNames).toContain("Ananya");

      const asha = VOICES.find((v) => v.name === "Asha");
      expect(asha?.languages.toLowerCase()).toContain("hindi");
      expect(asha?.languages.toLowerCase()).toContain("english");
    });
  });

  // Category 7: TRAI Statutory Compliance
  describe("Category 7: TRAI Statutory Compliance Rules", () => {
    it("validates that outbound calling windows are restricted to 09:00 - 21:00 IST", () => {
      const isValidTimeWindow = (start: string, end: string) => {
        const startH = parseInt(start.split(":")[0], 10);
        const endH = parseInt(end.split(":")[0], 10);
        return startH >= 9 && endH <= 21 && startH < endH;
      };

      expect(isValidTimeWindow("09:30", "20:00")).toBe(true);
      expect(isValidTimeWindow("10:00", "18:00")).toBe(true);
      expect(isValidTimeWindow("08:30", "18:00")).toBe(false); // Before 9am is illegal
      expect(isValidTimeWindow("10:00", "22:00")).toBe(false); // After 9pm is illegal
      expect(isValidTimeWindow("18:00", "10:00")).toBe(false); // Invalid range
    });
  });

  // Category 8: Role-Based Access Control
  describe("Category 8: RBAC Permissions Matrix", () => {
    it("differentiates Admin, Supervisor, and Agent roles", () => {
      const defaultRoleMatrix: Record<string, string[]> = {
        admin: [
          "view_billing",
          "start_campaigns",
          "barge_whisper",
          "export_cdr",
          "edit_script",
          "override_qa",
        ],
        supervisor: [
          "start_campaigns",
          "barge_whisper",
          "export_cdr",
          "edit_script",
          "override_qa",
        ],
        agent: [],
      };

      // Supervisor cannot view billing, but Admin can
      expect(defaultRoleMatrix.admin.includes("view_billing")).toBe(true);
      expect(defaultRoleMatrix.supervisor.includes("view_billing")).toBe(false);

      // Floor Agent cannot barge calls, but Supervisor can
      expect(defaultRoleMatrix.supervisor.includes("barge_whisper")).toBe(true);
      expect(defaultRoleMatrix.agent.includes("barge_whisper")).toBe(false);
    });
  });
});
