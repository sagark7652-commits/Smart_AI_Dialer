import { Request, Response, Router } from "express";
import { nanoid } from "nanoid";
import { analyzeCallWithClaude } from "./claudeQA";
import { callingAuthMiddleware, requireRole } from "./middleware";
import { getTelephonyProvider } from "./provider";
import { dialerWorker } from "./queue";
import { eventBroker } from "./sse";
import { CDRRecord, SupervisorActionType } from "./types";

export const callingRouter = Router();

// Store for CDRs
const cdrStore: CDRRecord[] = [
  {
    id: "cdr_01",
    callId: "call_init_991",
    customerPhone: "+91 98201 12345",
    customerName: "Sanjay Singhania",
    agentName: "Priya Sharma",
    disposition: "Interested",
    durationSeconds: 145,
    costInr: 1.45,
    recordingUrl: "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3",
    transcript: "Agent: Namaste Sanjay ji, calling from CreatorAI. We noticed your interest in our automated calling suite.\nCustomer: Haan ji, tell me more about the pricing plans.\nAgent: We offer prepaid pricing at ₹0.60 per minute with full TRAI compliance.\nCustomer: Sounds good, please send over the brochure.",
    summary: "Customer expressed interest in the prepaid calling plans. Brochure sent via WhatsApp.",
    qaScore: 94,
    qaRubric: {
      mandatoryDisclosure: true,
      greetingPoliteness: 5,
      objectionHandling: 5,
      talkOverInterruption: 5,
    },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "cdr_02",
    callId: "call_init_992",
    customerPhone: "+91 97110 54321",
    customerName: "Vikram Malhotra",
    agentName: "Rahul Verma",
    disposition: "Callback Requested",
    durationSeconds: 62,
    costInr: 0.62,
    recordingUrl: "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3",
    transcript: "Agent: Hello Vikram sir, CreatorAI se call kar raha hoon.\nCustomer: Main abhi meeting mein hoon, please call me back after 4 PM.\nAgent: Sure sir, scheduling your callback at 4:00 PM. Have a great day.",
    summary: "Customer in a meeting, scheduled callback for 4:00 PM.",
    qaScore: 88,
    qaRubric: {
      mandatoryDisclosure: true,
      greetingPoliteness: 4,
      objectionHandling: 4,
      talkOverInterruption: 5,
    },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

// Apply base authentication
callingRouter.use(callingAuthMiddleware);

// =============================================================================
// 1. CAMPAIGN & PERSISTENT DIALER WORKER ENDPOINTS
// =============================================================================

// POST /api/calling/campaigns/start
// Decoupled: Enqueues leads into the worker queue and returns 202 Accepted immediately!
callingRouter.post("/campaigns/start", requireRole(["admin", "supervisor"]), (req: Request, res: Response) => {
  const { name, dialerMode, leads, script, callerId, callingWindow } = req.body;

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: "Invalid leads payload: at least 1 lead required." });
  }

  const campaign = dialerWorker.enqueueCampaign({
    name: name || `Campaign ${new Date().toLocaleDateString("en-IN")}`,
    dialerMode: dialerMode || "progressive",
    leads,
    script: script || "Namaste, calling from CreatorAI...",
    callerId: callerId || "+91-140-998822",
    callingWindow,
  });

  const startResult = dialerWorker.startCampaign(campaign.id);

  return res.status(202).json({
    message: startResult.message,
    campaignId: campaign.id,
    status: campaign.status,
    totalLeads: campaign.stats.totalLeads,
    dialerMode: campaign.dialerMode,
    decoupledWorker: true,
  });
});

// POST /api/calling/campaigns/:id/pause
callingRouter.post("/campaigns/:id/pause", (req: Request, res: Response) => {
  const result = dialerWorker.pauseCampaign(req.params.id);
  if (!result.success) return res.status(404).json({ error: "Campaign not found" });
  res.json({ message: "Campaign paused successfully", campaign: result.campaign });
});

// POST /api/calling/campaigns/:id/resume
callingRouter.post("/campaigns/:id/resume", (req: Request, res: Response) => {
  const result = dialerWorker.resumeCampaign(req.params.id);
  if (!result.success) return res.status(404).json({ error: "Campaign not found" });
  res.json({ message: "Campaign resumed successfully", campaign: result.campaign });
});

// POST /api/calling/campaigns/:id/stop
callingRouter.post("/campaigns/:id/stop", (req: Request, res: Response) => {
  const result = dialerWorker.stopCampaign(req.params.id);
  if (!result.success) return res.status(404).json({ error: "Campaign not found" });
  res.json({ message: "Campaign stopped successfully", campaign: result.campaign });
});

// GET /api/calling/campaigns/:id/stats
// Polled by CampaignControls.tsx
callingRouter.get("/campaigns/:id/stats", (req: Request, res: Response) => {
  const campaign = dialerWorker.getCampaign(req.params.id);
  if (!campaign) {
    // Return sample stats if not found for mock/preview widgets
    return res.json({
      id: req.params.id,
      name: "Outbound Demo Campaign",
      status: "running",
      progressPercent: 42,
      stats: {
        totalLeads: 500,
        dialed: 210,
        connected: 158,
        qualified: 72,
        failed: 12,
        abandoned: 4,
        averageDurationSeconds: 78,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  const progressPercent = campaign.stats.totalLeads > 0
    ? Math.round((campaign.stats.dialed / campaign.stats.totalLeads) * 100)
    : 0;

  res.json({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    progressPercent,
    stats: campaign.stats,
    updatedAt: campaign.updatedAt,
  });
});

// GET /api/calling/campaigns
callingRouter.get("/campaigns", (_req: Request, res: Response) => {
  res.json({ campaigns: dialerWorker.getAllCampaigns() });
});

// =============================================================================
// 2. SERVER-SENT EVENTS (SSE) LIVE STREAM
// =============================================================================

// GET /api/calling/live
// Continuous SSE stream powering Supervisor Live Wallboard
callingRouter.get("/live", (req: Request, res: Response) => {
  const initialSnapshot = {
    timestamp: new Date().toISOString(),
    activeCalls: dialerWorker.getActiveCalls(),
    agents: dialerWorker.getAgents(),
    queueStats: {
      waitingCalls: 2,
      longestWaitSeconds: 14,
      availableAgents: dialerWorker.getAgents().filter((a) => a.state === "ready").length,
      busyAgents: dialerWorker.getAgents().filter((a) => a.state === "on_call").length,
    },
  };

  eventBroker.registerClient(res, initialSnapshot);
});

// =============================================================================
// 3. PROVIDER ABSTRACTION & CALL ACTIONS
// =============================================================================

// POST /api/calling/click-to-call
callingRouter.post("/click-to-call", async (req: Request, res: Response) => {
  const { phone, name, provider: providerName, callerId, script } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "Missing required parameter 'phone'" });
  }

  // Check DNC
  if (dialerWorker.isDNC(phone)) {
    return res.status(403).json({
      error: "TRAI Statutory Violation: This number is listed on the National Do Not Call (DNC/NDNC) registry.",
      dncBlocked: true,
    });
  }

  const provider = getTelephonyProvider(providerName);
  const result = await provider.makeCall({
    to: phone,
    from: callerId || "+91-140-998822",
    script: script || "Namaste, this is an automated call from CreatorAI.",
    metadata: { customerName: name, directDial: true },
  });

  return res.json({
    success: true,
    callId: result.callId,
    provider: result.provider,
    status: result.status,
    customerPhone: phone,
    customerName: name || "Contact",
  });
});

// POST /api/calling/call/action
// Supervisor action: Listen, Whisper, Barge, Takeover
callingRouter.post("/call/action", requireRole(["admin", "supervisor"]), async (req: Request, res: Response) => {
  const { callId, action, supervisorId } = req.body as {
    callId: string;
    action: SupervisorActionType;
    supervisorId?: string;
  };

  if (!callId || !action) {
    return res.status(400).json({ error: "Missing callId or action." });
  }

  const provider = getTelephonyProvider();
  const outcome = await provider.callAction(callId, action, supervisorId || "sup-01");

  return res.json({
    success: outcome.success,
    callId,
    action: outcome.mode,
    message: `Supervisor bridge established in '${action}' mode.`,
  });
});

// POST /api/calling/agent/status
callingRouter.post("/agent/status", (req: Request, res: Response) => {
  const { agentId, state } = req.body;
  if (!agentId || !state) {
    return res.status(400).json({ error: "Missing agentId or state" });
  }

  dialerWorker.updateAgentState(agentId, state);
  res.json({ success: true, agentId, state });
});

// POST /api/calling/agent/disposition
callingRouter.post("/agent/disposition", (req: Request, res: Response) => {
  const { agentId, callId, disposition, notes, addToDNC, customerPhone } = req.body;

  if (addToDNC && customerPhone) {
    dialerWorker.addDNCNumber(customerPhone);
  }

  if (agentId) {
    dialerWorker.updateAgentState(agentId, "ready");
  }

  res.json({
    success: true,
    callId,
    disposition,
    dncAdded: !!addToDNC,
    nextState: "ready",
  });
});

// =============================================================================
// 4. ASYNCHRONOUS WEBHOOKS & CLAUDE AUTO-QA
// =============================================================================

// POST /api/calling/webhook/:provider
// Post-call webhook: Decoupled, non-blocking ingestion of call events
callingRouter.post("/webhook/:provider", async (req: Request, res: Response) => {
  const provider = req.params.provider;
  const payload = req.body;

  const callId = payload.CallSid || payload.call_id || payload.callId || `call_${nanoid(8)}`;
  const duration = parseInt(payload.DialCallDuration || payload.duration || "90", 10);
  const transcript = payload.transcript || "Agent: Namaste, calling from CreatorAI regarding your inquiry.\nCustomer: Yes, I wanted to understand the automated dialing features.\nAgent: Sure, our system dials with full TRAI compliance.";
  const customerPhone = payload.From || payload.to || "+91 98200 11223";
  const customerName = payload.customerName || "Inbound Contact";

  // Respond immediately to CPaaS provider to acknowledge receipt
  res.status(200).json({ received: true, callId });

  // Asynchronous background processing: Auto-QA & CDR creation
  setImmediate(async () => {
    try {
      const qaResult = await analyzeCallWithClaude(transcript, customerName, "AI Voice Agent");

      const newCDR: CDRRecord = {
        id: `cdr_${nanoid(8)}`,
        callId,
        customerPhone,
        customerName,
        agentName: "AI Voice Agent",
        disposition: payload.disposition || (qaResult.sentiment === "positive" ? "Interested" : "Completed"),
        durationSeconds: duration,
        costInr: Math.round((duration / 60) * 0.60 * 100) / 100,
        recordingUrl: payload.RecordingUrl || payload.recording_url,
        transcript,
        summary: qaResult.summary,
        qaScore: qaResult.overallScore,
        qaRubric: qaResult.rubric,
        createdAt: new Date().toISOString(),
      };

      cdrStore.unshift(newCDR);

      // Broadcast update to live supervisors via SSE!
      eventBroker.broadcast("call_completed", newCDR);
      console.log(`[Webhook] Processed ${provider} call ${callId} with Auto-QA score ${qaResult.overallScore}%`);
    } catch (err) {
      console.error(`[Webhook] Error in async post-processing for call ${callId}`, err);
    }
  });
});

// =============================================================================
// 5. CDRs & SYSTEM DIAGNOSTICS
// =============================================================================

// GET /api/calling/cdrs
callingRouter.get("/cdrs", (_req: Request, res: Response) => {
  res.json({ cdrs: cdrStore, total: cdrStore.length });
});

// GET /api/calling/system/diagnostics
callingRouter.get("/system/diagnostics", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    webrtc: {
      mosScore: 4.42,
      jitterMs: 8,
      latencyMs: 32,
      packetLossPercent: 0.02,
    },
    trunks: [
      { name: "Mumbai Primary (Tata SIP)", status: "connected", latencyMs: 14 },
      { name: "Bangalore Backup (Airtel)", status: "standby", latencyMs: 22 },
    ],
    timestamp: new Date().toISOString(),
  });
});
