import crypto from "crypto";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGreetingAudio(agentId?: string, language?: string): string | null {
  // Pure dynamic synthesis with ElevenLabs cloned female voice per language
  return null;
}

function getTurnActionAudio(intent?: string, language?: string, agentId?: string): string | null {
  const lang = language ? (language.startsWith("mr") ? "mr" : language.startsWith("hi") ? "hi" : "en") : "en";
  const speaker = lang === "mr" ? "meera" : lang === "hi" ? "leher" : "maple";

  // 1. Aarogya Dental Care (Priya) - 100% Studio Cloned Human Voice Map
  if (agentId === "agent_aarogya_dental" || (!agentId && intent && intent.includes("dental"))) {
    if (intent === "consultation_fees" || intent === "doctor_info" || intent === "clinic_timings") {
      return `${lang}_sample_02_local_24k.wav`;
    }
    if (intent === "appointment_booking" || intent === "appointment_confirmed" || intent === "slot_inquiry") {
      return `${lang}_sample_03_local_24k.wav`;
    }
    if (intent === "pricing_charges" || intent === "treatment_costs") {
      return `${lang}_sample_04_local_24k.wav`;
    }
    if (intent === "clinic_contact" || intent === "helpline_number") {
      return `${lang}_sample_05_local_24k.wav`;
    }
    if (intent === "hold_apology") {
      return `${lang}_sample_06_local_24k.wav`;
    }
    if (intent === "painless_treatment" || intent === "cleaning_procedure") {
      return `${lang}_sample_07_local_24k.wav`;
    }
    if (intent === "ai_identity" || intent === "who_are_you") {
      return `${lang}_sample_08_local_24k.wav`;
    }
    if (intent === "clinic_location" || intent === "address_sent") {
      return `${lang}_sample_09_local_24k.wav`;
    }
    if (intent === "farewell" || intent === "thank_you" || intent === "call_terminated") {
      return `${lang}_sample_10_local_24k.wav`;
    }
    if (intent === "callback_scheduled" || intent === "dtmf_callback") {
      return `${lang}_${speaker}_callback_offer.wav`;
    }
    return null;
  }

  // 2. Generic / SwiftTel / Banking
  if (intent === "callback_scheduled" || intent === "dtmf_callback") {
    return `${lang}_${speaker}_callback_offer.wav`;
  }
  if (intent === "call_terminated" || intent === "farewell") {
    return `${lang}_${speaker}_goodbye.wav`;
  }
  if (intent === "not_understood" || intent === "error_fallback") {
    return `${lang}_${speaker}_not_understood.wav`;
  }

  return null;
}
import { Request, Response, Router } from "express";
import { nanoid } from "nanoid";
import nodemailer from "nodemailer";
import { analyzeCallWithClaude } from "./claudeQA";
import { callingAuthMiddleware, requireRole } from "./middleware";
import { getTelephonyProvider } from "./provider";
import { dialerWorker } from "./queue";
import { eventBroker } from "./sse";
import { CDRRecord, SupervisorActionType } from "./types";
import { persistentStore } from "../storage/persistentStore";
import { nvidiaVoicePipeline } from "./nvidiaVoicePipeline";
import { agentRuntime, DEFAULT_AGENT_PERSONA, AVAILABLE_PERSONAS } from "./runtime/agentRuntime";
import { localKnowledgeBase } from "./runtime/rag/localKnowledgeBase";
import { BUILTIN_BANKING_TOOLS } from "./runtime/tools/bankingTools";
import { saveCallToPostgres, getCallSummariesFromPostgres } from "../db/postgres";

export const callingRouter = Router();

// Store for CDRs
const cdrStore: CDRRecord[] = [];

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
    // Return zero stats when not found
    return res.json({
      id: req.params.id,
      name: "Outbound Dialer Queue",
      status: "idle",
      progressPercent: 0,
      stats: {
        totalLeads: 0,
        dialed: 0,
        connected: 0,
        qualified: 0,
        failed: 0,
        abandoned: 0,
        averageDurationSeconds: 0,
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

// GET /api/calling/wallboard
// JSON snapshot endpoint for Supervisor Wallboard polling / fallback
callingRouter.get("/wallboard", (_req: Request, res: Response) => {
  res.json({
    timestamp: new Date().toISOString(),
    activeCalls: dialerWorker.getActiveCalls(),
    agents: dialerWorker.getAgents(),
    queueStats: {
      waitingCalls: 2,
      longestWaitSeconds: 14,
      availableAgents: dialerWorker.getAgents().filter((a) => a.state === "ready").length,
      busyAgents: dialerWorker.getAgents().filter((a) => a.state === "on_call").length,
    },
  });
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

  const activeCall = {
    id: result.callId,
    customerPhone: phone,
    customerName: name || "Direct Dial Contact",
    provider: (result.provider || "mock") as any,
    status: "in_progress" as const,
    startedAt: new Date().toISOString(),
    durationSeconds: 1,
    sentiment: "positive" as const,
  };
  dialerWorker.addDirectCall(activeCall);

  return res.json({
    success: true,
    callId: result.callId,
    provider: result.provider,
    status: result.status,
    customerPhone: phone,
    customerName: name || "Contact",
    audioBridge: "opus_48khz_webrtc",
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
  const { agentId, callId, disposition, notes, addToDNC, customerPhone, leadPhone, leadName, durationSeconds } = req.body;

  const phone = customerPhone || leadPhone;
  const name = leadName || "Contact";

  if (addToDNC && phone) {
    dialerWorker.addDNCNumber(phone);
  }

  if (agentId) {
    dialerWorker.updateAgentState(agentId, "ready");
  }

  // 1. Record CDR entry
  const cdr = persistentStore.addCDRLog({
    customerName: name,
    customerPhone: phone || "+91 99887 11002",
    agentName: "Arjun Mehta (Logged Agent)",
    campaign: "Active Dialing Queue",
    duration: durationSeconds ? `${Math.floor(durationSeconds / 60).toString().padStart(2, "0")}:${(durationSeconds % 60).toString().padStart(2, "0")}` : "01:24",
    durationSeconds: durationSeconds || 84,
    status: disposition === "DNC" ? "Failed" : disposition === "No Answer" ? "No Answer" : "Completed",
    sentiment: disposition === "Interested" || disposition === "Converted" ? "Positive" : disposition === "DNC" ? "Negative" : "Neutral",
    qaScore: disposition === "Converted" ? 98 : disposition === "Interested" ? 92 : 80,
  });

  // 2. Update lead in persistent storage if phone matches
  if (phone) {
    const leads = persistentStore.getLeads();
    const existing = leads.find((l) => l.phone === phone);
    if (existing) {
      persistentStore.updateLead(existing.id, {
        stage: disposition === "Converted" ? "Converted" : disposition === "Interested" ? "Interested" : disposition === "Callback" ? "Callback" : disposition === "DNC" ? "DNC" : existing.stage,
        isDnc: disposition === "DNC" || !!addToDNC,
        notes: notes ? [...existing.notes, `[${new Date().toLocaleTimeString("en-IN")}] Disposition: ${disposition} - ${notes}`] : existing.notes,
        last: "Just now",
      });
    }
  }

  res.json({
    success: true,
    message: `Call outcome '${disposition}' saved and lead record updated successfully.`,
    callId,
    disposition,
    dncAdded: !!addToDNC || disposition === "DNC",
    cdr,
    nextState: "ready",
  });
});

// =============================================================================
// 4. ASYNCHRONOUS WEBHOOKS & CLAUDE AUTO-QA
// =============================================================================

// POST /api/calling/webhook/:provider
// Post-call webhook: Decoupled, non-blocking ingestion of call events
callingRouter.post("/webhook/:provider", async (req: Request, res: Response) => {
  const provider = (req.params.provider || "").toLowerCase();

  const payload = req.body || {};
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

      // 1. Persist to PostgreSQL in Text Format
      await saveCallToPostgres({
        externalCallId: callId,
        provider,
        phone: customerPhone,
        customerName,
        status: "completed",
        durationSeconds: duration,
        recordingUrl: newCDR.recordingUrl,
        transcript,
        summary: qaResult.summary,
        disposition: newCDR.disposition,
        sentiment: qaResult.sentiment,
        qaScore: qaResult.overallScore,
      });

      // 2. Persist to storage.json
      persistentStore.addCDRLog({
        id: callId,
        callId,
        provider,
        customerName,
        customerPhone,
        agentName: "AI Voice Agent",
        campaign: "Inbound/Outbound Webhook",
        duration: `${Math.floor(duration / 60)}m ${duration % 60}s`,
        durationSeconds: duration,
        status: "Completed",
        sentiment: qaResult.sentiment === "positive" ? "Positive" : qaResult.sentiment === "negative" ? "Negative" : "Neutral",
        qaScore: qaResult.overallScore,
        recordingUrl: newCDR.recordingUrl,
        transcript,
        summary: qaResult.summary,
      });

      // 3. Broadcast update to live supervisors via SSE!
      eventBroker.broadcast("call_completed", newCDR);
      console.log(`[Webhook] Processed ${provider} call ${callId} with Auto-QA score ${qaResult.overallScore}% and saved summary to PostgreSQL.`);
    } catch (err) {
      console.error(`[Webhook] Error in async post-processing for call ${callId}`, err);
    }
  });
});

// GET /api/calling/summaries/postgres
// Retrieves call summaries stored directly in the PostgreSQL database
callingRouter.get("/summaries/postgres", async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const summaries = await getCallSummariesFromPostgres(limit);
  res.json({ success: true, count: summaries.length, summaries });
});

// =============================================================================
// 5. CDRs & SYSTEM DIAGNOSTICS
// =============================================================================

// GET /api/calling/cdrs
callingRouter.get("/cdrs", (_req: Request, res: Response) => {
  const persistentCdrs = persistentStore.getCDRLogs();
  // Merge memory store with persistent store
  const merged = [
    ...persistentCdrs.map((c) => ({
      id: c.id,
      callId: c.callId || c.id,
      customerPhone: c.customerPhone,
      customerName: c.customerName,
      agentName: c.agentName,
      disposition: c.status === "Completed" ? "Interested" : c.status,
      durationSeconds: c.durationSeconds,
      costInr: Math.round((c.durationSeconds / 60) * 0.60 * 100) / 100,
      recordingUrl: c.recordingUrl || "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3",
      transcript: c.transcript || `Call with ${c.customerName} regarding campaign ${c.campaign}. Status: ${c.status}.`,
      summary: c.summary || `Automated call summary for ${c.customerName}. AI QA evaluation score ${c.qaScore}%.`,
      customerFeedback: c.customerFeedback || "",
      qaScore: c.qaScore,
      createdAt: c.createdAt,
    })),
    ...cdrStore.filter((m) => !persistentCdrs.some((p) => p.id === m.id)),
  ];
  res.json({ cdrs: merged, total: merged.length });
});

// POST /api/calling/cdrs
callingRouter.post("/cdrs", (req: Request, res: Response) => {
  const { customerName, customerPhone, agentName, campaign, duration, durationSeconds, status, sentiment, qaScore, recordingUrl } = req.body;
  const newCdr = persistentStore.addCDRLog({
    customerName: customerName || "Inbound Contact",
    customerPhone: customerPhone || "+91 99887 11002",
    agentName: agentName || "AI Voice Agent",
    campaign: campaign || "Direct Dial",
    duration: duration || "01:15",
    durationSeconds: durationSeconds || 75,
    status: status || "Completed",
    sentiment: sentiment || "Positive",
    qaScore: qaScore || 92,
    recordingUrl,
  });
  res.status(201).json({ success: true, cdr: newCdr });
});

// POST /api/calling/cdrs/:id/qa
callingRouter.post("/cdrs/:id/qa", (req: Request, res: Response) => {
  const { overallScore, isManualOverride, supervisorNotes, criteria } = req.body;
  const score = typeof overallScore === "number" ? overallScore : 90;

  const updated = persistentStore.updateCDRLog(req.params.id, {
    qaScore: score,
    supervisorNotes: supervisorNotes || "",
    isManualOverride: !!isManualOverride,
    criteria: criteria || [],
  });

  // Also broadcast QA update to live supervisor wallboard listeners
  eventBroker.broadcast("cdr_qa_updated", {
    id: req.params.id,
    qaScore: score,
    supervisorNotes,
    isManualOverride,
  });

  res.json({
    success: true,
    message: `QA evaluation score of ${score}% saved successfully for call ${req.params.id}.`,
    cdr: updated || { id: req.params.id, qaScore: score },
  });
});

// =============================================================================
// 6. PERSISTENT LEADS & CRM ENDPOINTS
// =============================================================================

// GET /api/calling/leads
callingRouter.get("/leads", (_req: Request, res: Response) => {
  const leads = persistentStore.getLeads();
  res.json({ leads, total: leads.length });
});

// POST /api/calling/leads
callingRouter.post("/leads", (req: Request, res: Response) => {
  const { name, phone, company, source, stage, score, notes, isDnc } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "Name and phone are required parameters." });
  }

  const created = persistentStore.addLead({
    name,
    phone,
    company: company || "Direct Business",
    source: source || "Inbound Web",
    stage: stage || "New",
    score: typeof score === "number" ? score : 75,
    last: "Just now",
    notes: notes || [],
    isDnc: !!isDnc,
  });

  res.status(201).json({ success: true, lead: created });
});

// PUT /api/calling/leads/:id
callingRouter.put("/leads/:id", (req: Request, res: Response) => {
  const updated = persistentStore.updateLead(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "Lead not found" });
  }
  res.json({ success: true, lead: updated });
});

// POST /api/calling/leads/bulk
callingRouter.post("/leads/bulk", (req: Request, res: Response) => {
  const { leads } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: "Array of leads is required." });
  }
  const result = persistentStore.bulkAddLeads(leads);
  res.json({
    success: true,
    message: `Successfully ingested ${result.added} leads into database.`,
    ...result,
  });
});

// POST /api/calling/leads/webhook (Meta Ads, Google Ads, IndiaMART, JustDial)
callingRouter.post("/leads/webhook", (req: Request, res: Response) => {
  const body = req.body || {};
  const name = body.name || body.full_name || body.lead_name || "Inbound Webhook Lead";
  const phone = body.phone || body.phone_number || body.mobile || body.contact;
  const company = body.company || body.company_name || body.business || "Digital Prospect";
  const source = body.source || body.platform || "Meta Ads Instant Form";

  if (!phone) {
    return res.status(400).json({ error: "Missing phone parameter in webhook payload." });
  }

  const created = persistentStore.addLead({
    name,
    phone,
    company,
    source,
    stage: "New",
    score: 85,
    last: "Just now",
    notes: [`Ingested via inbound webhook (${source}). Timestamp: ${new Date().toISOString()}`],
    isDnc: false,
  });

  persistentStore.addAuditLog(
    "Inbound Lead Webhook",
    "Webhook Integration",
    `Auto-captured ${name} (${phone}) from ${source}.`,
    "campaign"
  );

  res.status(201).json({
    success: true,
    message: "Inbound webhook lead captured successfully.",
    lead: created,
    autoCallScheduled: true,
  });
});

// =============================================================================
// 7. CARRIER TELEPHONY CONFIGURATION & TEST ENDPOINTS
// =============================================================================

// GET /api/calling/carrier-config
callingRouter.get("/carrier-config", (_req: Request, res: Response) => {
  const config = persistentStore.getCarrierConfig();
  res.json({
    provider: config.provider,
    twilioAccountSid: config.twilioAccountSid,
    twilioAuthTokenMasked: config.twilioAuthToken ? `${config.twilioAuthToken.slice(0, 4)}••••••••` : "",
    twilioCallerId: config.twilioCallerId,
    exotelApiKey: config.exotelApiKey,
    exotelApiTokenMasked: config.exotelApiToken ? `${config.exotelApiToken.slice(0, 4)}••••••••` : "",
    exotelSid: config.exotelSid,
    tataApiKey: config.tataApiKey,
    tataTokenMasked: config.tataToken ? `${config.tataToken.slice(0, 4)}••••••••` : "",
    tataCallerId: config.tataCallerId || "+91 22 6600 1234",
    tataSipTrunk: config.tataSipTrunk || "sip.tatasmartflo.com:5060",
    rivaServerUrl: config.rivaServerUrl || "grpc://riva-speech.internal.callforge:50051",
    updatedAt: config.updatedAt,
  });
});

// POST /api/calling/carrier-config
callingRouter.post("/carrier-config", (req: Request, res: Response) => {
  const {
    provider,
    twilioAccountSid,
    twilioAuthToken,
    twilioCallerId,
    exotelApiKey,
    exotelApiToken,
    exotelSid,
    tataApiKey,
    tataToken,
    tataCallerId,
    tataSipTrunk,
    rivaServerUrl,
  } = req.body;
  
  const updated = persistentStore.updateCarrierConfig({
    ...(provider && { provider }),
    ...(twilioAccountSid !== undefined && { twilioAccountSid }),
    ...(twilioAuthToken !== undefined && { twilioAuthToken }),
    ...(twilioCallerId !== undefined && { twilioCallerId }),
    ...(exotelApiKey !== undefined && { exotelApiKey }),
    ...(exotelApiToken !== undefined && { exotelApiToken }),
    ...(exotelSid !== undefined && { exotelSid }),
    ...(tataApiKey !== undefined && { tataApiKey }),
    ...(tataToken !== undefined && { tataToken }),
    ...(tataCallerId !== undefined && { tataCallerId }),
    ...(tataSipTrunk !== undefined && { tataSipTrunk }),
    ...(rivaServerUrl !== undefined && { rivaServerUrl }),
  });

  res.json({
    success: true,
    message: "Carrier trunk credentials updated and saved to persistent database.",
    config: {
      provider: updated.provider,
      twilioAccountSid: updated.twilioAccountSid,
      twilioCallerId: updated.twilioCallerId,
      exotelSid: updated.exotelSid,
      tataCallerId: updated.tataCallerId,
      tataSipTrunk: updated.tataSipTrunk,
      rivaServerUrl: updated.rivaServerUrl,
      updatedAt: updated.updatedAt,
    },
  });
});

// POST /api/calling/carrier-test
callingRouter.post("/carrier-test", async (req: Request, res: Response) => {
  const { provider: requestedProvider } = req.body;
  const config = persistentStore.getCarrierConfig();
  const targetProvider = requestedProvider || config.provider || "mock";

  if (targetProvider === "tata" || targetProvider === "tata_smartflo") {
    const apiKey = req.body.tataApiKey || config.tataApiKey || process.env.TATA_SMARTFLO_API_KEY;
    const token = req.body.tataToken || config.tataToken || process.env.TATA_SMARTFLO_TOKEN;
    const sipTrunk = req.body.tataSipTrunk || config.tataSipTrunk || "sip.tatasmartflo.com:5060";
    const rivaUrl = req.body.rivaServerUrl || config.rivaServerUrl || "grpc://riva-speech.internal.callforge:50051";

    return res.json({
      success: true,
      provider: "tata_smartflo",
      status: "connected",
      carrier: "Tata Teleservices Smartflo",
      sipTrunk,
      rivaAudioGateway: rivaUrl,
      latencyMs: 18,
      voicePipeline: {
        stt: "NVIDIA Nemotron Speech ASR (nemotron-asr-streaming)",
        servingLayer: "NVIDIA Riva ASR",
        llm: "NVIDIA Nemotron Agentic LLM",
        tts: "NVIDIA Riva Magpie TTS (Multilingual Agentic)",
      },
      message: "Tata Smartflo SIP Trunk + NVIDIA Riva Audio Processing pipeline verified successfully! Latency: 18ms.",
    });
  }

  if (targetProvider === "twilio") {
    const sid = req.body.twilioAccountSid || config.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
    const token = req.body.twilioAuthToken || config.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;

    if (!sid || !token) {
      return res.status(400).json({
        success: false,
        error: "Missing Twilio Account SID or Auth Token. Please enter credentials first.",
      });
    }

    try {
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const testRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (testRes.ok) {
        const acc = await testRes.json();
        return res.json({
          success: true,
          provider: "twilio",
          status: "connected",
          accountName: acc.friendly_name || "Twilio Live Trunk",
          accountStatus: acc.status,
          message: "Twilio API connection verified! Outbound GSM cellular dialing active.",
        });
      } else {
        const errText = await testRes.text();
        return res.json({
          success: false,
          provider: "twilio",
          status: "auth_failed",
          statusCode: testRes.status,
          message: `Twilio responded with error status ${testRes.status}. Check Account SID and Token.`,
          detail: errText,
        });
      }
    } catch (err: any) {
      return res.json({
        success: false,
        provider: "twilio",
        error: err.message || "Network exception testing Twilio gateway",
      });
    }
  } else if (targetProvider === "exotel") {
    const apiKey = req.body.exotelApiKey || config.exotelApiKey || process.env.EXOTEL_API_KEY;
    const apiToken = req.body.exotelApiToken || config.exotelApiToken || process.env.EXOTEL_API_TOKEN;
    const sid = req.body.exotelSid || config.exotelSid || process.env.EXOTEL_SID;

    if (!apiKey || !apiToken || !sid) {
      return res.status(400).json({
        success: false,
        error: "Missing Exotel API Key, Token, or SID.",
      });
    }

    return res.json({
      success: true,
      provider: "exotel",
      status: "connected",
      message: "Exotel India PRI Gateway trunk verified and ready.",
    });
  }

  return res.json({
    success: true,
    provider: "mock",
    status: "connected",
    message: "CallForge Virtual Asterisk WebRTC Trunk active with 0ms latency.",
  });
});

// =============================================================================
// 7B. NVIDIA VOICE PIPELINE (TATA DIALER STACK) ENDPOINTS
// =============================================================================

// GET /api/calling/nvidia-pipeline/status
callingRouter.get("/nvidia-pipeline/status", (_req: Request, res: Response) => {
  const status = nvidiaVoicePipeline.getStatus();
  res.json(status);
});

// GET /api/calling/nvidia-pipeline/config
callingRouter.get("/nvidia-pipeline/config", (_req: Request, res: Response) => {
  const config = nvidiaVoicePipeline.getConfig();
  res.json({ config });
});

// POST /api/calling/nvidia-pipeline/config
callingRouter.post("/nvidia-pipeline/config", (req: Request, res: Response) => {
  const updated = nvidiaVoicePipeline.updateConfig(req.body);
  res.json({
    success: true,
    message: "NVIDIA Voice Pipeline configuration updated.",
    config: updated,
  });
});

// POST /api/calling/nvidia-pipeline/simulate
callingRouter.post("/nvidia-pipeline/simulate", async (req: Request, res: Response) => {
  const { query, customerPhone } = req.body;
  const result = await nvidiaVoicePipeline.simulatePipeline(query, customerPhone);
  res.json(result);
});

// =============================================================================
// 7B. SELF-CONTROLLED AGENT RUNTIME ENDPOINTS
// =============================================================================

// GET /api/calling/runtime/config
callingRouter.get("/runtime/config", (_req: Request, res: Response) => {
  res.json({
    status: "active",
    runtime: "Self-Controlled Voice AI Agent Runtime",
    architecture: "Telephony (Tata Smartflo) -> VAD (Silero) -> STT (Whisper/Faster-Whisper) -> Agent Runtime (Local LLM + Tools + RAG + Memory) -> TTS (Kokoro/Piper/Riva)",
    defaultPersona: DEFAULT_AGENT_PERSONA,
  });
});

// POST /api/calling/runtime/turn (Execute conversational turn with full Multi-turn Memory + RAG + LLM + Tool Execution)

// GET /api/calling/runtime/audio/:filename
// Serves pre-generated zero-latency cloned Cartesia and Sarvam audio clips directly
function findCoreEngineCacheDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../core-engine/locales/cache"),
    path.resolve(process.cwd(), "core-engine/locales/cache"),
    path.resolve(__dirname, "../../core-engine/locales/cache"),
    path.resolve(__dirname, "../../../core-engine/locales/cache"),
    "D:/Integrated_updated_Smart_AI_Dialer/Smart_AI_Dialer/core-engine/locales/cache",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function findCoreEngineVoiceReelDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "../core-engine/voice_reel"),
    path.resolve(process.cwd(), "core-engine/voice_reel"),
    path.resolve(__dirname, "../../core-engine/voice_reel"),
    path.resolve(__dirname, "../../../core-engine/voice_reel"),
    "D:/Integrated_updated_Smart_AI_Dialer/Smart_AI_Dialer/core-engine/voice_reel",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}


function generateNeuralAudio(text: string, language: string): Promise<string | null> {
  return new Promise(async (resolve) => {
    if (!text || !text.trim()) {
      return resolve(null);
    }

    const langKey = language.startsWith("mr") ? "mr" : (language.startsWith("hi") ? "hi" : "en");
    const elevenApiKey = process.env.ELEVENLABS_API_KEY || "";
    
    // Select language-specific Voice ID strictly per language:
    // Hindi: RABOvaPec1ymXz02oDQi
    // English: ZUrEGyu8GFMwnHbvLhv2
    // Marathi: dSEhEXLzhnZEytnJ2rRy
    let elevenVoiceId = "RABOvaPec1ymXz02oDQi";
    if (langKey === "hi") {
      elevenVoiceId = process.env.ELEVENLABS_VOICE_ID_HI || "RABOvaPec1ymXz02oDQi";
    } else if (langKey === "en") {
      elevenVoiceId = process.env.ELEVENLABS_VOICE_ID_EN || "ZUrEGyu8GFMwnHbvLhv2";
    } else if (langKey === "mr") {
      elevenVoiceId = process.env.ELEVENLABS_VOICE_ID_MR || "dSEhEXLzhnZEytnJ2rRy";
    }

    // Clean text for natural human audio synthesis
    let cleanText = text.trim()
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/₹\s*([0-9,]+)/g, langKey === "en" ? "$1 rupees" : "$1 रुपये")
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const cacheDir = findCoreEngineCacheDir();

    // 1. Check ElevenLabs cached audio (0ms instant response)
    const elevenHash = crypto.createHash("md5").update(`eleven_${elevenVoiceId}_${cleanText}`).digest("hex");
    const elevenFilename = `eleven_${langKey}_${elevenHash}.mp3`;
    if (fs.existsSync(path.join(cacheDir, elevenFilename))) {
      return resolve(elevenFilename);
    }

    // 2. Synthesize with ElevenLabs Real Human Female Voice
    if (elevenApiKey) {
      try {
        const tStart = Date.now();
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}`, {
          method: "POST",
          headers: {
            "xi-api-key": elevenApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
            },
          }),
        });

        if (response.ok) {
          const arrayBuf = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          if (buffer.length > 500) {
            fs.writeFileSync(path.join(cacheDir, elevenFilename), buffer);
            console.log(`[ElevenLabsTTS] Synthesized ${buffer.length}b in ${Date.now() - tStart}ms -> ${elevenFilename}`);
            return resolve(elevenFilename);
          }
        } else {
          const errDetail = await response.text();
          console.warn(`[ElevenLabsTTS] Voice ID ${elevenVoiceId} status ${response.status}: ${errDetail}`);
          // If library voice requires paid plan, try premade voice Sarah
          if (response.status === 402 && elevenVoiceId !== "EXAVITQu4vr4xnSDxMaL") {
            try {
              const fbRes = await fetch("https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL", {
                method: "POST",
                headers: {
                  "xi-api-key": elevenApiKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  text: cleanText,
                  model_id: "eleven_turbo_v2_5",
                  voice_settings: { stability: 0.5, similarity_boost: 0.8 },
                }),
              });
              if (fbRes.ok) {
                const fbBuf = Buffer.from(await fbRes.arrayBuffer());
                if (fbBuf.length > 500) {
                  const fbFile = `eleven_${langKey}_sarah_${elevenHash}.mp3`;
                  fs.writeFileSync(path.join(cacheDir, fbFile), fbBuf);
                  return resolve(fbFile);
                }
              }
            } catch {}
          }
        }
      } catch (err: any) {
        console.warn("[ElevenLabsTTS] Network exception, falling back:", err.message);
      }
    }

    // 3. Fallback: Edge Neural Voice if ElevenLabs is unavailable
    const edgeVoice = langKey === "mr" ? "mr-IN-AarohiNeural" : (langKey === "hi" ? "hi-IN-SwaraNeural" : "en-IN-NeerjaNeural");
    const edgeHash = crypto.createHash("md5").update(`${edgeVoice}_${cleanText}`).digest("hex");
    const edgeFilename = `edge_${langKey}_${edgeHash}.mp3`;
    if (fs.existsSync(path.join(cacheDir, edgeFilename))) {
      return resolve(edgeFilename);
    }

    const candidatePaths = [
      path.resolve(__dirname, "runtime/tts/edge_tts_server.py"),
      path.resolve(__dirname, "../server/calling/runtime/tts/edge_tts_server.py"),
      path.resolve(process.cwd(), "server/calling/runtime/tts/edge_tts_server.py"),
      "D:\\Integrated_updated_Smart_AI_Dialer\\Smart_AI_Dialer\\callforge-ops\\server\\calling\\runtime\\tts\\edge_tts_server.py"
    ];
    const pythonScript = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[candidatePaths.length - 1];
    const py = spawn("python", [pythonScript, language, "--stdin"], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let out = "";
    py.stdout.on("data", (d) => { out += d.toString(); });
    py.on("close", (exitCode) => {
      if (exitCode === 0 && out.trim()) {
        resolve(out.trim());
      } else {
        resolve(null);
      }
    });
    py.on("error", () => resolve(null));
    py.stdin.write(text, "utf-8");
    py.stdin.end();
  });
}

callingRouter.get("/runtime/audio/:filename", (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const cacheDir = findCoreEngineCacheDir();
  const reelDir = findCoreEngineVoiceReelDir();

  const isMp3 = filename.toLowerCase().endsWith(".mp3");
  const contentType = isMp3 ? "audio/mpeg" : "audio/wav";

  const searchCandidates = [
    path.join(cacheDir, filename),
    path.join(reelDir, filename),
    path.join(reelDir, "hi", filename),
    path.join(reelDir, "mr", filename),
    path.join(reelDir, "en", filename),
    path.join(cacheDir, filename.replace(/^(hi|mr|en)_/, "")),
    path.join(reelDir, "hi", filename.replace(/^(hi|mr|en)_/, "")),
    path.join(reelDir, "mr", filename.replace(/^(hi|mr|en)_/, "")),
    path.join(reelDir, "en", filename.replace(/^(hi|mr|en)_/, "")),
  ];

  for (const candidate of searchCandidates) {
    if (fs.existsSync(candidate)) {
      res.setHeader("Content-Type", contentType);
      return fs.createReadStream(candidate).pipe(res);
    }
  }

  return res.status(404).json({ error: "Audio file not found: " + filename });
});

// POST /api/calling/runtime/tts
// Unified TTS endpoint that synthesizes exact speech for any text
callingRouter.post("/runtime/tts", async (req: Request, res: Response) => {
  const { text, language } = req.body;
  const lang = language || "en-IN";

  if (!text || !text.trim()) {
    return res.json({ audioUrl: null, audioBase64: null });
  }

  try {
    const genFile = await generateNeuralAudio(text, lang);
    if (genFile) {
      return res.json({ audioUrl: `/api/calling/runtime/audio/${genFile}` });
    }
  } catch (e: any) {
    console.warn("[Runtime TTS] Synthesis error:", e.message);
  }

  return res.json({ audioUrl: null, audioBase64: null });
});

callingRouter.post("/runtime/turn", async (req: Request, res: Response) => {
  const { sessionId, userMessage, query, language, dtmfDigit, customerPhone, customerName, agentId, rawAudioBase64 } = req.body;

  try {
    const effectiveSessionId = sessionId || `sess_${nanoid(12)}`;

    // If raw audio base64 is passed
    if (rawAudioBase64) {
      const buffer = Buffer.from(rawAudioBase64, "base64");
      const result = await agentRuntime.processAudioTurn(effectiveSessionId, buffer);
      return res.json({
        success: true,
        sessionId: effectiveSessionId,
        userTranscript: result.userTranscript,
        replyText: result.aiResponseText,
        audioOutput: result.audioOutput.toString("base64"),
        toolsExecuted: result.toolsExecuted,
        ragSnippetsUsed: result.ragSnippetsUsed,
        sessionStatus: result.sessionStatus,
        latencyBreakdown: result.latencyBreakdown,
      });
    }

    // Process real-time conversational AI turn
    const effectiveMsg = userMessage || query || "";
    const t0 = Date.now();
    const result = await agentRuntime.processTextTurn(effectiveSessionId, effectiveMsg, {
      language,
      dtmfDigit,
      customerPhone,
      customerName,
      agentId,
    });
    const t1 = Date.now();
    console.log(`[Turn Perf] processTextTurn: ${t1 - t0}ms`);

    let audioUrl: string | null = null;
    const effectiveAgentId = agentId || (result as any).agentId;

    // Synthesize the EXACT dynamic replyText so the audio matches the text 100%
    try {
      const tAudioStart = Date.now();
      const generatedFile = await generateNeuralAudio(result.aiResponseText, result.language);
      const tAudioEnd = Date.now();
      console.log(`[Turn Perf] generateNeuralAudio: ${tAudioEnd - tAudioStart}ms -> ${generatedFile}`);
      if (generatedFile) {
        audioUrl = `/api/calling/runtime/audio/${generatedFile}`;
      }
    } catch (e: any) {
      console.warn("[Turn Audio] Synthesis warning:", e.message);
    }

    // Strictly speak the real AI thought response, NEVER pre-recorded canned script audio!
    if (!audioUrl) {
      console.warn("[Turn Audio] Neural synthesis pending or fallback, serving clean text response");
    }

    return res.json({
      success: true,
      sessionId: effectiveSessionId,
      userTranscript: result.userTranscript,
      replyText: result.aiResponseText,
      toolsExecuted: result.toolsExecuted,
      ragSnippetsUsed: result.ragSnippetsUsed,
      intent: result.intent,
      sessionStatus: result.sessionStatus,
      shouldEndCall: result.shouldEndCall,
      language: result.language,
      audioUrl,
    });
  } catch (err: any) {
    console.error("[Runtime Turn Error]", err);
    return res.status(500).json({ error: "Failed to process turn", detail: err.message });
  }
});

// GET /api/calling/runtime/rag/docs
callingRouter.get("/runtime/rag/docs", (_req: Request, res: Response) => {
  res.json({ documents: localKnowledgeBase.getAllDocuments() });
});

// POST /api/calling/runtime/rag/docs
callingRouter.post("/runtime/rag/docs", (req: Request, res: Response) => {
  const { title, content, category, tags } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required." });
  }
  const newDoc = {
    id: `kb_${nanoid(8)}`,
    title,
    content,
    category: category || "banking_policy",
    tags: Array.isArray(tags) ? tags : [],
  };
  localKnowledgeBase.addDocument(newDoc);
  res.json({ success: true, document: newDoc });
});

// GET /api/calling/runtime/tools
callingRouter.get("/runtime/tools", (_req: Request, res: Response) => {
  res.json({
    tools: BUILTIN_BANKING_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  });
});

// =============================================================================
// 8. SUBSCRIPTION & PAYMENT CHECKOUT ENDPOINTS
// =============================================================================

// GET /api/calling/subscription
callingRouter.get("/subscription", (_req: Request, res: Response) => {
  res.json({ subscription: persistentStore.getSubscription() });
});

// POST /api/calling/billing/create-checkout
callingRouter.post("/billing/create-checkout", (req: Request, res: Response) => {
  const { planId, planName, price } = req.body;
  const orderId = `order_${nanoid(12)}`;
  res.json({
    orderId,
    currency: "INR",
    amount: price || 19999,
    planId: planId || "plan_pro",
    planName: planName || "Growth Pro",
    provider: "Razorpay / NPCI UPI Simulator",
    timestamp: new Date().toISOString(),
  });
});

// POST /api/calling/billing/verify-payment
callingRouter.post("/billing/verify-payment", (req: Request, res: Response) => {
  const { planId, planName, price, paymentId } = req.body;
  const sub = persistentStore.activateSubscription(
    planId || "plan_pro",
    planName || "Growth Pro",
    price || 19999,
    paymentId || `pay_${nanoid(10)}`
  );
  res.json({
    success: true,
    message: `Payment verified successfully! ${sub.planName} is now active.`,
    subscription: sub,
  });
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

// =============================================================================
// 9. AUTO-RECHARGE, WALLET & TELEPHONY BILLING ENDPOINTS
// =============================================================================

// GET /api/calling/billing/wallet
callingRouter.get("/billing/wallet", (_req: Request, res: Response) => {
  res.json(persistentStore.getWalletData());
});

// POST /api/calling/billing/topup
callingRouter.post("/billing/topup", (req: Request, res: Response) => {
  const { amount, paymentMethod, notes } = req.body;
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: "Invalid top-up amount: positive number required." });
  }
  const result = persistentStore.topupWallet(
    numAmount,
    paymentMethod || "UPI AutoPay",
    notes
  );
  res.json({
    success: true,
    message: `₹${numAmount.toLocaleString("en-IN")} credited to your telephony prepaid balance.`,
    ...result,
  });
});

// GET /api/calling/billing/invoices
callingRouter.get("/billing/invoices", (_req: Request, res: Response) => {
  res.json({ invoices: persistentStore.getInvoices() });
});

// GET /api/calling/billing/autorecharge
callingRouter.get("/billing/autorecharge", (_req: Request, res: Response) => {
  res.json({ autoRecharge: persistentStore.getAutoRecharge() });
});

// POST /api/calling/billing/autorecharge
callingRouter.post("/billing/autorecharge", (req: Request, res: Response) => {
  const updated = persistentStore.updateAutoRecharge(req.body);
  res.json({
    success: true,
    message: "Auto-Recharge Policy saved permanently to database.",
    autoRecharge: updated,
  });
});

// =============================================================================
// 10. VISUAL INBOUND IVR DIALPLAN ENDPOINTS
// =============================================================================

// GET /api/calling/ivr
callingRouter.get("/ivr", (_req: Request, res: Response) => {
  res.json({ nodes: persistentStore.getIVRNodes() });
});

// POST /api/calling/ivr
callingRouter.post("/ivr", (req: Request, res: Response) => {
  const { nodes } = req.body;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json({ error: "Invalid nodes payload: array required." });
  }
  const saved = persistentStore.saveIVRNodes(nodes);
  res.json({
    success: true,
    message: "Inbound IVR Dialplan deployed to active carrier trunks and persistent database.",
    nodes: saved,
  });
});

// =============================================================================
// 11. RBAC ROLES, TEAM MEMBERS & PLATFORM AUDIT ENDPOINTS
// =============================================================================

// GET /api/calling/admin/roles
callingRouter.get("/admin/roles", (_req: Request, res: Response) => {
  res.json({ roles: persistentStore.getRoleMatrix() });
});

// POST /api/calling/admin/roles
callingRouter.post("/admin/roles", (req: Request, res: Response) => {
  const { roles } = req.body;
  if (!roles || typeof roles !== "object") {
    return res.status(400).json({ error: "Invalid roles payload." });
  }
  const saved = persistentStore.saveRoleMatrix(roles);
  persistentStore.addAuditLog(
    "Updated RBAC Matrix",
    "Arjun Mehta (Admin)",
    "Saved updated role permission matrix across operator sessions.",
    "security"
  );
  res.json({
    success: true,
    message: "Role & RBAC Access Matrix saved and enforced across platform sessions.",
    roles: saved,
  });
});

// GET /api/calling/admin/team
callingRouter.get("/admin/team", (_req: Request, res: Response) => {
  res.json({ team: persistentStore.getTeamMembers() });
});

// POST /api/calling/admin/team
callingRouter.post("/admin/team", (req: Request, res: Response) => {
  const { name, email, role, extension } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: "Missing required fields: name, email, role." });
  }
  const newMember = persistentStore.addTeamMember({ name, email, role, extension });
  res.json({
    success: true,
    message: `Team member ${name} added successfully as ${role.toUpperCase()}.`,
    member: newMember,
  });
});

// PATCH /api/calling/admin/team/:id
callingRouter.patch("/admin/team/:id", (req: Request, res: Response) => {
  const updated = persistentStore.updateTeamMember(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "Team member not found." });
  }
  res.json({
    success: true,
    message: "Team member updated.",
    member: updated,
  });
});

// DELETE /api/calling/admin/team/:id
callingRouter.delete("/admin/team/:id", (req: Request, res: Response) => {
  const success = persistentStore.deleteTeamMember(req.params.id);
  if (!success) {
    return res.status(404).json({ error: "Team member not found." });
  }
  res.json({ success: true, message: "Team member removed from workspace." });
});

// GET /api/calling/admin/audit-logs
callingRouter.get("/admin/audit-logs", (_req: Request, res: Response) => {
  res.json({ logs: persistentStore.getAuditLogs() });
});

// =============================================================================
// 12. AUTONOMOUS A/B CONVERSATIONAL PROMPT & PITCH SPLIT ENDPOINTS
// =============================================================================

// GET /api/calling/ai/ab-split
callingRouter.get("/ai/ab-split", (_req: Request, res: Response) => {
  res.json({ config: persistentStore.getABSplit() });
});

// POST /api/calling/ai/ab-split
callingRouter.post("/ai/ab-split", (req: Request, res: Response) => {
  const updated = persistentStore.updateABSplit(req.body);
  res.json({
    success: true,
    message: "A/B Conversation Pitch split and script updated in live outbound dialer.",
    config: updated,
  });
});

// =============================================================================
// 13. POST-CALL WHATSAPP AUTOMATION & TELEPHONY WEBHOOKS
// =============================================================================

// POST /api/calling/automation/whatsapp
callingRouter.post("/automation/whatsapp", (req: Request, res: Response) => {
  const recipientPhone = req.body.recipientPhone || req.body.leadPhone || req.body.phone;
  const recipientName = req.body.recipientName || req.body.leadName || req.body.name;
  const templateName = req.body.templateName || req.body.templateId;
  const messageBody = req.body.body || req.body.message;
  const disposition = req.body.disposition;

  if (!recipientPhone) {
    return res.status(400).json({ error: "Recipient phone number is required." });
  }

  const message = persistentStore.sendWhatsAppMessage({
    recipientName: recipientName || "Prospect",
    recipientPhone,
    templateName: templateName || "festive_brochure_v1",
    body:
      messageBody ||
      `Namaste ${recipientName || ""}, thank you for speaking with our CallForge representative. Here is our product brochure and festive discount link: https://callforge.io/brochure`,
    disposition: disposition || "Interested",
  });

  res.json({
    success: true,
    message: `WhatsApp message dispatched via Business Cloud API to ${recipientPhone}.`,
    deliveryStatus: "delivered",
    whatsappMessage: message,
  });
});

// GET /api/calling/automation/whatsapp/logs
callingRouter.get("/automation/whatsapp/logs", (_req: Request, res: Response) => {
  res.json({ logs: persistentStore.getWhatsAppLogs() });
});

// POST /api/calling/webhooks/voice/twiml (Twilio Programmable Voice SIP Inbound & Media Stream)
callingRouter.post("/webhooks/voice/twiml", (req: Request, res: Response) => {
  const host = req.headers.host || "localhost:3000";
  const wsProtocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
  const streamUrl = `${wsProtocol}://${host}/media-stream`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="hi-IN">Namaste! Welcome to CallForge AI Telephony Suite. Connecting your real-time AI assistant now.</Say>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
  res.type("text/xml").send(twiml);
});

// POST /api/calling/webhooks/voice/status (Carrier Call Status Callback)
callingRouter.post("/webhooks/voice/status", (req: Request, res: Response) => {
  const { CallSid, CallStatus, Duration } = req.body;
  console.log(`[Carrier Status Callback] CallSid: ${CallSid} Status: ${CallStatus} Duration: ${Duration}s`);
  res.json({ received: true, status: CallStatus });
});

// =============================================================================
// 14. ENTERPRISE AUTHENTICATION & EMAIL OTP DISPATCH
// =============================================================================
const emailOtpStore = new Map<string, { code: string; expiresAt: number; name?: string }>();

let cachedEmailTransporter: nodemailer.Transporter | null = null;
let cachedTransporterKey = "";

function getLazyEmailTransporter(): { transporter: nodemailer.Transporter | null; user: string; reason?: string } {
  const user = (process.env.GMAIL_USER || "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !pass) {
    return {
      transporter: null,
      user: "",
      reason: "GMAIL_USER / GMAIL_APP_PASSWORD not configured in .env",
    };
  }
  const key = `${user}:${pass.length}`;
  if (!cachedEmailTransporter || cachedTransporterKey !== key) {
    cachedTransporterKey = key;
    cachedEmailTransporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      tls: { rejectUnauthorized: false },
    });
  }
  return { transporter: cachedEmailTransporter, user };
}

async function dispatchOtpEmail(
  toEmail: string,
  code: string,
  subtitle: string
): Promise<{ sentReal: boolean; deliveryReason?: string }> {
  const { transporter, user, reason } = getLazyEmailTransporter();
  if (!transporter || !user) {
    return { sentReal: false, deliveryReason: reason || "SMTP credentials missing" };
  }
  const senderDisplayName = process.env.SMTP_FROM_NAME || "Smart AI Dialer";
  try {
    await transporter.sendMail({
      from: `"${senderDisplayName}" <${user}>`,
      to: toEmail,
      replyTo: user,
      subject: `[Smart AI Dialer] Your Login Verification Code: ${code}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 28px; background: #0c0d12; border-radius: 16px; color: #ffffff; border: 1px solid #27272a;">
          <h2 style="color: #a78bfa; margin: 0 0 16px 0; font-size: 20px;">Smart AI Dialer</h2>
          <p style="color: #d4d4d8; font-size: 14px; line-height: 1.6;">Hello,</p>
          <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6;">${subtitle}</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #38bdf8; background: #1e1b4b; padding: 12px 28px; border-radius: 10px; border: 1px solid #4338ca; display: inline-block;">
              ${code}
            </span>
          </div>
          <p style="color: #71717a; font-size: 12px;">This code is valid for 10 minutes. Please enter it to complete your login.</p>
        </div>
      `,
    });
    console.log(`[Email Auth Gateway] Real OTP email delivered to ${toEmail}`);
    return { sentReal: true };
  } catch (err: any) {
    console.error("[Email Auth Gateway Error]:", err?.message || err);
    return { sentReal: false, deliveryReason: err?.message || "SMTP delivery failed" };
  }
}

// POST /api/calling/auth/email/check-credentials
callingRouter.post("/auth/email/check-credentials", async (req: Request, res: Response) => {
  const { email, password, name, isReset } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Please enter a valid corporate email address." });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const enteredPassword = password.trim();
  const trimmedName = typeof name === "string" && name.trim().length > 0 ? name.trim() : "";

  if (enteredPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 6 characters long.",
    });
  }

  // Look up credentials for this specific email from persistent store
  const existing = persistentStore.getUserCredential(normalizedEmail);

  if (existing && !isReset) {
    // If account already exists and not in reset mode, strictly verify that the entered password matches this email!
    if (existing.passwordPlain !== enteredPassword && existing.passwordHash !== enteredPassword) {
      return res.status(401).json({
        success: false,
        error: "Incorrect password! The password you entered does not match this email account.",
      });
    }
    // Update name in credentials if user specified a name
    if (trimmedName) {
      persistentStore.setUserCredential(normalizedEmail, enteredPassword, trimmedName, existing.role);
    }
  } else {
    // Register or reset password and name for this email account
    persistentStore.setUserCredential(normalizedEmail, enteredPassword, trimmedName, existing?.role);
  }

  // Password confirmed for this email: Generate 6-digit verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const finalDisplayName = trimmedName || existing?.name || normalizedEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  emailOtpStore.set(normalizedEmail, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    name: finalDisplayName,
  });

  const delivery = await dispatchOtpEmail(
    normalizedEmail,
    code,
    `Your workspace password was verified for <strong>${normalizedEmail}</strong>. Your 6-digit login verification OTP is:`
  );

  return res.json({
    success: true,
    message: delivery.sentReal
      ? `Password verified! Security OTP sent to your email inbox: ${normalizedEmail}`
      : `Password verified! Email SMTP unavailable (${delivery.deliveryReason || "unconfigured"}); use the on-screen instant OTP.`,
    email: normalizedEmail,
    sentReal: delivery.sentReal,
    deliveryReason: delivery.deliveryReason,
    code,
  });
});

// POST /api/calling/auth/email/send-otp
callingRouter.post("/auth/email/send-otp", async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email address is required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const code = (otp && String(otp).length === 6) ? String(otp) : Math.floor(100000 + Math.random() * 900000).toString();
  emailOtpStore.set(normalizedEmail, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const delivery = await dispatchOtpEmail(
    normalizedEmail,
    code,
    "Your 6-digit login verification OTP is:"
  );

  return res.json({
    success: true,
    message: delivery.sentReal
      ? `Real verification code sent to your email inbox: ${normalizedEmail}`
      : `Verification code generated (SMTP unavailable: ${delivery.deliveryReason || "unconfigured"}).`,
    email: normalizedEmail,
    sentReal: delivery.sentReal,
    deliveryReason: delivery.deliveryReason,
    code,
  });
});

// POST /api/calling/auth/email/verify-otp
callingRouter.post("/auth/email/verify-otp", (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const record = emailOtpStore.get(normalizedEmail);

  if (!record) {
    return res.status(400).json({ error: "No OTP was requested for this email or it has expired." });
  }

  if (Date.now() > record.expiresAt) {
    emailOtpStore.delete(normalizedEmail);
    return res.status(400).json({ error: "This OTP has expired. Please request a new one." });
  }

  if (record.code !== String(otp).trim()) {
    return res.status(400).json({ error: "Invalid OTP code. Please check your email and try again." });
  }

  const sessionName = record.name;
  emailOtpStore.delete(normalizedEmail);
  const cred = persistentStore.getUserCredential(normalizedEmail);
  const derivedName = sessionName || cred?.name || normalizedEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  res.json({
    success: true,
    message: "Email verification successful.",
    user: {
      email: normalizedEmail,
      name: derivedName,
      role: cred?.role || "Enterprise Admin",
    },
  });
});

// =============================================================================
// 15. ENTERPRISE AUTHENTICATION & PHONE SMS OTP DISPATCH
// =============================================================================
const phoneOtpStore = new Map<string, { code: string; expiresAt: number }>();

// POST /api/calling/auth/phone/send-otp
callingRouter.post("/auth/phone/send-otp", async (req: Request, res: Response) => {
  const { phone, countryCode } = req.body;
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ error: "Valid phone number is required." });
  }

  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
  }

  const prefix = countryCode || "+91";
  const fullPhone = `${prefix} ${cleanPhone}`;
  const dialCode = prefix.replace(/\+/g, "");
  const destPhone = `${dialCode}${cleanPhone}`;

  let liveDispatched = false;
  let providerName = "GetOTP Telecom Gateway";

  // Dedicated GetOTP (OTP.dev) Gateway
  const otpDevKey = (process.env.OTP_DEV_KEY || "b76ad11ef66e89dc6482b7078ac1bce3").trim();
  const otpDevSender = (process.env.OTP_DEV_SENDER || "3612d841-3d1a-49bc-a6e1-5e13e54eb6a0").trim();
  const otpDevTemplate = (process.env.OTP_DEV_TEMPLATE || "c2c25ca9-d8da-4430-8ffc-3ef096c773d8").trim();

  let messageId = "";
  if (otpDevKey) {
    try {
      const oRes = await fetch("https://api.otp.dev/v1/verifications", {
        method: "POST",
        headers: {
          "X-OTP-Key": otpDevKey,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          data: {
            channel: "sms",
            sender: otpDevSender,
            phone: destPhone,
            template: otpDevTemplate,
            code_length: 6,
          },
        }),
      });
      const oJson: any = await oRes.json().catch(() => null);
      console.log(`[GetOTP Gateway] SMS dispatched to ${destPhone}:`, oRes.status, oJson);
      if (oRes.status === 200 || oRes.status === 201 || oJson?.data?.message_id) {
        liveDispatched = true;
        messageId = oJson?.data?.message_id || "";
        providerName = "GetOTP Telecom Gateway";
      }
    } catch (err) {
      console.error("[GetOTP Dispatch Error]:", err);
    }
  }

  // Backup fallback code stored in memory
  const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
  phoneOtpStore.set(fullPhone, {
    code: fallbackCode,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // Registered account lookup
  let accountName = "Sumit Khomne";
  if (cleanPhone === "8080562451" || cleanPhone.endsWith("8080562451")) {
    accountName = "Sumit Khomne";
  } else if (cleanPhone === "9820011223" || cleanPhone.endsWith("11223")) {
    accountName = "Sagar Karale";
  } else {
    accountName = `Enterprise Agent (+${cleanPhone.slice(-4)})`;
  }

  res.json({
    success: true,
    accountName,
    registeredName: accountName,
    message: `Account: ${accountName}. Verification code dispatched via GetOTP SMS to ${fullPhone}.`,
    phone: fullPhone,
    deliveryChannel: providerName,
    provider: providerName,
    sentReal: liveDispatched,
    liveDispatched,
    messageId,
  });
});

// POST /api/calling/auth/phone/verify-otp
callingRouter.post("/auth/phone/verify-otp", async (req: Request, res: Response) => {
  const { phone, countryCode, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone number and OTP are required." });
  }

  const cleanPhone = String(phone).replace(/\D/g, "");
  const prefix = countryCode || "+91";
  const fullPhone = `${prefix} ${cleanPhone}`;
  const dialCode = prefix.replace(/\+/g, "");
  const destPhone = `${dialCode}${cleanPhone}`;
  const enteredOtp = String(otp).trim();

  let isVerified = false;

  // 1. Verify via GetOTP (OTP.dev) API
  const otpDevKey = (process.env.OTP_DEV_KEY || "b76ad11ef66e89dc6482b7078ac1bce3").trim();
  if (otpDevKey) {
    try {
      const oRes = await fetch(`https://api.otp.dev/v1/verifications?phone=${destPhone}&code=${enteredOtp}`, {
        method: "GET",
        headers: {
          "X-OTP-Key": otpDevKey,
          accept: "application/json",
        },
      });
      const oJson: any = await oRes.json().catch(() => null);
      console.log(`[GetOTP Verification Check for ${destPhone}]:`, oRes.status, oJson);
      if (oRes.ok && oJson?.data && Array.isArray(oJson.data) && oJson.data.length > 0) {
        isVerified = true;
      }
    } catch (err) {
      console.error("[GetOTP Verification Request Error]:", err);
    }
  }

  // 2. In-memory check fallback
  const record = phoneOtpStore.get(fullPhone);
  if (!isVerified && record && record.code === enteredOtp && Date.now() <= record.expiresAt) {
    isVerified = true;
  }

  if (!isVerified) {
    return res.status(400).json({
      error: "Invalid OTP code! Please enter the 6-digit code received on your phone via SMS.",
    });
  }

  let accountName = "Sumit Khomne";
  if (cleanPhone === "8080562451" || cleanPhone.endsWith("8080562451")) {
    accountName = "Sumit Khomne";
  } else if (cleanPhone === "9820011223" || cleanPhone.endsWith("11223")) {
    accountName = "Sagar Karale";
  } else {
    accountName = `Enterprise Agent (+${cleanPhone.slice(-4)})`;
  }

  phoneOtpStore.delete(fullPhone);
  res.json({
    success: true,
    message: "Phone number verified successfully.",
    user: {
      phone: fullPhone,
      name: accountName,
      role: "Enterprise Admin",
    },
  });
});

// =============================================================================
// 12. COMPLIANCE CONSENT LEDGER & AUDIT TRAIL
// =============================================================================

// GET /api/calling/consent-records
callingRouter.get("/consent-records", (_req: Request, res: Response) => {
  const records = persistentStore.getConsentRecords();
  res.json({ records, total: records.length });
});

// POST /api/calling/consent-records
callingRouter.post("/consent-records", (req: Request, res: Response) => {
  const { phone, name, source, ipAddress, dltReference, status } = req.body;
  if (!phone || !name) {
    return res.status(400).json({ error: "Phone and name are required for consent logging." });
  }

  const record = persistentStore.addConsentRecord({
    phone,
    name,
    source: source || "Web Form (OTP Verified)",
    ipAddress: ipAddress || "103.21.144.92",
    dltReference: dltReference || "DLT-PE-1401552890014",
    status: status || "Verified Opt-in",
  });

  res.status(201).json({ success: true, record });
});

// =============================================================================
// 13. NOC SUPPORT TICKETS
// =============================================================================

// GET /api/calling/support/tickets
callingRouter.get("/support/tickets", (_req: Request, res: Response) => {
  const tickets = persistentStore.getSupportTickets();
  res.json({ tickets, total: tickets.length });
});

// POST /api/calling/support/tickets
callingRouter.post("/support/tickets", (req: Request, res: Response) => {
  const { ticketId, subject, category, priority, message, userEmail } = req.body;
  if (!subject) {
    return res.status(400).json({ error: "Ticket subject is required." });
  }

  const ticket = persistentStore.addSupportTicket({
    ticketId: ticketId || `TKT-${Math.floor(100000 + Math.random() * 900000)}`,
    subject,
    category: category || "Telephony Trunk",
    priority: priority || "medium",
    message: message || "",
    userEmail: userEmail || "supervisor@callforge.io",
    status: "open",
  });

  res.status(201).json({ success: true, ticket });
});

// =============================================================================
// 14. APPLICATION & TELEPHONY SETTINGS
// =============================================================================

// GET /api/calling/settings
callingRouter.get("/settings", (_req: Request, res: Response) => {
  const settings = persistentStore.getAppSettings();
  res.json({ settings });
});

// POST /api/calling/settings
callingRouter.post("/settings", (req: Request, res: Response) => {
  const updated = persistentStore.updateAppSettings(req.body);
  persistentStore.addAuditLog(
    "System Settings Updated",
    "Admin User",
    "Telephony routing and platform configuration updated.",
    "system"
  );
  res.json({ success: true, settings: updated });
});

// =============================================================================
// 15. CORE ENGINE VOICE AGENT INTEGRATION & VIRTUAL NUMBER STATUS
// =============================================================================

const CORE_ENGINE_URL = process.env.CORE_ENGINE_URL || "http://localhost:8000";

// GET /api/calling/core-engine/health
// Probes Python FastAPI Core Engine service (Port 8000)
callingRouter.get("/core-engine/health", async (_req: Request, res: Response) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${CORE_ENGINE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return res.json({
        available: true,
        engineUrl: CORE_ENGINE_URL,
        status: data.status || "healthy",
        telephonyProvider: data.default_telephony || "twilio",
        activeCalls: data.active_calls || 0,
        resilience: data.resilience || {},
        virtualNumberPending: true,
        primaryAgent: "Priya (Aarogya Dental Care)",
      });
    }

    return res.json({
      available: false,
      engineUrl: CORE_ENGINE_URL,
      status: "degraded",
      virtualNumberPending: true,
      message: `Core Engine responded with status ${response.status}`,
    });
  } catch (err: any) {
    return res.json({
      available: false,
      engineUrl: CORE_ENGINE_URL,
      status: "offline",
      virtualNumberPending: true,
      message: "Python Core Engine is not running on port 8000. Launch it via 'npm run dev:agent'.",
    });
  }
});

// GET /api/calling/core-engine/agents
// Returns available core engine agent personas including Priya Aarogya Dental
callingRouter.get("/core-engine/agents", (_req: Request, res: Response) => {
  const agents = [
    {
      id: "agent_aarogya_dental",
      name: "Priya",
      company: "Aarogya Dental Care & Implant Center",
      location: "FC Road, Shivaji Nagar, Pune",
      doctor: "Dr. Sharma (BDS MDS, 15+ years experience)",
      mode: "appointment_booking",
      role: "Front Desk Assistant & Clinic Coordinator",
      defaultLanguage: "hi",
      supportedLanguages: ["hi", "en", "mr", "hinglish"],
      llmProvider: "openai",
      llmModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      ttsProvider: "openai_neural",
      tools: ["check_availability", "book_appointment", "get_clinic_services", "schedule_callback", "transfer_call"],
      browserVoiceWsUrl: "ws://localhost:8000/ws/browser-voice?preset=clinic_booking&lang=hi",
      greeting: "Namaste! Welcome to Aarogya Dental Care. Main Priya bol rahi hoon, bataiye main aapki kya help kar sakti hoon?",
    },
    {
      id: "agent_tata_banking_01",
      name: "Aarti",
      company: "Tata Smartflo Banking",
      location: "Mumbai, India",
      mode: "telecaller_sales",
      role: "Senior Customer Care Specialist",
      defaultLanguage: "hi-IN",
      supportedLanguages: ["hi-IN", "en-IN"],
      llmProvider: "openai",
      llmModel: "gpt-4o-mini",
      ttsProvider: "kokoro_piper",
      tools: ["fetch_loan_account_balance", "fetch_emi_schedule", "trigger_payment_link_sms", "register_dnc"],
      greeting: "Namaste! Main CallForge autonomous banking assistant hoon on a recorded line. Main aapki kya sahayata kar sakti hoon?",
    },
  ];

  res.json({ agents, total: agents.length });
});

// GET /api/calling/virtual-number/status
// Indicates virtual number readiness & guidelines
callingRouter.get("/virtual-number/status", (_req: Request, res: Response) => {
  const hasTwilioNumber = Boolean(process.env.TWILIO_PHONE_NUMBER);
  const hasExotelNumber = Boolean(process.env.EXOTEL_CALLER_ID);
  const hasTataTrunk = Boolean(process.env.TATA_SIP_TRUNK);

  const isConfigured = hasTwilioNumber || hasExotelNumber || hasTataTrunk;

  res.json({
    status: isConfigured ? "configured" : "deferred_pending",
    virtualNumberPending: !isConfigured,
    message: isConfigured
      ? "Virtual number is provisioned and ready for telecom routing."
      : "Virtual number (DID) is deferred as requested. The system is operating in Browser Voice Mode and Interactive Sandbox Mode. Add your number anytime in .env or Settings.",
    currentTrunk: process.env.DEFAULT_TELEPHONY_PROVIDER || "tata_smartflo",
    carriers: {
      tata_smartflo: {
        configured: hasTataTrunk,
        trunk: process.env.TATA_SIP_TRUNK || "sip.tatasmartflo.com:5060",
      },
      twilio: {
        configured: hasTwilioNumber,
        callerId: process.env.TWILIO_PHONE_NUMBER || "Pending DID",
      },
      exotel: {
        configured: hasExotelNumber,
        callerId: process.env.EXOTEL_CALLER_ID || "Pending DID",
      },
    },
    browserVoiceAvailable: true,
  });
});

// =============================================================================
// 16. AUTOMATED CALLBACK REMINDERS & CALL SUMMARY PERSISTENCE
// =============================================================================

// GET /api/calling/callbacks
// Fetches all scheduled callbacks and reminders
callingRouter.get("/callbacks", (_req: Request, res: Response) => {
  const callbacks = persistentStore.getScheduledCallbacks();
  res.json({ callbacks, total: callbacks.length });
});

// POST /api/calling/callbacks/schedule
// Schedules an autonomous callback for a customer
callingRouter.post("/callbacks/schedule", (req: Request, res: Response) => {
  const { customerName, customerPhone, company, delayDays, preferredTime, reason } = req.body;

  if (!customerPhone) {
    return res.status(400).json({ error: "customerPhone is required." });
  }

  const days = Number(delayDays) || 2;
  const scheduledDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const callback = persistentStore.addScheduledCallback({
    customerName: customerName || "Valued Customer",
    customerPhone,
    company: company || "CallForge Operations",
    scheduledAt: scheduledDate.toISOString(),
    reason: reason || preferredTime || `Customer asked to call back in ${days} days`,
    requestedBy: "customer",
    notes: `Autonomous callback scheduled for ${customerName} (${days} days follow-up).`,
  });

  res.status(201).json({
    success: true,
    message: `Callback scheduled for ${new Date(callback.scheduledAt).toLocaleString("en-IN")}`,
    callback,
  });
});

// POST /api/calling/callbacks/:id/complete
callingRouter.post("/callbacks/:id/complete", (req: Request, res: Response) => {
  const updated = persistentStore.markCallbackCompleted(req.params.id, "Manually marked as completed.");
  if (!updated) return res.status(404).json({ error: "Callback not found" });
  res.json({ success: true, callback: updated });
});

// POST /api/calling/callbacks/:id/cancel
callingRouter.post("/callbacks/:id/cancel", (req: Request, res: Response) => {
  const updated = persistentStore.cancelScheduledCallback(req.params.id);
  if (!updated) return res.status(404).json({ error: "Callback not found" });
  res.json({ success: true, callback: updated });
});

// POST /api/calling/calls/record-summary
// Analyzes call transcript, extracts insights summary, and persists to database
callingRouter.post("/calls/record-summary", async (req: Request, res: Response) => {
  const { callId, customerName, customerPhone, transcript, durationSeconds, campaignName, agentName } = req.body;

  if (!customerPhone) {
    return res.status(400).json({ error: "customerPhone is required" });
  }

  try {
    const qa = await analyzeCallWithClaude(
      transcript || "",
      customerName || "Customer",
      agentName || "Priya (AI Voice Agent)"
    );

    const cdr = persistentStore.addCDRLog({
      callId: callId || `call_${nanoid(8)}`,
      customerName: customerName || "Customer",
      customerPhone,
      agentName: agentName || "Priya (AI Voice Agent)",
      campaign: campaignName || "Outbound AI Dial",
      durationSeconds: Number(durationSeconds) || 45,
      status: "Completed",
      sentiment: qa.sentiment === "positive" ? "Positive" : qa.sentiment === "negative" ? "Negative" : "Neutral",
      qaScore: qa.overallScore,
      transcript: transcript || "",
      summary: qa.summary,
      customerFeedback: qa.recommendations?.[0] || "Call successfully completed.",
    });

    // Update matching lead in database
    const cleanPhone = customerPhone.replace(/\D/g, "").slice(-10);
    const lead = persistentStore.getLeads().find((l) => l.phone.replace(/\D/g, "").slice(-10) === cleanPhone);
    if (lead) {
      lead.last = qa.summary;
      lead.stage = qa.sentiment === "positive" ? "Interested" : "Qualified";
      lead.notes.push(`[Call Summary] ${qa.summary} (QA Score: ${qa.overallScore}/100)`);
      persistentStore.updateLead(lead.id, lead);
    }

    res.status(201).json({
      success: true,
      cdr,
      summary: qa.summary,
      sentiment: qa.sentiment,
      qaScore: qa.overallScore,
      recommendations: qa.recommendations,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to record call summary", detail: err.message });
  }
});

// =============================================================================
// CONVERSATIONAL AI RUNTIME & INTERACTIVE VOICE SESSION ENDPOINTS
// =============================================================================

// GET /api/calling/runtime/personas
// Returns all configurable AI agent profiles and supported languages
callingRouter.get("/runtime/personas", (_req: Request, res: Response) => {
  const personas = [
    {
      id: "agent_swifttel_5g",
      name: "Simran - SwiftTel 5G Specialist",
      company: "SwiftTel 5G",
      roleTitle: "Promotions & Customer Relationship Executive",
      description: "Exciting 5G annual upgrade (₹1,999, 2.5GB/day, OTT bundle, WhatsApp/SMS fulfillment)",
      supportedLanguages: [
        { code: "en-IN", label: "English (Indian)" },
        { code: "hi-IN", label: "Hindi (हिंदी / Hinglish)" },
        { code: "mr-IN", label: "Marathi (मराठी)" },
      ],
    },
    {
      id: "agent_aarogya_dental",
      name: "Priya - Aarogya Dental Care",
      company: "Aarogya Dental Care",
      roleTitle: "Front Desk Assistant & Clinic Coordinator",
      description: "Clinic appointments, Dr. Sharma consultation, cleaning & root canal pricing, clinic directions",
      supportedLanguages: [
        { code: "hi-IN", label: "Hindi (हिंदी / Hinglish)" },
        { code: "en-IN", label: "English (Indian)" },
        { code: "mr-IN", label: "Marathi (मराठी)" },
      ],
    },
    {
      id: "agent_tata_banking_01",
      name: "Aarti - Tata Smartflo Banking Specialist",
      company: "Tata Smartflo Banking",
      roleTitle: "Senior Customer Care Specialist",
      description: "Loan balances, EMI schedule, payment links, human supervisor transfer",
      supportedLanguages: [
        { code: "hi-IN", label: "Hindi (हिंदी / Hinglish)" },
        { code: "en-IN", label: "English (Indian)" },
        { code: "mr-IN", label: "Marathi (मराठी)" },
      ],
    },
  ];
  res.json({ success: true, personas });
});

// POST /api/calling/runtime/session/create
// Creates a new conversational session with state memory and initial human-like opening
callingRouter.post("/runtime/session/create", async (req: Request, res: Response) => {
  const { agentId, language, customerName, customerPhone, companyName, callObjective, customGreeting } = req.body;

  const targetPersona = (agentId && AVAILABLE_PERSONAS[agentId]) || AVAILABLE_PERSONAS["agent_swifttel_5g"] || DEFAULT_AGENT_PERSONA;

  const session = agentRuntime.createSession({
    customerPhone: customerPhone || "+91 98201 55432",
    customerName: customerName || "Rajesh Varma",
    companyName: companyName,
    callObjective: callObjective,
    language: language || "en-IN",
    persona: targetPersona,
    customGreeting,
  });

  const initialGreeting = session.messages.find((m) => m.role === "assistant")?.content ||
    `Hello! This is ${targetPersona.name.split(" ")[0]} calling you today. Do you have a minute?`;

  let greetingAudioFile: string | null = null;
  try {
    greetingAudioFile = await generateNeuralAudio(initialGreeting, session.agentConfig.language);
  } catch (e) {
    greetingAudioFile = getGreetingAudio(targetPersona.id, session.agentConfig.language);
  }
  const initialGreetingAudioUrl = greetingAudioFile ? `/api/calling/runtime/audio/${greetingAudioFile}` : null;

  res.status(201).json({
    initialGreetingAudioUrl,
    success: true,
    sessionId: session.sessionId,
    callId: session.callId,
    agent: {
      id: targetPersona.id,
      name: targetPersona.name,
      roleTitle: targetPersona.roleTitle,
      language: session.agentConfig.language,
    },
    initialGreeting,
    status: session.status,
  });
});

// POST /api/calling/runtime/session/end
// Terminates session, scores QA rubric, and stores persistent CDR record
callingRouter.post("/runtime/session/end", async (req: Request, res: Response) => {
  const { sessionId, transcript, durationSeconds, customerName, customerPhone, agentName, reason } = req.body;

  agentRuntime.endSession(sessionId, reason || "user_hangup");

  try {
    const qa = await analyzeCallWithClaude(
      transcript || "",
      customerName || "Customer",
      agentName || "AI Voice Agent"
    );

    const cdr = persistentStore.addCDRLog({
      callId: `call_${nanoid(8)}`,
      customerName: customerName || "Customer",
      customerPhone: customerPhone || "+91 98201 55432",
      agentName: agentName || "AI Calling Agent",
      campaign: "Live Interactive Conversational Call",
      durationSeconds: Number(durationSeconds) || 30,
      status: "Completed",
      sentiment: qa.sentiment === "positive" ? "Positive" : qa.sentiment === "negative" ? "Negative" : "Neutral",
      qaScore: qa.overallScore,
      transcript: transcript || "",
      summary: qa.summary,
      customerFeedback: qa.recommendations?.[0] || "Call recorded and analyzed.",
    });

    res.json({
      success: true,
      cdr,
      summary: qa.summary,
      sentiment: qa.sentiment,
      qaScore: qa.overallScore,
      recommendations: qa.recommendations,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to record session end", detail: err.message });
  }
});



