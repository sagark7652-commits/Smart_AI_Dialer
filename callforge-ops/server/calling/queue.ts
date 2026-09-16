import { nanoid } from "nanoid";
import { getTelephonyProvider } from "./provider";
import { eventBroker } from "./sse";
import {
  ActiveCall,
  AgentState,
  CampaignJob,
  CampaignLead,
  DialerMode,
} from "./types";

export interface CreateCampaignOptions {
  name: string;
  dialerMode: DialerMode;
  callerId?: string;
  script: string;
  callingWindow?: {
    startHour: number;
    endHour: number;
    timezone: string;
  };
  leads: Array<{
    phone: string;
    name: string;
    company?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export class PersistentDialerWorker {
  private campaigns: Map<string, CampaignJob> = new Map();
  private dncNumbers: Set<string> = new Set<string>();
  private isRunning = false;
  private workerInterval: NodeJS.Timeout | null = null;
  private activeCalls: Map<string, ActiveCall> = new Map();
  private agents: Map<
    string,
    { id: string; name: string; avatar: string; state: AgentState; timeInStateSeconds: number; currentCallId?: string }
  > = new Map();

  constructor() {
    this.seedDefaultAgents();
  }

  private seedDefaultAgents() {
    const defaultAgents = [
      { id: "agt-01", name: "Priya Sharma", avatar: "PS", state: "ready" as AgentState, timeInStateSeconds: 142 },
      { id: "agt-02", name: "Rahul Verma", avatar: "RV", state: "on_call" as AgentState, timeInStateSeconds: 215 },
      { id: "agt-03", name: "Ananya Iyer", avatar: "AI", state: "wrap_up" as AgentState, timeInStateSeconds: 38 },
      { id: "agt-04", name: "Amit Patel", avatar: "AP", state: "break" as AgentState, timeInStateSeconds: 520 },
    ];
    for (const a of defaultAgents) {
      this.agents.set(a.id, a);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.workerInterval = setInterval(() => this.workerCycle(), 2000);
    console.log("[Dialer Worker] Background persistent worker started.");
  }

  stop() {
    this.isRunning = false;
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
    console.log("[Dialer Worker] Background persistent worker stopped.");
  }

  addDNCNumber(phone: string) {
    const normalized = phone.replace(/\D/g, "").slice(-10);
    if (normalized.length === 10) {
      this.dncNumbers.add(normalized);
    }
  }

  isDNC(phone: string): boolean {
    const normalized = phone.replace(/\D/g, "").slice(-10);
    if (normalized.length < 10) return false;
    return this.dncNumbers.has(normalized);
  }

  isWithinCallingWindow(window: { startHour: number; endHour: number; timezone: string }): boolean {
    try {
      const now = new Date();
      // Format current hour in the specified timezone
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: window.timezone || "Asia/Kolkata",
        hour: "numeric",
        hour12: false,
      });
      const currentHour = parseInt(formatter.format(now), 10);
      return currentHour >= window.startHour && currentHour < window.endHour;
    } catch {
      return true; // fallback
    }
  }

  enqueueCampaign(opts: CreateCampaignOptions): CampaignJob {
    const id = `cmp_${nanoid(8)}`;
    const leads: CampaignLead[] = opts.leads.map((l, index) => ({
      id: `lead_${nanoid(8)}_${index}`,
      phone: l.phone,
      name: l.name,
      company: l.company,
      metadata: l.metadata,
      status: "pending",
      attempts: 0,
    }));

    const job: CampaignJob = {
      id,
      name: opts.name,
      dialerMode: opts.dialerMode,
      status: "queued",
      callingWindow: opts.callingWindow || {
        startHour: 9,
        endHour: 21,
        timezone: "Asia/Kolkata",
      },
      script: opts.script,
      callerId: opts.callerId || "+91-140-998822",
      leads,
      stats: {
        totalLeads: leads.length,
        dialed: 0,
        connected: 0,
        qualified: 0,
        failed: 0,
        abandoned: 0,
        averageDurationSeconds: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.campaigns.set(id, job);

    // Auto-start worker if not already running
    if (!this.isRunning) {
      this.start();
    }

    return job;
  }

  startCampaign(id: string): { success: boolean; message: string; campaign?: CampaignJob } {
    const job = this.campaigns.get(id);
    if (!job) return { success: false, message: "Campaign not found" };

    if (!this.isWithinCallingWindow(job.callingWindow)) {
      return {
        success: false,
        message: `Current time is outside TRAI statutory window (${job.callingWindow.startHour}:00 - ${job.callingWindow.endHour}:00 IST). Campaign queued.`,
        campaign: job,
      };
    }

    job.status = "running";
    job.updatedAt = new Date().toISOString();
    return { success: true, message: "Campaign started successfully.", campaign: job };
  }

  pauseCampaign(id: string): { success: boolean; campaign?: CampaignJob } {
    const job = this.campaigns.get(id);
    if (!job) return { success: false };
    job.status = "paused";
    job.updatedAt = new Date().toISOString();
    return { success: true, campaign: job };
  }

  resumeCampaign(id: string): { success: boolean; campaign?: CampaignJob } {
    const job = this.campaigns.get(id);
    if (!job) return { success: false };
    job.status = "running";
    job.updatedAt = new Date().toISOString();
    return { success: true, campaign: job };
  }

  stopCampaign(id: string): { success: boolean; campaign?: CampaignJob } {
    const job = this.campaigns.get(id);
    if (!job) return { success: false };
    job.status = "completed";
    job.updatedAt = new Date().toISOString();
    return { success: true, campaign: job };
  }

  getCampaign(id: string): CampaignJob | undefined {
    return this.campaigns.get(id);
  }

  getAllCampaigns(): CampaignJob[] {
    return Array.from(this.campaigns.values());
  }

  getActiveCalls(): ActiveCall[] {
    return Array.from(this.activeCalls.values());
  }

  getAgents() {
    return Array.from(this.agents.values());
  }

  updateAgentState(agentId: string, state: AgentState) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.state = state;
      agent.timeInStateSeconds = 0;
      eventBroker.broadcastAgentStatus(agentId, state, agent.name);
    }
  }

  private async workerCycle() {
    // 1. Process active running campaigns
    for (const job of Array.from(this.campaigns.values())) {
      if (job.status !== "running") continue;

      if (!this.isWithinCallingWindow(job.callingWindow)) {
        console.log(`[Dialer Worker] Pausing campaign ${job.id}: outside statutory calling hours`);
        job.status = "paused";
        continue;
      }

      // Determine batch size based on dialer mode
      let batchSize = 1;
      if (job.dialerMode === "progressive") batchSize = 1;
      if (job.dialerMode === "predictive") batchSize = 2;
      if (job.dialerMode === "blast") batchSize = 5;

      // Find pending leads
      const pendingLeads = job.leads.filter((l: CampaignLead) => l.status === "pending").slice(0, batchSize);

      if (pendingLeads.length === 0) {
        // Check if all leads are processed
        const anyRemaining = job.leads.some((l: CampaignLead) => l.status === "pending" || l.status === "dialing");
        if (!anyRemaining) {
          job.status = "completed";
          job.updatedAt = new Date().toISOString();
          console.log(`[Dialer Worker] Campaign ${job.id} completed all leads.`);
        }
        continue;
      }

      for (const lead of pendingLeads) {
        // Scrub DNC
        if (this.isDNC(lead.phone)) {
          lead.status = "dnc";
          job.stats.failed++;
          continue;
        }

        lead.status = "dialing";
        lead.attempts++;
        lead.lastAttemptAt = new Date().toISOString();
        job.stats.dialed++;

        // Dispatch call via provider
        const provider = getTelephonyProvider();
        const callResult = await provider.makeCall({
          to: lead.phone,
          from: job.callerId,
          script: job.script,
          metadata: { campaignId: job.id, leadId: lead.id, leadName: lead.name },
        });

        const activeCall: ActiveCall = {
          id: callResult.callId,
          campaignId: job.id,
          leadId: lead.id,
          customerPhone: lead.phone,
          customerName: lead.name,
          provider: "mock",
          status: "in_progress",
          startedAt: new Date().toISOString(),
          durationSeconds: 1,
          sentiment: "positive",
        };

        this.activeCalls.set(activeCall.id, activeCall);
        eventBroker.broadcastCallUpdate(activeCall);

        lead.status = "connected";
        job.stats.connected++;
        job.stats.qualified = Math.floor(job.stats.connected * 0.45);
        job.stats.averageDurationSeconds = 74;
        job.updatedAt = new Date().toISOString();
      }
    }

    // 2. Increment active call timers & clean up old mock calls
    for (const [id, call] of Array.from(this.activeCalls.entries())) {
      call.durationSeconds += 2;
      if (call.durationSeconds > 60) {
        call.status = "completed";
        call.endedAt = new Date().toISOString();
        this.activeCalls.delete(id);
      }
    }

    // 3. Broadcast wallboard snapshot
    if (eventBroker.getClientCount() > 0) {
      eventBroker.broadcastWallboard({
        timestamp: new Date().toISOString(),
        activeCalls: this.getActiveCalls(),
        agents: this.getAgents(),
        queueStats: {
          waitingCalls: 2,
          longestWaitSeconds: 14,
          availableAgents: Array.from(this.agents.values()).filter((a) => a.state === "ready").length,
          busyAgents: Array.from(this.agents.values()).filter((a) => a.state === "on_call").length,
        },
      });
    }
  }

  addDirectCall(call: ActiveCall) {
    this.activeCalls.set(call.id, call);
    eventBroker.broadcastCallUpdate(call);
  }
}

export const dialerWorker = new PersistentDialerWorker();
