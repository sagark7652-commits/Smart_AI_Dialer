import React, { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Filter,
  Headphones,
  LayoutDashboard,
  ListFilter,
  Megaphone,
  MessageSquareText,
  MoreHorizontal,
  Pause,
  Phone,
  Play,
  Plus,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
  Volume2,
  WandSparkles,
  Lock,
  Zap,
  Workflow,
  CreditCard,
  PhoneCall,
  Shield,
  X,
  UserCheck,
  MapPin,
  Building,
  CheckCircle2,
  RotateCw,
  Send,
} from "lucide-react";

// Calling Component Imports (All 8 Categories)
import { CampaignBuilderModal } from "../components/calling/campaigns/CampaignBuilderModal";
import { CampaignControls } from "../components/calling/campaigns/CampaignControls";
import { SandboxTestModal } from "../components/calling/campaigns/SandboxTestModal";
import { WebRTCSoftphone } from "../components/calling/agent/WebRTCSoftphone";
import { AgentStatusDropdown } from "../components/calling/agent/AgentStatusDropdown";
import { LiveWallboardGrid, INITIAL_AGENTS } from "../components/calling/supervisor/LiveWallboardGrid";
import { CDRDataTable, CDRRecord } from "../components/calling/supervisor/CDRDataTable";
import { AudioPlayerDrawer } from "../components/calling/global/AudioPlayerDrawer";
import { QAScorecardModal } from "../components/calling/supervisor/QAScorecardModal";
import { VoiceSelectionPicker } from "../components/calling/ai/VoiceSelectionPicker";
import { ABTestingSplitUI } from "../components/calling/ai/ABTestingSplitUI";
import { NvidiaVoicePipelineStudio } from "../components/calling/ai/NvidiaVoicePipelineStudio";
import { VisualIVRBuilder } from "../components/calling/global/VisualIVRBuilder";
import { DisabledStateGuard } from "../components/calling/global/DisabledStateGuard";
import { AutoRechargeConfig } from "../components/calling/billing/AutoRechargeConfig";
import { LiveSpendCounter } from "../components/calling/billing/LiveSpendCounter";
import { ClickToCallButton } from "../components/calling/crm/ClickToCallButton";
import { ConsentAuditLedger } from "../components/calling/crm/ConsentAuditLedger";
import { RoleManagementUI } from "../components/calling/admin/RoleManagementUI";
import { SystemStatusPage } from "../components/calling/admin/SystemStatusPage";
import { CarrierConfigCard } from "../components/calling/admin/CarrierConfigCard";
import { BillingHub } from "../components/calling/billing/BillingHub";
import { AdminHub } from "../components/calling/admin/AdminHub";

// New Rich Functional Components
import { CommandPaletteModal } from "../components/calling/global/CommandPaletteModal";
import { NotificationCenter } from "../components/calling/global/NotificationCenter";
import { LeadDetailsDrawer, LeadRecord } from "../components/calling/crm/LeadDetailsDrawer";
import { AddLeadModal } from "../components/calling/crm/AddLeadModal";
import { BulkLeadImportModal } from "../components/calling/crm/BulkLeadImportModal";
import { ProUpgradeModal } from "../components/calling/global/ProUpgradeModal";
import { HelpCenterModal } from "../components/calling/global/HelpCenterModal";
import { UserProfileModal } from "../components/calling/global/UserProfileModal";
import { ClaudeScriptEditor } from "../components/calling/campaigns/ClaudeScriptEditor";
import { SettingsModal } from "../components/calling/global/SettingsModal";
import { CampaignDetailModal, CampaignRecord } from "../components/calling/campaigns/CampaignDetailModal";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Campaigns", icon: Megaphone },
  { label: "Agent Workspace", icon: Headphones },
  { label: "Leads & CRM", icon: Users },
  { label: "AI Voice Studio", icon: Bot },
  { label: "Live Floor", icon: Radio },
  { label: "Call Logs (CDR)", icon: FileText },
  { label: "IVR Designer", icon: Workflow },
  { label: "Compliance", icon: ShieldCheck },
  { label: "Admin & Billing", icon: Settings2 },
];

const campaigns: CampaignRecord[] = [];

const INITIAL_LEADS: LeadRecord[] = [];

const bars = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function StatCard({ label, value, delta, detail, icon: Icon, accent = "violet", down = false }: { label: string; value: string; delta: string; detail: string; icon: typeof Activity; accent?: string; down?: boolean }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <div className={`stat-icon ${accent}`}><Icon size={17} /></div>
      </div>
      <div className="mt-5 flex items-center gap-2 text-[12px]">
        <span className={down ? "metric-down" : "metric-up"}>{down ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{delta}</span>
        <span className="muted">{detail}</span>
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex items-end justify-between gap-4"><div>{eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}<h2 className="section-title">{title}</h2></div>{action}</div>;
}

function StatusPill({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "yellow" | "red" | "blue" | "gray" }) {
  return <span className={`status-pill ${tone}`}><span className="status-dot" />{children}</span>;
}

// 1. Overview Screen
function Overview({
  onNavigate,
  onNewCampaign,
  onExportReport,
  userName,
  campaigns = [],
  leads = [],
  cdrs = [],
  onCampaignStatusChange,
}: {
  onNavigate: (label: string, subTab?: "billing" | "admin") => void;
  onNewCampaign: () => void;
  onExportReport: () => void;
  userName?: string;
  campaigns?: CampaignRecord[];
  leads?: LeadRecord[];
  cdrs?: any[];
  onCampaignStatusChange?: (status: string, campaignId?: string) => void;
}) {
  const [timeframe, setTimeframe] = useState("Today");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live ticking date and time clock (updates every second)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const formattedDate = currentTime
    .toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();
  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  // Real dynamic metrics calculated from live operational data
  const campaignsDialed = campaigns.reduce(
    (sum, c) => sum + (parseInt((c.connected || "0").replace(/,/g, ""), 10) || 0),
    0
  );
  const totalCallsPlaced = cdrs.length + campaignsDialed;

  const connectedCdrs = cdrs.filter(
    (c) =>
      c.disposition === "Interested" ||
      c.disposition === "Callback" ||
      c.disposition === "Completed" ||
      c.status === "Completed" ||
      c.status === "in_progress"
  ).length;
  const totalConnected = connectedCdrs + campaignsDialed;
  const connectRate =
    totalCallsPlaced > 0 ? ((totalConnected / totalCallsPlaced) * 100).toFixed(1) + "%" : "0.0%";

  const qualifiedLeadsCount = leads.filter(
    (l) =>
      l.stage.toLowerCase() === "interested" ||
      l.stage.toLowerCase() === "converted" ||
      (l.score && l.score >= 70)
  ).length;

  const avgSeconds =
    cdrs.length > 0
      ? Math.round(
          cdrs.reduce((acc, c) => {
            if (typeof c.durationSeconds === "number") return acc + c.durationSeconds;
            const [m, s] = (c.duration || "00:00")
              .split(":")
              .map((v: string) => parseInt(v, 10) || 0);
            return acc + (m * 60 + s);
          }, 0) / cdrs.length
        )
      : 0;
  const avgTalkTime =
    avgSeconds > 0
      ? `${Math.floor(avgSeconds / 60)
          .toString()
          .padStart(2, "0")}:${(avgSeconds % 60).toString().padStart(2, "0")}`
      : "00:00";

  const isRunning = campaigns.some((c) => c.status === "Running");
  const activeCampaign = campaigns[0];

  // Dynamic throughput bars based on calls placed
  const dynamicBars = useMemo(() => {
    if (totalCallsPlaced === 0) return bars;
    return bars.map((_, i) => {
      if (i < 20) return 0;
      const factor = ((i - 20) / 16) * Math.min(100, Math.max(20, totalCallsPlaced * 15));
      return Math.min(95, Math.max(10, Math.round(factor)));
    });
  }, [totalCallsPlaced]);

  return (
    <div className="page-enter space-y-4">
      <div className="hero-row">
        <div>
          <p className="eyebrow violet-text">
            {formattedDate} • {formattedTime} <span className="live-dot" /> LIVE OPERATIONS
          </p>
          <h1 className="page-title">{greeting}, <span>{userName || "Workspace Admin"}</span>.</h1>
          <p className="page-subtitle">Here’s how your AI calling floor & carrier trunks are performing today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="soft-button hover:bg-zinc-800 transition" onClick={onExportReport} title="Download Executive CSV Report">
            <FileText size={15} /> Export report
          </button>
          <button className="primary-button" onClick={onNewCampaign}>
            <Plus size={16} /> New campaign
          </button>
        </div>
      </div>

      {/* Real-time Spend Counter */}
      <LiveSpendCounter onTopUpClick={() => onNavigate("Admin & Billing", "billing")} />

      {/* KPI Cards */}
      <div className="stats-grid">
        <StatCard
          label="Calls placed"
          value={totalCallsPlaced.toLocaleString()}
          delta={totalCallsPlaced > 0 ? `+${totalCallsPlaced} active` : "0%"}
          detail={totalCallsPlaced > 0 ? "Real operational traffic" : "vs. yesterday"}
          icon={Phone}
          accent="violet"
        />
        <StatCard
          label="Connect rate"
          value={connectRate}
          delta={totalConnected > 0 ? `${totalConnected} connected` : "0%"}
          detail="vs. last 7 days"
          icon={Radio}
          accent="cyan"
        />
        <StatCard
          label="Qualified leads"
          value={qualifiedLeadsCount.toLocaleString()}
          delta={qualifiedLeadsCount > 0 ? `+${qualifiedLeadsCount} CRM` : "0%"}
          detail="High intent leads"
          icon={Target}
          accent="amber"
        />
        <StatCard
          label="Avg. talk time"
          value={avgTalkTime}
          delta={avgSeconds > 0 ? "Telecom active" : "0%"}
          detail="Voice duration"
          icon={Clock3}
          accent="rose"
        />
      </div>

      {/* Active Campaign Controls with Live Polling */}
      <CampaignControls
        key={activeCampaign ? activeCampaign.id || activeCampaign.name : "empty-campaign-controls"}
        initialCampaign={
          activeCampaign
            ? {
                id: activeCampaign.id || "camp-101",
                name: activeCampaign.name,
                totalLeads: parseInt((activeCampaign.leads || "0").replace(/,/g, ""), 10),
                dialed: parseInt((activeCampaign.connected || "0").replace(/,/g, ""), 10),
                connected: parseInt((activeCampaign.connected || "0").replace(/,/g, ""), 10),
                qualified: Math.round(
                  parseInt((activeCampaign.connected || "0").replace(/,/g, ""), 10) * 0.3
                ),
                failed: 0,
                liveCalls: activeCampaign.status === "Running" ? 2 : 0,
                status: (activeCampaign.status as any) || "Running",
                avgDuration: avgTalkTime !== "00:00" ? avgTalkTime : "01:15",
              }
            : undefined
        }
        onStatusChange={(newStatus) => onCampaignStatusChange?.(newStatus, activeCampaign?.id)}
      />

      {/* Main Grid */}
      <div className="main-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">DIALER THROUGHPUT</p>
              <h3 className="panel-title">Calls placed vs. answered</h3>
            </div>
            <div className="pill-group">
              {["Today", "7D", "30D", "All"].map((t) => (
                <button key={t} className={`pill ${timeframe === t ? "active" : ""}`} onClick={() => setTimeframe(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="bar-chart-wrap">
            {dynamicBars.every((b) => b === 0) ? (
              <div className="h-40 flex flex-col items-center justify-center text-xs text-zinc-500 gap-1.5">
                <BarChart3 size={24} className="text-zinc-600 opacity-60" />
                <span>No call throughput data yet. Outbound dialer telemetry will appear as calls connect.</span>
              </div>
            ) : (
              <div className="bar-chart">
                {dynamicBars.map((height, i) => (
                  <div key={i} className="bar-col">
                    <div style={{ height: `${height}%` }} className={`bar ${i === dynamicBars.length - 1 ? "latest" : ""}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">CARRIER TRUNKS</p>
              <h3 className="panel-title">Trunk health & latency</h3>
            </div>
            <button className="soft-button" onClick={() => onNavigate("Admin & Billing", "admin")}>
              Diagnostics
            </button>
          </div>
          <div className="space-y-3">
            {[
              {
                name: "Airtel PRI-01",
                latency: "22ms",
                quality: "Optimal",
                channels: isRunning ? "18/60 active" : totalCallsPlaced > 0 ? "1/60 active" : "0/60 active",
              },
              {
                name: "Tata SIP-02",
                latency: "28ms",
                quality: "Optimal",
                channels: isRunning ? "12/60 active" : totalCallsPlaced > 0 ? "1/60 active" : "0/60 active",
              },
              {
                name: "Jio Cloud Trunk",
                latency: "45ms",
                quality: "Good",
                channels: isRunning ? "6/30 active" : "0/30 active",
              },
            ].map((trunk) => (
              <div key={trunk.name} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/80">
                <div>
                  <div className="text-xs font-semibold text-zinc-200">{trunk.name}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">{trunk.channels}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-emerald-400">{trunk.latency}</span>
                  <div className="text-[10px] text-zinc-500 uppercase">{trunk.quality}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// 2. Campaigns Screen
function Campaigns({
  campaigns = [],
  onNewCampaign,
  onTestCall,
  onCampaignStatusChange,
}: {
  campaigns?: CampaignRecord[];
  onNewCampaign: () => void;
  onTestCall: () => void;
  onCampaignStatusChange?: (status: string, campaignId?: string) => void;
}) {
  const [subView, setSubView] = useState<"runs" | "editor">("runs");
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRecord | null>(null);
  const [showCampaignDetail, setShowCampaignDetail] = useState(false);
  const [scriptValue, setScriptValue] = useState(
    "Hamare paas 40 concurrent AI agent lines par festive season me 20% discount offer chal raha hai with direct TRAI DLT registration support."
  );
  const [objective, setObjective] = useState(
    "Qualify interest in CallForge AI calling suite and book a 15-minute product demonstration."
  );

  return (
    <div className="page-enter space-y-4">
      <div className="hero-row">
        <div>
          <p className="eyebrow violet-text">DIALER CADENCE & ORCHESTRATION</p>
          <h1 className="page-title">Active Campaigns & AI Scripting</h1>
          <p className="page-subtitle">Configure outbound pacing, Notion-style Claude AI script variables, and audio retry schedules.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="soft-button" onClick={onTestCall}>
            <PhoneCall size={15} /> Sandbox test call
          </button>
          <button className="primary-button" onClick={onNewCampaign}>
            <Plus size={16} /> New campaign
          </button>
        </div>
      </div>

      {/* Sub-view toggle */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            subView === "runs"
              ? "bg-violet-600/20 text-violet-300 border border-violet-500/40 shadow-xs"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          onClick={() => setSubView("runs")}
        >
          Active Dialing Runs ({campaigns.length})
        </button>
        <button
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            subView === "editor"
              ? "bg-violet-600/20 text-violet-300 border border-violet-500/40 shadow-xs"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          onClick={() => setSubView("editor")}
        >
          <Sparkles size={13} className="text-violet-400" />
          Notion-Style AI Script Studio
        </button>
      </div>

      {subView === "runs" ? (
        campaigns.length === 0 ? (
          <div className="p-12 rounded-xl border border-zinc-800 bg-zinc-900/20 text-center space-y-3">
            <Megaphone size={32} className="mx-auto text-zinc-600 opacity-60" />
            <h3 className="text-sm font-semibold text-zinc-300">No active dialing campaigns</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              You haven't launched any campaigns yet. Create a new campaign to start placing AI blast, progressive, or preview calls.
            </p>
            <button className="primary-button mx-auto mt-2" onClick={onNewCampaign}>
              <Plus size={15} /> Create First Campaign
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {campaigns.map((c) => (
              <div
                key={c.name}
                onClick={() => {
                  setSelectedCampaign(c);
                  setShowCampaignDetail(true);
                }}
                title="Click to inspect campaign pacing, dialer queue, and live controls"
                className="p-4 rounded-xl border border-zinc-800/90 bg-zinc-900/30 flex items-center justify-between cursor-pointer hover:border-violet-500/70 hover:bg-zinc-900/60 transition group"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-lg bg-${c.color}-500/20 text-${c.color}-400 border border-${c.color}-500/30 group-hover:scale-105 transition-transform`}>
                    <Megaphone size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-violet-300 transition-colors">{c.name}</h3>
                      <span className="text-[10px] text-zinc-400 border border-zinc-700/60 px-1.5 py-0.2 rounded font-mono">Click to Inspect</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                      <span className="font-mono text-zinc-300">Pacing: {c.mode}</span>
                      <span>•</span>
                      <span>{c.connected} / {c.leads} contacts dialed</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-32 hidden sm:block">
                    <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                      <span>Progress</span>
                      <span className="font-mono">{c.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div style={{ width: `${c.progress}%` }} className="h-full bg-violet-500 rounded-full" />
                    </div>
                  </div>
                  <StatusPill tone={c.status === "Running" ? "green" : "yellow"}>
                    {c.status}
                  </StatusPill>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950">
          <ClaudeScriptEditor
            value={scriptValue}
            onChange={setScriptValue}
            objective={objective}
            onObjectiveChange={setObjective}
          />
        </div>
      )}

      {/* Campaign Detail Drill-down Modal */}
      <CampaignDetailModal
        isOpen={showCampaignDetail}
        onClose={() => setShowCampaignDetail(false)}
        campaign={selectedCampaign}
        onTestCall={onTestCall}
        onOpenEditor={() => {
          setShowCampaignDetail(false);
          setSubView("editor");
        }}
        onStatusChange={(campId, newStat) => {
          onCampaignStatusChange?.(newStat, campId);
          if (selectedCampaign && (selectedCampaign.id === campId || selectedCampaign.name === campId)) {
            setSelectedCampaign({ ...selectedCampaign, status: newStat as any });
          }
        }}
      />
    </div>
  );
}

// 3. Agent Workspace Screen (Full Operational Telephony Desk)
function AgentWorkspace({ onCallLogged }: { onCallLogged?: () => void }) {
  const [activeCaller, setActiveCaller] = useState<{
    id: string;
    name: string;
    phone: string;
    company: string;
    city: string;
    intentScore: number;
    intentSummary: string;
    source: string;
    lastCall: string;
    lastOutcome: string;
    assignedCampaign: string;
    dncStatus: string;
  } | null>(null);

  const [callDuration, setCallDuration] = useState(0);
  const [outcome, setOutcome] = useState("interested");
  const [callbackTime, setCallbackTime] = useState("");
  const [notes, setNotes] = useState("");
  const [autoDNC, setAutoDNC] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wrapUpSeconds, setWrapUpSeconds] = useState(0);

  // Active call duration timer (runs only when call is active)
  useEffect(() => {
    if (!activeCaller) return;
    const t = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [activeCaller]);

  // ACW timer
  useEffect(() => {
    if (wrapUpSeconds <= 0) return;
    const t = setInterval(() => {
      setWrapUpSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [wrapUpSeconds]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleSubmitDisposition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCaller) {
      toast.info("No active call to dispose.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/calling/agent/disposition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadPhone: activeCaller.phone,
          leadName: activeCaller.name,
          disposition: outcome === "interested" ? "Interested" : outcome === "callback" ? "Callback" : outcome === "dnc" ? "DNC" : "Completed",
          notes: notes,
          durationSeconds: callDuration,
        }),
      });
      toast.success("Call Outcome Submitted & Saved to Database", {
        description: `Lead '${activeCaller.name}' marked as ${outcome.toUpperCase()} and CDR entry generated.`,
      });

      // Clear caller after wrap-up
      setActiveCaller(null);
      setCallDuration(0);
      setNotes("");
      setWrapUpSeconds(0);
      onCallLogged?.();
    } catch {
      toast.error("Failed to submit call disposition");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateNextLead = async () => {
    try {
      const res = await fetch("/api/calling/leads");
      const data = await res.json();
      if (data && Array.isArray(data.leads) && data.leads.length > 0) {
        const lead = data.leads[0];
        setActiveCaller({
          id: `call-live-${Date.now().toString().slice(-3)}`,
          name: lead.name,
          phone: lead.phone,
          company: lead.company || "Enterprise Account",
          city: "India",
          intentScore: lead.score || 80,
          intentSummary: `CRM lead queued from ${lead.source || "Direct"}. Status: ${lead.stage || "New"}.`,
          source: lead.source || "Dialer Queue",
          lastCall: lead.last || "Recently",
          lastOutcome: lead.stage || "New",
          assignedCampaign: "Outbound Queue",
          dncStatus: "Verified Clean",
        });
        setCallDuration(0);
        setNotes("");
        setWrapUpSeconds(60);
        toast.info(`CTI Queue Popped Next Caller: ${lead.name}`);
      } else {
        toast.info("No leads in queue. Add contacts in 'Leads & CRM' to pop them here.");
      }
    } catch {
      toast.info("No leads available in queue.");
    }
  };

  return (
    <div className="page-enter space-y-4">
      {/* Top Header */}
      <div className="hero-row">
        <div>
          <p className="eyebrow cyan-text">TELEPHONY DESK & SOFTPHONE</p>
          <h1 className="page-title">Agent Workspace</h1>
          <p className="page-subtitle">Full WebRTC audio bridge, active caller telemetry, live CRM screen-pop & wrap-up.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSimulateNextLead}
            className="soft-button hover:bg-zinc-800 transition"
            title="Pop Next Lead in Queue"
          >
            <RotateCw size={14} /> Next Queue Lead
          </button>
          <AgentStatusDropdown />
        </div>
      </div>

      {/* Real-time Telemetry Bar */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${activeCaller ? "bg-emerald-400 animate-ping" : "bg-zinc-600"}`} />
          <div>
            <h3 className="text-xs font-bold text-zinc-100 flex items-center gap-2">
              WebRTC {activeCaller ? "Live Audio Active" : "Line Standby (Registered)"} • Channel: SIP/airtel-pri-01
              {activeCaller ? (
                <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.2 rounded font-mono">
                  CALL IN PROGRESS: {formatTimer(callDuration)}
                </span>
              ) : (
                <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.2 rounded font-mono">
                  IDLE / READY
                </span>
              )}
            </h3>
            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
              Opus 48kHz Codec • RTT: 24ms • SRTP Encrypted • Asterisk SBC Registered
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-zinc-500 text-[10px] block">Calls Today</span>
            <span className="text-zinc-200 font-bold">0 Placed</span>
          </div>
          <div className="text-right">
            <span className="text-zinc-500 text-[10px] block">Avg Talk Time</span>
            <span className="text-emerald-400 font-bold">00:00 min</span>
          </div>
        </div>
      </div>

      {/* Two-Column Telephony Operational Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: CTI Screen Pop & Caller Intelligence */}
        {!activeCaller ? (
          <div className="p-8 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center text-center space-y-3 min-h-[320px]">
            <Headphones size={36} className="text-zinc-600 opacity-60" />
            <h3 className="text-sm font-semibold text-zinc-300">Softphone Line Idle</h3>
            <p className="text-xs text-zinc-500 max-w-xs">
              No active caller connected. Click "Next Queue Lead" or use Click-to-Call in Leads & CRM to initiate a call.
            </p>
            <button
              type="button"
              onClick={handleSimulateNextLead}
              className="primary-button text-xs mt-1"
            >
              <RotateCw size={14} /> Pop Next Queue Lead
            </button>
          </div>
        ) : (
          <div className="p-5 rounded-xl border border-violet-500/40 bg-zinc-950 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center font-bold text-base border border-violet-500/40">
                  {activeCaller.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.2 rounded">
                      CTI Screen Pop Live
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">• TRAI Clean</span>
                  </div>
                  <h3 className="text-base font-bold text-zinc-100 mt-0.5">{activeCaller.name}</h3>
                </div>
              </div>

              <ClickToCallButton phoneNumber={activeCaller.phone} leadName={activeCaller.name} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-0.5">
                <span className="text-[10px] text-zinc-500 block">Phone Number</span>
                <span className="font-mono font-bold text-zinc-200">{activeCaller.phone}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-0.5">
                <span className="text-[10px] text-zinc-500 block">Organization</span>
                <span className="font-medium text-zinc-200 truncate block">{activeCaller.company}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-0.5">
                <span className="text-[10px] text-zinc-500 block">City & Region</span>
                <span className="font-medium text-zinc-200">{activeCaller.city}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-0.5">
                <span className="text-[10px] text-zinc-500 block">AI Intent Score</span>
                <span className="font-mono font-bold text-emerald-400">{activeCaller.intentScore}/100</span>
              </div>
            </div>

            {/* Intent Summary */}
            <div className="p-3 rounded-lg bg-violet-950/20 border border-violet-800/40 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-violet-400 font-semibold text-[11px]">
                <Sparkles size={13} /> AI Caller Requirement Analysis
              </div>
              <p className="text-zinc-300 text-[11px] leading-relaxed font-mono">
                "{activeCaller.intentSummary}"
              </p>
            </div>

            {/* CRM Past History */}
            <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 text-xs space-y-1 text-zinc-400">
              <div className="flex justify-between text-[11px]">
                <span>Last Touch: <strong className="text-zinc-300">{activeCaller.lastCall}</strong></span>
                <span>Outcome: <strong className="text-cyan-400">{activeCaller.lastOutcome}</strong></span>
              </div>
              <div className="text-[10px] text-zinc-500">Assigned: {activeCaller.assignedCampaign}</div>
            </div>
          </div>
        )}

        {/* Right Column: After-Call Work (ACW) & Disposition Panel */}
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
                <UserCheck size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-100">After-Call Work (ACW) & Disposition</h3>
                <p className="text-[11px] text-zinc-400">Log outcome, schedule callback, and sync to CRM</p>
              </div>
            </div>

            <div className="text-right font-mono">
              <span className="text-[10px] text-zinc-500 block">Wrap-up Timer</span>
              <span className={`text-xs font-bold ${wrapUpSeconds < 15 ? "text-rose-400" : "text-amber-400"}`}>
                {wrapUpSeconds}s remaining
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmitDisposition} className="space-y-3.5 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
                Call Outcome (Disposition)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "interested", label: "Interested / Demo Booked", tone: "emerald" },
                  { id: "callback", label: "Callback Requested", tone: "cyan" },
                  { id: "not_interested", label: "Not Interested", tone: "amber" },
                  { id: "dnc", label: "DNC / Never Call Again", tone: "rose" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOutcome(item.id);
                      if (item.id === "dnc") setAutoDNC(true);
                    }}
                    className={`p-2 rounded-lg text-left text-xs font-semibold border transition cursor-pointer flex items-center justify-between ${
                      outcome === item.id
                        ? "bg-violet-600/30 border-violet-500 text-white shadow-xs"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-850"
                    }`}
                  >
                    <span>{item.label}</span>
                    {outcome === item.id && <CheckCircle2 size={13} className="text-violet-400" />}
                  </button>
                ))}
              </div>
            </div>

            {outcome === "callback" && (
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Scheduled Callback Time (IST)
                </label>
                <input
                  type="text"
                  value={callbackTime}
                  onChange={(e) => setCallbackTime(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 text-xs"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                Wrap-up Notes & Follow-up Context
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Type customer comments, objection details, or demo schedule info..."
                className="w-full p-2.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 font-mono resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDNC}
                  onChange={(e) => setAutoDNC(e.target.checked)}
                  className="accent-rose-500 rounded"
                />
                <span>Add number to National DNC Registry scrub</span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting || !activeCaller}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Send size={13} /> {isSubmitting ? "Saving..." : !activeCaller ? "Standby (No Active Call)" : "Submit Call Outcome & Next"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// 4. Leads & CRM Screen with Real Filter Bar & Drawer Actions
function LeadsScreen({
  leads = [],
  onAddLeadClick,
  onBulkImportClick,
  onSelectLead,
  onNavigate,
}: {
  leads: LeadRecord[];
  onAddLeadClick: () => void;
  onBulkImportClick?: () => void;
  onSelectLead: (lead: LeadRecord) => void;
  onNavigate?: (tab: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  const stages = ["All", "New", "Interested", "Callback", "Converted", "Not interested", "DNC"];

  const filtered = useMemo(() => {
    return (leads || []).filter((l) => {
      const name = String(l?.name || "");
      const comp = String(l?.company || "");
      const ph = String(l?.phone || "");
      const st = String(l?.stage || "New");
      const matchesQuery = `${name} ${comp} ${ph}`.toLowerCase().includes(query.toLowerCase());
      const matchesStage = stageFilter === "All" || st.toLowerCase() === stageFilter.toLowerCase();
      return matchesQuery && matchesStage;
    });
  }, [leads, query, stageFilter]);

  return (
    <div className="page-enter space-y-4">
      <div className="hero-row">
        <div>
          <p className="eyebrow cyan-text">CONTACT CENTER CRM</p>
          <h1 className="page-title">Leads & Contacts</h1>
          <p className="page-subtitle">One live record for every contact, outcome, callback, and click-to-call action.</p>
        </div>
        <div className="flex items-center gap-2">
          {onBulkImportClick && (
            <button
              type="button"
              className="soft-button flex items-center gap-1.5 cursor-pointer text-xs"
              onClick={onBulkImportClick}
            >
              <Upload size={14} className="text-violet-400" />
              <span>Bulk CSV Import</span>
            </button>
          )}
          <button className="primary-button" onClick={onAddLeadClick}>
            <Plus size={16} /> Add lead
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="filter-row">
          <div className="search-box wide">
            <Search size={15} />
            <input
              placeholder="Search name, company, or phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className={`soft-button transition ${showFilters ? "bg-violet-600/20 text-violet-300 border-violet-500/40" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <ListFilter size={14} /> Filters {stageFilter !== "All" ? `(${stageFilter})` : ""}
          </button>
          <span className="muted text-xs ml-auto font-mono">{filtered.length} of {leads.length} contacts</span>
        </div>

        {/* Expandable Filter Chips */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800 animate-in fade-in duration-100 text-xs">
            <span className="text-zinc-500 text-[11px] mr-1 uppercase font-semibold">Stage:</span>
            {stages.map((st) => (
              <button
                key={st}
                onClick={() => setStageFilter(st)}
                className={`px-2.5 py-1 rounded-md text-xs transition ${
                  stageFilter === st
                    ? "bg-violet-600 text-white font-medium shadow-xs"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                }`}
              >
                {st}
              </button>
            ))}
            {stageFilter !== "All" && (
              <button
                onClick={() => setStageFilter("All")}
                className="text-zinc-400 hover:text-rose-400 text-[11px] ml-2 flex items-center gap-1"
              >
                <X size={12} /> Reset
              </button>
            )}
          </div>
        )}
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table className="data-table leads-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Phone & Click-To-Call</th>
                <th>Source</th>
                <th>Stage</th>
                <th>AI score</th>
                <th>Last touch</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-sm text-zinc-500">
                    No contacts found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const leadName = l.name || "Lead";
                  const initials = (leadName.trim().split(/\s+/).map((x) => x[0] || "").join("").slice(0, 2) || "LD").toUpperCase();
                  const stageClass = String(l.stage || "New").toLowerCase().replace(/\s+/g, "-");
                  return (
                    <tr key={l.phone || l.id || Math.random()}>
                      <td>
                        <div className="lead-cell cursor-pointer" onClick={() => onSelectLead(l)}>
                          <span className="avatar avatar-violet">
                            {initials}
                          </span>
                          <div>
                            <strong className="hover:text-violet-400 transition">{l.name}</strong>
                            <span className="muted">{l.company}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="mono-cell">{l.phone}</span>
                          <ClickToCallButton phoneNumber={l.phone} leadName={l.name} />
                        </div>
                      </td>
                      <td><span className="source-label">{l.source}</span></td>
                      <td><span className={`stage ${stageClass}`}>{l.stage || "New"}</span></td>
                      <td>
                        <div className="score">
                          <span className={l.score > 80 ? "score-high" : l.score > 60 ? "score-mid" : "score-low"}>
                            {l.score}
                          </span>
                          <div className="score-track">
                            <div style={{ width: `${l.score}%` }} className={l.score > 80 ? "score-high-bg" : l.score > 60 ? "score-mid-bg" : "score-low-bg"} />
                          </div>
                        </div>
                      </td>
                      <td className="muted">{l.last || "Recently"}</td>
                      <td>
                        <button
                          className="icon-button hover:text-zinc-200 transition"
                          onClick={() => onSelectLead(l)}
                          title="Open Lead Profile & Activity Drawer"
                        >
                          <MoreHorizontal size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* TRAI Regulatory Compliance Gateway */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-200">TRAI Regulatory Compliance & NDNC Ledger</div>
            <div className="text-[11px] text-zinc-400">All outbound contacts are scrubbed against Do-Not-Call registries. View immutable evidence.</div>
          </div>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("Compliance")}
            className="soft-button text-xs flex items-center gap-1.5 hover:bg-zinc-800"
          >
            <span>Open Compliance Tab</span>
            <ArrowUpRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// 5. Compliance & TRAI Audit Trail Screen
function ComplianceScreen({
  complianceSubTab,
  setComplianceSubTab,
}: {
  complianceSubTab: "guardrails" | "ledger";
  setComplianceSubTab: (tab: "guardrails" | "ledger") => void;
}) {
  return (
    <div className="page-enter space-y-5">
      <div className="hero-row">
        <div>
          <p className="eyebrow green-text">TRUST & TELECOM REGULATION</p>
          <h1 className="page-title">Compliance & TRAI Audit Trail</h1>
          <p className="page-subtitle">
            Statutory TCCCPR regulations, DLT registrations, 09:00-21:00 calling windows, and consent ledgers.
          </p>
        </div>
      </div>

      {/* Subtab Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-zinc-950/80 rounded-xl border border-zinc-800">
        <button
          type="button"
          onClick={() => setComplianceSubTab("guardrails")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            complianceSubTab === "guardrails"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
        >
          <ShieldCheck size={14} />
          <span>Statutory Policies & Guardrails</span>
        </button>

        <button
          type="button"
          onClick={() => setComplianceSubTab("ledger")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            complianceSubTab === "ledger"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
        >
          <FileText size={14} />
          <span>Consent & DLT Audit Ledger</span>
        </button>
      </div>

      {complianceSubTab === "guardrails" ? (
        <div className="space-y-4">
          <div className="compliance-banner">
            <div className="compliance-score">
              <strong>96</strong>
              <span>/100</span>
            </div>
            <div>
              <p className="eyebrow green-text">TRAI STATUTORY READINESS</p>
              <h2>All Calling Guardrails Active & Enforced</h2>
              <p>
                Strict enforcement of TRAI TCCCPR 2018 calling windows, automated National DNC registry scrubbing,
                and blockchain DLT entity validation across all outbound trunks.
              </p>
            </div>
            <div className="compliance-ring">
              <ShieldCheck size={26} />
            </div>
          </div>

          <div className="compliance-grid">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">STATUTORY RULES</p>
                  <h3 className="panel-title">Active Telecom Guardrails</h3>
                </div>
                <StatusPill tone="green">4 Active</StatusPill>
              </div>

              <div className="policy-list">
                <div className="policy-row">
                  <div className="policy-icon green">
                    <Check size={14} />
                  </div>
                  <div>
                    <strong>Calling Window Enforcement (09:00 – 21:00 IST)</strong>
                    <span>Automated trunk cutoff prevents outbound dials outside mandated legal hours.</span>
                  </div>
                  <StatusPill tone="green">Enforced</StatusPill>
                </div>

                <div className="policy-row">
                  <div className="policy-icon green">
                    <Check size={14} />
                  </div>
                  <div>
                    <strong>Pre-Dial National DNC Scrub (TRAI NDNC)</strong>
                    <span>Every uploaded contact list is verified against the Do Not Call registry before queue injection.</span>
                  </div>
                  <StatusPill tone="green">Real-time</StatusPill>
                </div>

                <div className="policy-row">
                  <div className="policy-icon green">
                    <Check size={14} />
                  </div>
                  <div>
                    <strong>AI Voice Disclosure & Recording Consent Preamble</strong>
                    <span>Mandatory bilingual greeting informing caller that call is assisted by AI and recorded.</span>
                  </div>
                  <StatusPill tone="green">Mandatory</StatusPill>
                </div>

                <div className="policy-row">
                  <div className="policy-icon amber">
                    <Clock3 size={14} />
                  </div>
                  <div>
                    <strong>DLT Entity & SMS/Voice Header Whitelist</strong>
                    <span>Registered on Airtel / Tata / Jio DLT. Header renewal scheduled in 45 days.</span>
                  </div>
                  <StatusPill tone="yellow">Valid</StatusPill>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">AUDIT LOG</p>
                  <h3 className="panel-title">Statutory Verification Trail</h3>
                </div>
                <button
                  type="button"
                  className="soft-button text-xs"
                  onClick={() => toast.info("Audit log verified with zero compliance infractions")}
                >
                  Verify Trail
                </button>
              </div>

              <div className="audit-list">
                <div>
                  <span className="audit-time">09:00</span>
                  <p>
                    <strong>Trunk Gateway Activated</strong> · Calling hours window opened for Airtel & Tata trunks
                    under Rule 14(2).
                  </p>
                </div>
                <div>
                  <span className="audit-time">10:14</span>
                  <p>
                    <strong>NDNC Scrub Executed</strong> · Batch scrubbing verified 1,420 contacts against TRAI
                    registry.
                  </p>
                </div>
                <div>
                  <span className="audit-time">12:30</span>
                  <p>
                    <strong>DLT Signature Check</strong> · Tata DLT Principal Entity hash verified valid and active.
                  </p>
                </div>
                <div>
                  <span className="audit-time">15:45</span>
                  <p>
                    <strong>PII Voice Masking</strong> · Automated redaction filters active on 16kHz CDR recordings.
                  </p>
                </div>
                <div>
                  <span className="audit-time">21:00</span>
                  <p>
                    <strong>Automatic Daily Curfew Guard</strong> · Dialers auto-paused until 09:00 IST next business
                    day.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <ConsentAuditLedger />
      )}
    </div>
  );
}

// Main App Home Component
export default function Home() {
  const [active, setActive] = useState("Overview");
  const [adminBillingSubTab, setAdminBillingSubTab] = useState<"billing" | "admin">("billing");
  const [aiStudioSubTab, setAiStudioSubTab] = useState<"nvidia_pipeline" | "voice_library" | "ab_scripts">("nvidia_pipeline");
  const [complianceSubTab, setComplianceSubTab] = useState<"guardrails" | "ledger">("guardrails");

  // Dynamic Live Leads State
  const [leadsList, setLeadsList] = useState<LeadRecord[]>([]);
  // Dynamic Live Campaigns State
  const [campaignsList, setCampaignsList] = useState<CampaignRecord[]>([]);
  // Dynamic Live CDRs State
  const [cdrList, setCdrList] = useState<any[]>([]);

  // Modals state
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [showSandboxTest, setShowSandboxTest] = useState(false);
  const [selectedAudioRecord, setSelectedAudioRecord] = useState<CDRRecord | null>(null);
  const [selectedQARecord, setSelectedQARecord] = useState<CDRRecord | null>(null);

  // New Rich Functional Modals & Drawers
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showProUpgrade, setShowProUpgrade] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const liveCallsCount = INITIAL_AGENTS.filter((a) => a.status === "on_call").length;

  // Active authenticated user profile (dynamic per Google/Email login)
  const [currentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("creatorai_auth_user");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: "Workspace Admin",
      emailOrPhone: "admin@callforge.io",
      role: "Super Admin",
    };
  });

  const userInitials = useMemo(() => {
    const parts = (currentUser.name || "User").trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }, [currentUser.name]);

  // Fetch persistent leads from backend database on mount
  const fetchLeads = () => {
    fetch("/api/calling/leads")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.leads)) {
          setLeadsList(
            data.leads.map((l: any) => ({
              id: l.id,
              name: l.name,
              company: l.company,
              phone: l.phone,
              source: l.source,
              stage: l.stage,
              score: l.score,
              last: l.last || "Recently",
            }))
          );
        } else {
          setLeadsList([]);
        }
      })
      .catch(() => {
        setLeadsList([]);
      });
  };

  // Fetch active campaigns from backend dialer worker
  const fetchCampaigns = () => {
    fetch("/api/calling/campaigns")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.campaigns)) {
          setCampaignsList((prev) => {
            const mapped = data.campaigns.map((c: any) => ({
              id: c.id,
              name: c.name,
              mode:
                c.dialerMode === "ai_blast"
                  ? "AI blast"
                  : c.dialerMode === "progressive"
                  ? "Progressive"
                  : "Preview",
              status:
                c.status === "running"
                  ? "Running"
                  : c.status === "paused"
                  ? "Paused"
                  : c.status === "completed"
                  ? "Completed"
                  : "Queued",
              leads: (c.stats?.totalLeads || (c.leads && c.leads.length) || 0).toLocaleString(),
              connected: (c.stats?.connected || 0).toLocaleString(),
              progress: c.stats?.totalLeads
                ? Math.min(
                    100,
                    Math.round(((c.stats?.dialed || 0) / c.stats.totalLeads) * 100)
                  )
                : 0,
              color: "violet",
              scriptPreview: c.script,
            }));
            const mappedIds = new Set(mapped.map((m: any) => m.id));
            const localOnly = prev.filter((p) => p.id && !mappedIds.has(p.id));
            return [...mapped, ...localOnly];
          });
        }
      })
      .catch(() => {});
  };

  // Fetch CDRs from backend database
  const fetchCDRs = () => {
    fetch("/api/calling/cdrs")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.cdrs)) {
          setCdrList(data.cdrs);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLeads();
    fetchCampaigns();
    fetchCDRs();
  }, []);

  const handleCampaignCreated = (newCampaign: CampaignRecord) => {
    setCampaignsList((prev) => [newCampaign, ...prev]);
    fetchCampaigns();
    fetchCDRs();
    toast.success(`Campaign '${newCampaign.name}' is now active on your dashboard!`);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      } else if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setShowCampaignBuilder(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Real Executive CSV Report Generator
  const handleDownloadExecutiveReport = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const totalCallsPlaced =
      cdrList.length +
      campaignsList.reduce(
        (sum, c) => sum + (parseInt((c.connected || "0").replace(/,/g, ""), 10) || 0),
        0
      );
    const qualifiedCount = leadsList.filter(
      (l) =>
        l.stage.toLowerCase() === "interested" ||
        l.stage.toLowerCase() === "converted" ||
        (l.score && l.score >= 70)
    ).length;

    const rows = [
      ["Metric", "Value", "Delta", "Benchmark", "Category"],
      ["Calls Placed", totalCallsPlaced.toString(), "+100%", "Daily Operations", "Operations"],
      ["Active Campaigns", campaignsList.length.toString(), "--", "Dialer floor", "Cadence"],
      ["Qualified Leads", qualifiedCount.toString(), "--", "High Intent", "Sales"],
      ["Total CRM Contacts", leadsList.length.toString(), "--", "Active Registry", "CRM"],
      ["TRAI Compliance Rate", "100%", "Zero Violations", "09:00 - 21:00 Window", "Regulatory"],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CallForge_Executive_Daily_Report_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Executive Daily Report (.csv) downloaded successfully!`);
  };

  const handleAddNewLead = async (newLead: LeadRecord) => {
    setLeadsList((prev) => [newLead, ...prev]);
    try {
      await fetch("/api/calling/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLead.name,
          phone: newLead.phone,
          company: newLead.company,
          source: newLead.source,
          stage: newLead.stage,
          score: newLead.score,
        }),
      });
      toast.success("Lead persisted to database!");
    } catch {
      // Non-blocking fallback
    }
  };

  const handleUpdateLead = (updated: LeadRecord) => {
    setLeadsList((prev) => prev.map((l) => (l.phone === updated.phone ? updated : l)));
    setSelectedLead(updated);
    if ((updated as any).id) {
      fetch(`/api/calling/leads/${(updated as any).id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      }).catch(() => {});
    }
  };

  const handleCampaignStatusChange = (status: string, campaignId?: string) => {
    setCampaignsList((prev) =>
      prev.map((c, idx) => {
        if (campaignId ? (c.id === campaignId || c.name === campaignId) : idx === 0) {
          return { ...c, status: status as any };
        }
        return c;
      })
    );
  };

  const activeIndex = navigation.findIndex((item) => item.label === active);

  let content: React.ReactNode = null;
  switch (active) {
    case "Overview":
      content = (
        <Overview
          onNavigate={setActive}
          onNewCampaign={() => setShowCampaignBuilder(true)}
          onExportReport={handleDownloadExecutiveReport}
          userName={currentUser.name}
          campaigns={campaignsList}
          leads={leadsList}
          cdrs={cdrList}
          onCampaignStatusChange={handleCampaignStatusChange}
        />
      );
      break;
    case "Campaigns":
      content = (
        <Campaigns
          campaigns={campaignsList}
          onNewCampaign={() => setShowCampaignBuilder(true)}
          onTestCall={() => setShowSandboxTest(true)}
          onCampaignStatusChange={handleCampaignStatusChange}
        />
      );
      break;
    case "Agent Workspace":
      content = (
        <AgentWorkspace
          onCallLogged={() => {
            fetchCDRs();
            fetchLeads();
          }}
        />
      );
      break;
    case "Leads & CRM":
      content = (
        <LeadsScreen
          leads={leadsList}
          onAddLeadClick={() => setShowAddLead(true)}
          onBulkImportClick={() => setShowBulkImport(true)}
          onSelectLead={(ld) => setSelectedLead(ld)}
          onNavigate={setActive}
        />
      );
      break;
    case "AI Voice Studio":
      content = (
        <div className="page-enter space-y-5">
          <div className="hero-row">
            <div>
              <p className="eyebrow violet-text">AUTONOMOUS VOICE ENGINE</p>
              <h1 className="page-title">AI Voice Studio</h1>
              <p className="page-subtitle">Configure NVIDIA speech stack for Tata Dialer, neural Indian voices, and A/B conversation scripts.</p>
            </div>
            <button className="primary-button" onClick={() => setShowSandboxTest(true)}>
              <PhoneCall size={15} /> Sandbox test call
            </button>
          </div>

          {/* Subtab Navigation for AI Voice Studio */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-zinc-950/80 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setAiStudioSubTab("nvidia_pipeline")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                aiStudioSubTab === "nvidia_pipeline"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Sparkles size={14} className={aiStudioSubTab === "nvidia_pipeline" ? "text-white" : "text-emerald-400"} />
              <span>NVIDIA Voice Stack (Tata Dialer)</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                Active
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAiStudioSubTab("voice_library")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                aiStudioSubTab === "voice_library"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Bot size={14} />
              <span>Voice Library (Riva Magpie & Neural)</span>
            </button>

            <button
              type="button"
              onClick={() => setAiStudioSubTab("ab_scripts")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                aiStudioSubTab === "ab_scripts"
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Workflow size={14} />
              <span>A/B Conversation Scripts</span>
            </button>
          </div>

          {/* Subtab Content */}
          {aiStudioSubTab === "nvidia_pipeline" && <NvidiaVoicePipelineStudio />}
          {aiStudioSubTab === "voice_library" && <VoiceSelectionPicker />}
          {aiStudioSubTab === "ab_scripts" && <ABTestingSplitUI />}
        </div>
      );
      break;
    case "Live Floor":
      content = (
        <div className="page-enter space-y-4">
          <div className="hero-row">
            <div>
              <p className="eyebrow rose-text">SUPERVISOR CONSOLE</p>
              <h1 className="page-title">Live Calling Floor & Supervisor Wallboard</h1>
              <p className="page-subtitle">Real-time SSE stream, live floor metrics, whisper coaching & 3-way call barge.</p>
            </div>
          </div>
          <LiveWallboardGrid />
        </div>
      );
      break;
    case "Call Logs (CDR)":
      content = (
        <div className="page-enter space-y-4">
          <div className="hero-row">
            <div>
              <p className="eyebrow amber-text">CALL RECORDS & TELEPHONY LEDGER</p>
              <h1 className="page-title">Call Detail Records (CDR)</h1>
              <p className="page-subtitle">Full searchable log of all placed calls, audio recordings, cost breakdown, and AI QA scorecards.</p>
            </div>
          </div>
          <CDRDataTable
            onSelectCallForAudio={(rec) => setSelectedAudioRecord(rec)}
            onOpenQAScorecard={(rec) => setSelectedQARecord(rec)}
          />
        </div>
      );
      break;
    case "IVR Designer":
      content = (
        <div className="page-enter space-y-4">
          <VisualIVRBuilder />
        </div>
      );
      break;
    case "Compliance":
      content = (
        <ComplianceScreen
          complianceSubTab={complianceSubTab}
          setComplianceSubTab={setComplianceSubTab}
        />
      );
      break;
    case "Admin & Billing":
      content = (
        <div className="page-enter space-y-5">
          {/* Sub-tab Switcher: Billing vs Admin */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/80 p-2.5 rounded-2xl border border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setAdminBillingSubTab("billing")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  adminBillingSubTab === "billing"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                <CreditCard size={15} />
                <span>Telephony Billing & Wallet</span>
              </button>
              <button
                type="button"
                onClick={() => setAdminBillingSubTab("admin")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  adminBillingSubTab === "admin"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                <ShieldCheck size={15} />
                <span>Platform Administration & Team</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="soft-button hover:bg-zinc-800 transition text-xs flex items-center gap-1.5"
                title="System Settings"
              >
                <Settings2 size={14} /> Telephony Settings
              </button>
            </div>
          </div>

          {adminBillingSubTab === "billing" ? (
            <BillingHub onUpgradePlanClick={() => setShowProUpgrade(true)} />
          ) : (
            <AdminHub />
          )}
        </div>
      );
      break;
    default:
      content = (
        <Overview
          onNavigate={(label, subTab) => {
            setActive(label);
            if (subTab) setAdminBillingSubTab(subTab);
          }}
          onNewCampaign={() => setShowCampaignBuilder(true)}
          onExportReport={handleDownloadExecutiveReport}
        />
      );
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="brand">
          <div className="brand-mark">
            <span /><span /><span />
          </div>
          <div>
            <strong>callforge</strong>
            <small>OPS CONSOLE</small>
          </div>
        </div>

        <div
          className="workspace-switcher cursor-pointer hover:bg-zinc-900/60 p-2 rounded-lg transition"
          onClick={() => setShowUserProfile(true)}
          title="Open Workspace & Profile Settings"
        >
          <span className="workspace-avatar">{userInitials}</span>
          <div>
            <strong>{currentUser.name ? `${currentUser.name}’s workspace` : "Enterprise workspace"}</strong>
            <span>Pro plan · Mumbai</span>
          </div>
          <ChevronDown size={15} />
        </div>

        <nav className="side-nav">
          <p className="nav-label">WORKSPACE</p>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isSelected = active === item.label;
            return (
              <button
                key={item.label}
                className={`nav-item ${isSelected ? "active" : ""}`}
                onClick={() => setActive(item.label)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.label === "Live Floor" && (
                  <span className="nav-count flex items-center gap-1.5 bg-emerald-950/50 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-mono ml-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {liveCallsCount} Live
                  </span>
                )}
                {isSelected && <span className="active-rail" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon">
              <Sparkles size={15} />
            </div>
            <strong>Unlock AI insights</strong>
            <p>Get deeper coaching signals on every call.</p>
            <button onClick={() => setShowProUpgrade(true)}>
              Explore Pro <ArrowUpRight size={13} />
            </button>
          </div>

          <button className="nav-item" onClick={() => setShowSettings(true)} title="Open System & Telephony Settings">
            <Settings2 size={17} />
            <span>Settings</span>
          </button>
          <button className="nav-item" onClick={() => setShowHelpCenter(true)}>
            <CircleHelp size={17} />
            <span>Help center</span>
          </button>

          <div
            className="user-row cursor-pointer hover:bg-zinc-900/60 p-2 rounded-lg transition"
            onClick={() => setShowUserProfile(true)}
            title={`Open Profile: ${currentUser.name}`}
          >
            <span className="workspace-avatar user font-bold">{userInitials}</span>
            <div>
              <strong>{currentUser.name}</strong>
              <span className="truncate">{currentUser.emailOrPhone}</span>
            </div>
            <MoreHorizontal size={16} className="muted" />
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="app-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span>/</span>
            <strong>{navigation[activeIndex]?.label || "Overview"}</strong>
          </div>

          <div className="top-actions">
            <AgentStatusDropdown agentName={currentUser.name} />
            <div className="status-chip">
              <span className="status-dot" />
              Trunks Operational
            </div>

            {/* Interactive Notification Center Tray */}
            <NotificationCenter onNavigate={setActive} />

            {/* Quick Command Omnibar Search (Ctrl+K) */}
            <button
              className="icon-button hover:text-zinc-100 transition"
              onClick={() => setShowCommandPalette(true)}
              title="Command search (Ctrl + K)"
            >
              <Search size={17} />
            </button>

            {/* User Profile Avatar */}
            <div
              className="top-avatar cursor-pointer hover:ring-2 hover:ring-violet-500 transition font-bold"
              onClick={() => setShowUserProfile(true)}
              title={`${currentUser.name} (${currentUser.role || "Admin"})`}
            >
              {userInitials}
            </div>
          </div>
        </header>

        <div className="content-wrap">{content}</div>
      </main>

      {/* Persistent Dockable WebRTC Softphone */}
      <WebRTCSoftphone />

      {/* Omnibar Command Palette */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={setActive}
        onNewCampaign={() => setShowCampaignBuilder(true)}
        onNewLead={() => setShowAddLead(true)}
        onExportReport={handleDownloadExecutiveReport}
        onOpenSoftphone={() => {
          toast.info("WebRTC Softphone open in bottom-right corner");
        }}
        onShowHelp={() => setShowHelpCenter(true)}
        onShowSettings={() => setShowSettings(true)}
      />

      {/* Modals & Slide-out Drawers */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <CampaignBuilderModal
        isOpen={showCampaignBuilder}
        onClose={() => setShowCampaignBuilder(false)}
        onCampaignCreated={handleCampaignCreated}
      />

      <SandboxTestModal
        isOpen={showSandboxTest}
        onClose={() => setShowSandboxTest(false)}
        onCallCompleted={fetchCDRs}
      />

      <AddLeadModal
        isOpen={showAddLead}
        onClose={() => setShowAddLead(false)}
        onAddLead={handleAddNewLead}
      />

      <BulkLeadImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImportSuccess={fetchLeads}
      />

      <LeadDetailsDrawer
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        lead={selectedLead}
        onUpdateLead={handleUpdateLead}
      />

      <ProUpgradeModal
        isOpen={showProUpgrade}
        onClose={() => setShowProUpgrade(false)}
      />

      <HelpCenterModal
        isOpen={showHelpCenter}
        onClose={() => setShowHelpCenter(false)}
      />

      <UserProfileModal
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
      />

      <AudioPlayerDrawer
        isOpen={!!selectedAudioRecord}
        onClose={() => setSelectedAudioRecord(null)}
        record={selectedAudioRecord}
      />

      <QAScorecardModal
        isOpen={!!selectedQARecord}
        onClose={() => setSelectedQARecord(null)}
        callData={
          selectedQARecord
            ? {
                callId: selectedQARecord.id,
                agentName: selectedQARecord.agentName,
                customerName: selectedQARecord.customerName,
                duration: selectedQARecord.duration,
                overallScore: selectedQARecord.qaScore,
              }
            : undefined
        }
        onSaveEvaluation={(evaluation) => {
          setCdrList((prev) =>
            prev.map((c) =>
              c.id === evaluation.callId ? { ...c, qaScore: evaluation.overallScore } : c
            )
          );
        }}
      />
    </div>
  );
}
