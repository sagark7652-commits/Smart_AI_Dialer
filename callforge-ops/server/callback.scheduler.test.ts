import { describe, it, expect, beforeEach } from "vitest";
import { parseCallbackIntent } from "./calling/runtime/callbackParser";
import { persistentStore } from "./storage/persistentStore";
import { dialerWorker } from "./calling/queue";

describe("CallForge Intelligent Callback Scheduler & Reminder System", () => {
  describe("1. Relative Time and Hinglish / English Intent Parsing", () => {
    it("correctly parses 'call me in next two days'", () => {
      const res = parseCallbackIntent("Please call me in next two days, I am busy right now");
      expect(res.isCallbackRequested).toBe(true);
      expect(res.delayMs).toBe(2 * 24 * 60 * 60 * 1000);
      const scheduledTime = new Date(res.scheduledAt).getTime();
      expect(scheduledTime).toBeGreaterThan(Date.now() + 1.9 * 24 * 60 * 60 * 1000);
    });

    it("correctly parses Hindi/Hinglish 'do din baad call karna'", () => {
      const res = parseCallbackIntent("Abhi meeting me hoon, do din baad phone karna");
      expect(res.isCallbackRequested).toBe(true);
      expect(res.delayMs).toBe(2 * 24 * 60 * 60 * 1000);
      expect(res.friendlyTextHi).toContain("2 din baad");
    });

    it("correctly parses 'after 3 days'", () => {
      const res = parseCallbackIntent("I am traveling, please call after 3 days");
      expect(res.isCallbackRequested).toBe(true);
      expect(res.delayMs).toBe(3 * 24 * 60 * 60 * 1000);
    });

    it("correctly parses 'kal call karo' (tomorrow)", () => {
      const res = parseCallbackIntent("Kal call karo 11 baje");
      expect(res.isCallbackRequested).toBe(true);
      expect(res.delayMs).toBe(24 * 60 * 60 * 1000);
    });

    it("defaults to 2 days for general busy indicators without explicit time", () => {
      const res = parseCallbackIntent("I am driving right now, call back later");
      expect(res.isCallbackRequested).toBe(true);
      expect(res.delayMs).toBe(2 * 24 * 60 * 60 * 1000);
    });

    it("returns false for non-callback conversations", () => {
      const res = parseCallbackIntent("Yes, I want to know more about the dental cleaning packages");
      expect(res.isCallbackRequested).toBe(false);
    });
  });

  describe("2. Persistent Store Callback Storage & Due Verification", () => {
    const testLeadPhone = "+919988776655";

    it("stores a scheduled callback and queries due items accurately", () => {
      // Add a callback due 1 second in the past
      const pastTime = new Date(Date.now() - 5000).toISOString();
      const cb = persistentStore.addScheduledCallback({
        customerPhone: testLeadPhone,
        customerName: "Ramesh Sharma",
        campaignId: "camp_dental_01",
        reason: "Customer requested callback in 2 days",
        scheduledAt: pastTime,
        retryCount: 0,
      });

      expect(cb.id).toBeDefined();
      expect(cb.status).toBe("pending");

      // Verify it is returned in due callbacks
      const due = persistentStore.getDueCallbacks();
      const found = due.find((c) => c.id === cb.id);
      expect(found).toBeDefined();
      expect(found?.customerPhone).toBe(testLeadPhone);

      // Mark completed
      persistentStore.markCallbackCompleted(cb.id);
      const afterCompleted = persistentStore.getDueCallbacks().find((c) => c.id === cb.id);
      expect(afterCompleted).toBeUndefined();
    });
  });
});
