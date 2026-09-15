import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
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
  Zap,
  Workflow,
  CreditCard,
  PhoneCall,
  Shield,
} from "lucide-react";

// Calling Component Imports (All 8 Categories)
import { CampaignBuilderModal } from "../components/calling/campaigns/CampaignBuilderModal";
import { CampaignControls } from "../components/calling/campaigns/CampaignControls";
import { SandboxTestModal } from "../components/calling/campaigns/SandboxTestModal";
import { WebRTCSoftphone } from "../components/calling/agent/WebRTCSoftphone";
import { AgentStatusDropdown } from "../components/calling/agent/AgentStatusDropdown";
import { LiveWallboardGrid } from "../components/calling/supervisor/LiveWallboardGrid";
import { CDRDataTable, CDRRecord } from "../components/calling/supervisor/CDRDataTable";
import { QAScorecardModal } from "../components/calling/supervisor/QAScorecardModal";
import { AudioPlayerDrawer } from "../components/calling/global/AudioPlayerDrawer";
import { VisualIVRBuilder } from "../components/calling/global/VisualIVRBuilder";
import { DisabledStateGuard } from "../components/calling/global/DisabledStateGuard";
import { LiveSpendCounter } from "../components/calling/billing/LiveSpendCounter";
import { AutoRechargeConfig } from "../components/calling/billing/AutoRechargeConfig";
import { VoiceSelectionPicker } from "../components/calling/ai/VoiceSelectionPicker";
import { ABTestingSplitUI } from "../components/calling/ai/ABTestingSplitUI";
import { ClickToCallButton } from "../components/calling/crm/ClickToCallButton";
import { ConsentAuditLedger } from "../components/calling/crm/ConsentAuditLedger";
import { RoleManagementUI } from "../components/calling/admin/RoleManagementUI";
import { SystemStatusPage } from "../components/calling/admin/SystemStatusPage";

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

const campaigns = [
  { name: "Festive season follow-up", mode: "AI blast", status: "Running", leads: "2,480", connected: "842", progress: 68, color: "violet" },
  { name: "Enterprise renewal desk", mode: "Progressive", status: "Running", leads: "860", connected: "318", progress: 41, color: "cyan" },
  { name: "Inbound demo callbacks", mode: "Preview", status: "Paused", leads: "320", connected: "127", progress: 26, color: "amber" },
];

const leads = [
  { name: "Aarav Mehta", company: "Northstar Foods", phone: "+91 99887 11002", source: "Website", stage: "Interested", score: 88, last: "2 min ago" },
  { name: "Neha Iyer", company: "Bloom Retail", phone: "+91 97654 30781", source: "Meta Ads", stage: "Callback", score: 74, last: "8 min ago" },
  { name: "Kabir Singh", company: "Suncore Energy", phone: "+91 98990 48210", source: "Referral", stage: "New", score: 66, last: "16 min ago" },
  { name: "Ishita Rao", company: "Mango Tree Labs", phone: "+91 98731 22912", source: "Landing page", stage: "Converted", score: 94, last: "24 min ago" },
  { name: "Vikram Shah", company: "Bharat Machines", phone: "+91 98203 55180", source: "Import", stage: "Not interested", score: 38, last: "31 min ago" },
];

const bars = [42, 58, 48, 64, 72, 68, 82, 76, 88, 78, 91, 84, 96, 89, 100, 91, 97, 88, 94, 82, 90, 80, 86, 73, 76, 69, 78, 62, 71, 56, 66, 48, 58, 42, 53, 38];

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
function Overview({ onNavigate, onNewCampaign }: { onNavigate: (label: string) => void; onNewCampaign: () => void }) {
  const [timeframe, setTimeframe] = useState("Today");
  return (
    <div className="page-enter space-y-4">
      <div className="hero-row">
        <div>
          <p className="eyebrow violet-text">
            TUESDAY, 15 SEPTEMBER 2026 <span className="live-dot" /> LIVE OPERATIONS
          </p>
          <h1 className="page-title">Good evening, <span>Arjun</span>.</h1>
          <p className="page-subtitle">Here’s how your AI calling floor & carrier trunks are performing today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="soft-button" onClick={() => toast.success("Daily report CSV queued for export")}>
            <FileText size={15} /> Export report
          </button>
          <button className="primary-button" onClick={onNewCampaign}>
            <Plus size={16} /> New campaign
          </button>
        </div>
      </div>

      {/* Real-time Spend Counter */}
      <LiveSpendCounter onTopUpClick={() => onNavigate("Admin & Billing")} />

      {/* KPI Cards */}
      <div className="stats-grid">
        <StatCard label="Calls placed" value="3,682" delta="18.4%" detail="vs. yesterday" icon={Phone} accent="violet" />
        <StatCard label="Connect rate" value="42.8%" delta="6.2%" detail="vs. last 7 days" icon={Radio} accent="cyan" />
        <StatCard label="Qualified leads" value="286" delta="12.6%" detail="vs. yesterday" icon={Target} accent="amber" />
        <StatCard label="Avg. talk time" value="03:48" delta="0.8%" detail="vs. last 7 days" icon={Clock3} accent="rose" down />
      </div>

      {/* Active Campaign Controls with Live Polling */}
      <CampaignControls />

      {/* Main Grid */}
      <div className="main-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">ACTIVITY PULSE</p>
              <h2 className="section-title">Calls over time</h2>
            </div>
            <div className="segmented">
              {["Today", "7 days", "30 days"].map((item) => (
                <button key={item} className={timeframe === item ? "active" : ""} onClick={() => setTimeframe(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-meta">
            <span className="chart-total">12,842 <small>total calls</small></span>
            <span className="legend"><i className="legend-line" /> Connected <i className="legend-line faint" /> Dialed</span>
          </div>
          <div className="bar-chart" aria-label="Calls over time chart">
            {bars.map((height, i) => (
              <div key={i} className={`bar ${i % 5 === 0 ? "highlight" : ""}`} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className="chart-axis">
            <span>06:00</span><span>09:00</span><span>12:00</span><span>15:00</span><span>18:00</span><span>21:00</span>
          </div>
        </section>

        <section className="panel live-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">RIGHT NOW</p>
              <h2 className="section-title">Live floor overview</h2>
            </div>
            <button className="icon-button" onClick={() => onNavigate("Live Floor")}>
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="floor-number">
            <strong>24</strong><span>active calls</span>
            <span className="floor-badge"><span className="status-dot" /> 9 AI agents</span>
          </div>
          <div className="mini-metrics">
            <div><span>Agents online</span><strong>18 / 24</strong></div>
            <div><span>Queue waiting</span><strong>07</strong></div>
            <div><span>Service level</span><strong className="cyan-text">94.2%</strong></div>
          </div>
          <div className="agent-stack">
            <div className="avatar-stack">
              <span className="avatar avatar-violet">AS</span>
              <span className="avatar avatar-cyan">RK</span>
              <span className="avatar avatar-amber">PM</span>
              <span className="avatar avatar-rose">VN</span>
              <span className="avatar avatar-more">+14</span>
            </div>
            <span className="muted text-xs">3 supervisors monitoring</span>
          </div>
          <button className="full-width-button" onClick={() => onNavigate("Live Floor")}>
            <Radio size={14} /> Open Supervisor Wallboard
          </button>
        </section>
      </div>
    </div>
  );
}

// 2. Campaigns Screen
function Campaigns({ onNewCampaign, onTestCall }: { onNewCampaign: () => void; onTestCall: () => void }) {
  const [status, setStatus] = useState("All campaigns");
  return (
    <div className="page-enter space-y-4">
      <div className="hero-row">
        <div>
          <p className="eyebrow violet-text">OUTBOUND ENGINE</p>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Orchestrate every list, retry rule, caller ID, and AI assistant from one place.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="soft-button" onClick={onTestCall}>
            <PhoneCall size={15} /> Sandbox test dial
          </button>
          <button className="primary-button" onClick={onNewCampaign}>
            <Plus size={16} /> New campaign
          </button>
        </div>
      </div>

      <CampaignControls />

      <div className="filter-row">
        <div className="search-box">
          <Search size={15} />
          <input placeholder="Search campaigns" />
        </div>
        <div className="filter-select">
          <Filter size={14} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>All campaigns</option>
            <option>Running</option>
            <option>Paused</option>
            <option>Draft</option>
          </select>
          <ChevronDown size={14} />
        </div>
        <span className="muted text-xs ml-auto">3 campaigns · refreshed just now</span>
      </div>

      <div className="campaign-cards">
        {campaigns.map((c) => (
          <div className="campaign-card" key={c.name}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className={`campaign-mark large ${c.color}`} />
                <div>
                  <h3>{c.name}</h3>
                  <p className="muted">{c.mode} · India / IST (09:00–21:00)</p>
                </div>
              </div>
              <StatusPill tone={c.status === "Running" ? "green" : "yellow"}>{c.status}</StatusPill>
            </div>
            <div className="campaign-card-metrics">
              <div><span>Leads dialled</span><strong>{c.leads}</strong></div>
              <div><span>Connected</span><strong>{c.connected}</strong></div>
              <div><span>Avg. talk time</span><strong>03:42</strong></div>
            </div>
            <div className="progress-wrap full">
              <div className="progress-track">
                <div className={`progress-fill ${c.color}`} style={{ width: `${c.progress}%` }} />
              </div>
              <span>{c.progress}% complete</span>
            </div>
            <div className="campaign-card-footer">
              <span className="muted"><Phone size={13} /> Caller ID · +91 140 22 8041</span>
              <button className="text-button" onClick={onTestCall}>
                Test call <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Agent Workspace Screen
function AgentWorkspace() {
  return (
    <div className="page-enter space-y-4">
      <div className="hero-row">
        <div>
          <p className="eyebrow violet-text">OPERATOR COCKPIT</p>
          <h1 className="page-title">Agent Workspace</h1>
          <p className="page-subtitle">Your active WebRTC telephony terminal with automatic CTI screen-pop & wrap-up tagging.</p>
        </div>
        <AgentStatusDropdown />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/70 md:col-span-2 space-y-3">
          <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Browser WebRTC Terminal Ready</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your browser audio stream is bound to the high-concurrency SIP/WebRTC gateway. When incoming calls arrive or progressive outbound dialing matches, a CTI screen-pop panel will automatically slide in with caller context.
          </p>
          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-300">Microphone & Opus Audio:</span>
            <span className="text-emerald-400 font-mono font-semibold">Active (48kHz)</span>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-violet-800/40 bg-violet-950/20 space-y-2">
          <span className="text-[10px] uppercase font-bold text-violet-300 block">Softphone Available</span>
          <h4 className="text-xs font-bold text-zinc-100">Floating Softphone Dock</h4>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Click the WebRTC widget in the bottom-right corner anytime to dial numbers, toggle mute/hold, or simulate incoming rings.
          </p>
        </div>
      </div>
    </div>
  );
}

// 4. Leads & CRM Screen
function LeadsScreen() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => leads.filter((l) => `${l.name} ${l.company} ${l.phone}`.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  return (
    <div className="page-enter space-y-4">
      <div className="hero-row">
        <div>
          <p className="eyebrow cyan-text">CONTACT CENTER CRM</p>
          <h1 className="page-title">Leads & Contacts</h1>
          <p className="page-subtitle">One live record for every contact, outcome, callback, and click-to-call action.</p>
        </div>
        <button className="primary-button" onClick={() => toast.success("New lead form opened")}>
          <Plus size={16} /> Add lead
        </button>
      </div>

      <div className="filter-row">
        <div className="search-box wide">
          <Search size={15} />
          <input placeholder="Search name, company, or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="soft-button">
          <ListFilter size={14} /> Filters
        </button>
        <span className="muted text-xs ml-auto">{filtered.length} of 18,420 contacts</span>
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
              {filtered.map((l) => (
                <tr key={l.phone}>
                  <td>
                    <div className="lead-cell">
                      <span className="avatar avatar-violet">
                        {l.name.split(" ").map((x) => x[0]).join("")}
                      </span>
                      <div>
                        <strong>{l.name}</strong>
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
                  <td><span className={`stage ${l.stage.toLowerCase().replace(" ", "-")}`}>{l.stage}</span></td>
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
                  <td className="muted">{l.last}</td>
                  <td>
                    <button className="icon-button" onClick={() => toast.info(`Opening ${l.name}'s lead record`)}>
                      <MoreHorizontal size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Consent Audit Ledger below leads */}
      <ConsentAuditLedger />
    </div>
  );
}

// Main App Home Component
export default function Home() {
  const [active, setActive] = useState("Overview");

  // Modals state
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [showSandboxTest, setShowSandboxTest] = useState(false);
  const [selectedAudioRecord, setSelectedAudioRecord] = useState<CDRRecord | null>(null);
  const [selectedQARecord, setSelectedQARecord] = useState<CDRRecord | null>(null);

  const activeIndex = navigation.findIndex((item) => item.label === active);

  let content: React.ReactNode = null;
  switch (active) {
    case "Overview":
      content = <Overview onNavigate={setActive} onNewCampaign={() => setShowCampaignBuilder(true)} />;
      break;
    case "Campaigns":
      content = <Campaigns onNewCampaign={() => setShowCampaignBuilder(true)} onTestCall={() => setShowSandboxTest(true)} />;
      break;
    case "Agent Workspace":
      content = <AgentWorkspace />;
      break;
    case "Leads & CRM":
      content = <LeadsScreen />;
      break;
    case "AI Voice Studio":
      content = (
        <div className="page-enter space-y-5">
          <div className="hero-row">
            <div>
              <p className="eyebrow violet-text">AUTONOMOUS VOICE ENGINE</p>
              <h1 className="page-title">AI Voice Studio</h1>
              <p className="page-subtitle">Configure neural Indian voices, A/B conversation scripts, and compliance disclosures.</p>
            </div>
            <button className="primary-button" onClick={() => setShowSandboxTest(true)}>
              <PhoneCall size={15} /> Sandbox test call
            </button>
          </div>
          <VoiceSelectionPicker />
          <ABTestingSplitUI />
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
        <div className="page-enter space-y-5">
          <div className="hero-row">
            <div>
              <p className="eyebrow green-text">TRUST & TELECOM REGULATION</p>
              <h1 className="page-title">Compliance & TRAI Audit Trail</h1>
              <p className="page-subtitle">Statutory TCCCPR regulations, DLT registrations, 09:00-21:00 calling windows, and consent ledgers.</p>
            </div>
          </div>
          <ConsentAuditLedger />
        </div>
      );
      break;
    case "Admin & Billing":
      content = (
        <div className="page-enter space-y-5">
          <DisabledStateGuard>
            <div className="hero-row">
              <div>
                <p className="eyebrow cyan-text">PLATFORM ADMINISTRATION</p>
                <h1 className="page-title">Admin, Roles & Telephony Billing</h1>
                <p className="page-subtitle">Role permissions matrix, auto-recharge settings, and WebRTC network quality diagnostics.</p>
              </div>
            </div>
            <LiveSpendCounter />
            <AutoRechargeConfig />
            <RoleManagementUI />
            <SystemStatusPage />
          </DisabledStateGuard>
        </div>
      );
      break;
    default:
      content = <Overview onNavigate={setActive} onNewCampaign={() => setShowCampaignBuilder(true)} />;
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

        <div className="workspace-switcher">
          <span className="workspace-avatar">A</span>
          <div>
            <strong>Arjun’s workspace</strong>
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
                {item.label === "Live Floor" && <span className="nav-count">24</span>}
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
            <button onClick={() => toast.info("Your plan is already enabled for the demo")}>
              Explore Pro <ArrowUpRight size={13} />
            </button>
          </div>

          <button className="nav-item" onClick={() => setActive("Admin & Billing")}>
            <Settings2 size={17} />
            <span>Settings</span>
          </button>
          <button className="nav-item" onClick={() => toast.info("Help center opened")}>
            <CircleHelp size={17} />
            <span>Help center</span>
          </button>

          <div className="user-row">
            <span className="workspace-avatar user">AM</span>
            <div>
              <strong>Arjun Mehta</strong>
              <span>Owner · Mumbai</span>
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
            <AgentStatusDropdown />
            <div className="status-chip">
              <span className="status-dot" />
              Trunks Operational
            </div>
            <button className="icon-button" onClick={() => toast.info("No new notifications")}>
              <AlertTriangle size={17} />
            </button>
            <button className="icon-button" onClick={() => toast.info("Command search coming soon")}>
              <Search size={17} />
            </button>
            <div className="top-avatar">AM</div>
          </div>
        </header>

        <div className="content-wrap">{content}</div>
      </main>

      {/* Persistent Dockable WebRTC Softphone */}
      <WebRTCSoftphone />

      {/* Modals & Slide-out Drawers */}
      <CampaignBuilderModal
        isOpen={showCampaignBuilder}
        onClose={() => setShowCampaignBuilder(false)}
      />

      <SandboxTestModal
        isOpen={showSandboxTest}
        onClose={() => setShowSandboxTest(false)}
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
      />
    </div>
  );
}
