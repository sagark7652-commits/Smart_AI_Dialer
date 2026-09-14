import { useMemo, useState } from "react";
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
} from "lucide-react";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Campaigns", icon: Megaphone },
  { label: "Leads", icon: Users },
  { label: "AI agents", icon: Bot },
  { label: "Live calls", icon: Radio },
  { label: "Analytics", icon: Activity },
  { label: "Compliance", icon: ShieldCheck },
];

const campaigns = [
  { name: "Festive season follow-up", mode: "AI blast", status: "Running", leads: "2,480", connected: "842", progress: 68, color: "violet" },
  { name: "Enterprise renewal desk", mode: "Progressive", status: "Running", leads: "860", connected: "318", progress: 41, color: "cyan" },
  { name: "Inbound demo callbacks", mode: "Preview", status: "Paused", leads: "320", connected: "127", progress: 26, color: "amber" },
];

const liveCalls = [
  { initials: "AS", name: "Anjali Sharma", number: "+91 98765 14482", campaign: "Festive season", sentiment: "Positive", duration: "04:32", score: 92, color: "#9b87f5" },
  { initials: "RK", name: "Rakesh Kumar", number: "+91 98110 29310", campaign: "Enterprise renewal", sentiment: "Neutral", duration: "02:18", score: 71, color: "#4ac8d8" },
  { initials: "PM", name: "Priya Menon", number: "+91 98470 82216", campaign: "Festive season", sentiment: "Positive", duration: "01:04", score: 86, color: "#f2ad61" },
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

function Overview({ onNavigate }: { onNavigate: (label: string) => void }) {
  const [isPaused, setIsPaused] = useState(false);
  const [timeframe, setTimeframe] = useState("Today");
  return <div className="page-enter">
    <div className="hero-row">
      <div><p className="eyebrow violet-text">SUNDAY, 13 SEPTEMBER 2026 <span className="live-dot" /> LIVE OPERATIONS</p><h1 className="page-title">Good evening, <span>Arjun</span>.</h1><p className="page-subtitle">Here’s how your calling floor is performing today.</p></div>
      <div className="flex items-center gap-3"><button className="soft-button" onClick={() => toast.success("Report export queued", { description: "We'll send the CSV to your workspace shortly." })}><FileText size={15} /> Export report</button><button className="primary-button" onClick={() => onNavigate("Campaigns")}><Plus size={16} /> New campaign</button></div>
    </div>
    <div className="stats-grid">
      <StatCard label="Calls placed" value="3,682" delta="18.4%" detail="vs. yesterday" icon={Phone} accent="violet" />
      <StatCard label="Connect rate" value="42.8%" delta="6.2%" detail="vs. last 7 days" icon={Radio} accent="cyan" />
      <StatCard label="Qualified leads" value="286" delta="12.6%" detail="vs. yesterday" icon={Target} accent="amber" />
      <StatCard label="Avg. talk time" value="03:48" delta="0.8%" detail="vs. last 7 days" icon={Clock3} accent="rose" down />
    </div>
    <div className="main-grid">
      <section className="panel chart-panel">
        <div className="panel-header"><div><p className="eyebrow">ACTIVITY PULSE</p><h2 className="section-title">Calls over time</h2></div><div className="segmented">{["Today", "7 days", "30 days"].map(item => <button key={item} className={timeframe === item ? "active" : ""} onClick={() => setTimeframe(item)}>{item}</button>)}</div></div>
        <div className="chart-meta"><span className="chart-total">12,842 <small>total calls</small></span><span className="legend"><i className="legend-line" /> Connected <i className="legend-line faint" /> Dialed</span></div>
        <div className="bar-chart" aria-label="Calls over time chart">{bars.map((height, i) => <div key={i} className={`bar ${i % 5 === 0 ? "highlight" : ""}`} style={{ height: `${height}%` }} />)}</div>
        <div className="chart-axis"><span>06:00</span><span>09:00</span><span>12:00</span><span>15:00</span><span>18:00</span><span>21:00</span></div>
      </section>
      <section className="panel live-panel">
        <div className="panel-header"><div><p className="eyebrow">RIGHT NOW</p><h2 className="section-title">Live floor</h2></div><button className="icon-button" onClick={() => onNavigate("Live calls")}><MoreHorizontal size={18} /></button></div>
        <div className="floor-number"><strong>24</strong><span>active calls</span><span className="floor-badge"><span className="status-dot" /> 9 AI agents</span></div>
        <div className="mini-metrics"><div><span>Agents online</span><strong>18 / 24</strong></div><div><span>Queue waiting</span><strong>07</strong></div><div><span>Service level</span><strong className="cyan-text">94.2%</strong></div></div>
        <div className="agent-stack"><div className="avatar-stack"><span className="avatar avatar-violet">AS</span><span className="avatar avatar-cyan">RK</span><span className="avatar avatar-amber">PM</span><span className="avatar avatar-rose">VN</span><span className="avatar avatar-more">+14</span></div><span className="muted text-xs">3 supervisors monitoring</span></div>
        <button className={`full-width-button ${isPaused ? "resume" : ""}`} onClick={() => { setIsPaused(!isPaused); toast(isPaused ? "Dialer resumed" : "Dialer paused", { description: isPaused ? "Queues are processing again." : "New calls are held. Active calls continue." }); }}><span className="button-pulse" />{isPaused ? <><Play size={14} /> Resume dialer</> : <><Pause size={14} /> Pause all campaigns</>}</button>
      </section>
    </div>
    <div className="main-grid lower-grid">
      <section className="panel"><SectionTitle eyebrow="CAMPAIGN HEALTH" title="Active campaigns" action={<button className="text-button" onClick={() => onNavigate("Campaigns")}>View all <ArrowUpRight size={14} /></button>} /><div className="table-wrap"><table className="data-table"><thead><tr><th>Campaign</th><th>Mode</th><th>Progress</th><th>Connected</th><th>Status</th></tr></thead><tbody>{campaigns.map(c => <tr key={c.name}><td><div className="campaign-name"><span className={`campaign-mark ${c.color}`} />{c.name}</div></td><td><span className="mode-label">{c.mode}</span></td><td><div className="progress-wrap"><div className="progress-track"><div className={`progress-fill ${c.color}`} style={{ width: `${c.progress}%` }} /></div><span>{c.progress}%</span></div></td><td className="strong-cell">{c.connected} <span className="muted">/ {c.leads}</span></td><td><StatusPill tone={c.status === "Running" ? "green" : "yellow"}>{c.status}</StatusPill></td></tr>)}</tbody></table></div></section>
      <section className="panel activity-panel"><SectionTitle eyebrow="EVENT STREAM" title="Recent activity" action={<button className="icon-button"><ListFilter size={17} /></button>} /><div className="activity-list"><div className="activity-item"><span className="activity-icon violet"><WandSparkles size={15} /></span><div><p><strong>AI agent</strong> qualified a lead as <span className="violet-text">Interested</span></p><span className="muted">Festive season follow-up · 2 min ago</span></div></div><div className="activity-item"><span className="activity-icon cyan"><CalendarClock size={15} /></span><div><p><strong>Callback</strong> scheduled for tomorrow at 10:30</p><span className="muted">Neha Iyer · Enterprise renewal · 8 min ago</span></div></div><div className="activity-item"><span className="activity-icon amber"><ShieldCheck size={15} /></span><div><p><strong>DNC check</strong> blocked 14 contacts from import</p><span className="muted">Compliance guardrail · 12 min ago</span></div></div><div className="activity-item"><span className="activity-icon rose"><AlertTriangle size={15} /></span><div><p><strong>Supervisor alert</strong> raised on high talk-over</p><span className="muted">Agent Ananya · 18 min ago</span></div></div></div></section>
    </div>
  </div>;
}

function Campaigns({ onNavigate }: { onNavigate: (label: string) => void }) {
  const [status, setStatus] = useState("All campaigns");
  return <div className="page-enter"><div className="hero-row"><div><p className="eyebrow violet-text">OUTBOUND ENGINE</p><h1 className="page-title">Campaigns</h1><p className="page-subtitle">Orchestrate every list, retry rule, caller ID, and AI assistant from one place.</p></div><div className="flex items-center gap-3"><button className="soft-button" onClick={() => toast.info("CSV import opened", { description: "Map your columns before the campaign can start." })}><Upload size={15} /> Import leads</button><button className="primary-button" onClick={() => toast.success("Campaign draft created", { description: "Add a list, a calling window, and an AI agent to launch." })}><Plus size={16} /> New campaign</button></div></div><div className="filter-row"><div className="search-box"><Search size={15} /><input placeholder="Search campaigns" /></div><div className="filter-select"><Filter size={14} /><select value={status} onChange={e => setStatus(e.target.value)}><option>All campaigns</option><option>Running</option><option>Paused</option><option>Draft</option></select><ChevronDown size={14} /></div><span className="muted text-xs ml-auto">3 campaigns · refreshed just now</span></div><div className="campaign-cards">{campaigns.map(c => <div className="campaign-card" key={c.name}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className={`campaign-mark large ${c.color}`} /><div><h3>{c.name}</h3><p className="muted">{c.mode} · India / IST</p></div></div><StatusPill tone={c.status === "Running" ? "green" : "yellow"}>{c.status}</StatusPill></div><div className="campaign-card-metrics"><div><span>Leads dialled</span><strong>{c.leads}</strong></div><div><span>Connected</span><strong>{c.connected}</strong></div><div><span>Avg. talk time</span><strong>03:42</strong></div></div><div className="progress-wrap full"><div className="progress-track"><div className={`progress-fill ${c.color}`} style={{ width: `${c.progress}%` }} /></div><span>{c.progress}% complete</span></div><div className="campaign-card-footer"><span className="muted"><Phone size={13} /> Caller ID · +91 140 22 8041</span><button className="text-button" onClick={() => onNavigate("Live calls")}>Open console <ArrowUpRight size={14} /></button></div></div>)}</div><div className="callout"><div className="callout-icon"><Zap size={18} /></div><div><strong>Parallel mode is ready for your next list.</strong><p>AI agents can run up to 40 concurrent conversations while respecting your configured 09:00–21:00 calling window and DNC scrub.</p></div><button className="soft-button" onClick={() => onNavigate("AI agents")}>Configure agent <ArrowUpRight size={14} /></button></div></div>;
}

function Leads() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => leads.filter(l => `${l.name} ${l.company} ${l.phone}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <div className="page-enter"><div className="hero-row"><div><p className="eyebrow cyan-text">CONTACT CENTER CRM</p><h1 className="page-title">Leads</h1><p className="page-subtitle">One live record for every contact, outcome, callback, and AI briefing.</p></div><div className="flex items-center gap-3"><button className="soft-button" onClick={() => toast.info("Lead import is ready", { description: "Upload a CSV to start mapping fields." })}><Upload size={15} /> Import CSV</button><button className="primary-button" onClick={() => toast.success("New lead form opened")}><Plus size={16} /> Add lead</button></div></div><div className="filter-row"><div className="search-box wide"><Search size={15} /><input placeholder="Search name, company, or phone" value={query} onChange={e => setQuery(e.target.value)} /></div><button className="soft-button"><ListFilter size={14} /> Filters <span className="filter-count">2</span></button><span className="muted text-xs ml-auto">{filtered.length} of 18,420 contacts</span></div><section className="panel"><div className="table-wrap"><table className="data-table leads-table"><thead><tr><th>Lead</th><th>Phone</th><th>Source</th><th>Stage</th><th>AI score</th><th>Last touch</th><th /></tr></thead><tbody>{filtered.map(l => <tr key={l.phone}><td><div className="lead-cell"><span className="avatar avatar-violet">{l.name.split(" ").map(x => x[0]).join("")}</span><div><strong>{l.name}</strong><span className="muted">{l.company}</span></div></div></td><td className="mono-cell">{l.phone}</td><td><span className="source-label">{l.source}</span></td><td><span className={`stage ${l.stage.toLowerCase().replace(" ", "-")}`}>{l.stage}</span></td><td><div className="score"><span className={l.score > 80 ? "score-high" : l.score > 60 ? "score-mid" : "score-low"}>{l.score}</span><div className="score-track"><div style={{ width: `${l.score}%` }} className={l.score > 80 ? "score-high-bg" : l.score > 60 ? "score-mid-bg" : "score-low-bg"} /></div></div></td><td className="muted">{l.last}</td><td><button className="icon-button" onClick={() => toast.info(`Opening ${l.name}'s lead record`)}><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div></section></div>;
}

function AIAgents() {
  const [selected, setSelected] = useState("Asha · Retail qualifier");
  const [testActive, setTestActive] = useState(false);
  return <div className="page-enter"><div className="hero-row"><div><p className="eyebrow violet-text">AUTONOMOUS VOICE</p><h1 className="page-title">AI agents</h1><p className="page-subtitle">Design brand-aware voice agents with clear handoff, compliance, and knowledge boundaries.</p></div><button className="primary-button" onClick={() => toast.success("New agent draft created")}><Plus size={16} /> New AI agent</button></div><div className="ai-grid"><section className="panel agent-list-panel"><SectionTitle eyebrow="YOUR AGENTS" title="Voice library" action={<button className="icon-button"><Settings2 size={17} /></button>} /><div className="agent-list">{[{ name: "Asha · Retail qualifier", desc: "Hindi + English · Female · Warm", usage: "1,842 calls", tone: "violet", active: true }, { name: "Kabir · Renewal specialist", desc: "English · Male · Consultative", usage: "928 calls", tone: "cyan", active: true }, { name: "Meera · Demo concierge", desc: "Hinglish · Female · Energetic", usage: "486 calls", tone: "amber", active: false }].map(a => <button key={a.name} className={`agent-row ${selected === a.name ? "selected" : ""}`} onClick={() => setSelected(a.name)}><span className={`agent-orb ${a.tone}`}><Bot size={18} /></span><span className="agent-copy"><strong>{a.name}</strong><span>{a.desc}</span></span><span className="agent-usage">{a.usage}<small>{a.active ? "Active" : "Draft"}</small></span><ChevronDown className="rotate-neg" size={15} /></button>)}</div><button className="dashed-button" onClick={() => toast.info("Agent template picker opened")}><Sparkles size={15} /> Start from a template</button></section><section className="panel agent-builder"><div className="builder-head"><div><p className="eyebrow">CONFIGURATION</p><h2 className="section-title">{selected}</h2></div><StatusPill>Live</StatusPill></div><div className="voice-preview"><div className="voice-orb"><span /><span /><span /></div><div><p className="eyebrow">VOICE PREVIEW</p><strong>“Warm, confident, and concise”</strong><p className="muted">Hindi / English · <span className="violet-text">Asha</span></p></div><button className="icon-button play-button" onClick={() => toast.success("Playing voice preview")}><Volume2 size={17} /></button></div><div className="builder-sections"><div><span className="builder-label">Objective</span><p>Qualify inbound retail leads and schedule a product demo with the sales team.</p></div><div><span className="builder-label">Opening line <span className="lock"><ShieldCheck size={11} /> required disclosure</span></span><p>“Hi, this is Asha, an automated assistant from CallForge. This call may be recorded. Is now a good time to speak about your enquiry?”</p></div><div><span className="builder-label">Guardrails</span><div className="tag-list"><span>Never promise discounts</span><span>Transfer on anger</span><span>Max 8 minutes</span><span>DNC always wins</span></div></div></div><div className="builder-footer"><span className="muted"><Check size={14} className="cyan-text" /> Knowledge base synced 12 min ago</span><button className="primary-button" onClick={() => { setTestActive(!testActive); toast(testActive ? "Test call ended" : "Test call started", { description: testActive ? "Transcript saved to the sandbox." : "This simulated call won't contact a real person." }); }}>{testActive ? <><Pause size={15} /> End test</> : <><Phone size={15} /> Test call</>}</button></div></section></div><div className="callout subtle"><div className="callout-icon violet-bg"><MessageSquareText size={17} /></div><div><strong>Conversation intelligence is on for this agent.</strong><p>Every completed call gets a transcript, summary, sentiment, proposed disposition, and next-best action.</p></div><button className="text-button">Review rubric <ArrowUpRight size={14} /></button></div></div>;
}

function LiveCalls() {
  return <div className="page-enter"><div className="hero-row"><div><p className="eyebrow rose-text">SUPERVISOR CONSOLE</p><h1 className="page-title">Live calls</h1><p className="page-subtitle">Monitor active conversations, sentiment, and handoffs without leaving the floor.</p></div><div className="live-status"><span className="live-dot" />24 active calls <span className="muted">·</span> 18 agents online</div></div><div className="live-grid"><section className="panel live-table-panel"><SectionTitle eyebrow="ACTIVE NOW" title="Conversation monitor" action={<button className="soft-button"><Filter size={14} /> Filter</button>} /><div className="table-wrap"><table className="data-table live-table"><thead><tr><th>Contact</th><th>Campaign</th><th>Duration</th><th>Sentiment</th><th>AI confidence</th><th>Actions</th></tr></thead><tbody>{liveCalls.map(c => <tr key={c.number}><td><div className="lead-cell"><span className="avatar" style={{ background: c.color }}>{c.initials}</span><div><strong>{c.name}</strong><span className="muted mono-cell">{c.number}</span></div></div></td><td><span className="source-label">{c.campaign}</span></td><td className="mono-cell">{c.duration}</td><td><StatusPill tone={c.sentiment === "Positive" ? "green" : "yellow"}>{c.sentiment}</StatusPill></td><td><div className="score"><span className="score-high">{c.score}</span><div className="score-track"><div className="score-high-bg" style={{ width: `${c.score}%` }} /></div></div></td><td><div className="flex gap-1"><button className="icon-button" onClick={() => toast.success(`Whisper joined ${c.name}'s call`)}><Headphones size={15} /></button><button className="icon-button" onClick={() => toast.info("Call details opened")}><MoreHorizontal size={17} /></button></div></td></tr>)}</tbody></table></div></section><aside className="panel insight-panel"><div className="flex items-center justify-between"><div><p className="eyebrow">LIVE SIGNALS</p><h2 className="section-title">Floor insights</h2></div><Activity size={17} className="cyan-text" /></div><div className="insight-card warning"><div className="insight-top"><AlertTriangle size={16} /><span>Needs attention</span><span className="muted">2 min ago</span></div><strong>Talk-over spike on Kabir’s queue</strong><p>AI detected 4 interruptions in the last 90 seconds. Consider whispering a coaching cue.</p><button className="text-button">Open coaching <ArrowUpRight size={14} /></button></div><div className="insight-card"><div className="insight-top"><Sparkles size={16} className="violet-text" /><span>Positive pattern</span><span className="muted">8 min ago</span></div><strong>Objection handling is converting</strong><p>“I understand the concern…” appears in 31% of qualified calls today.</p><button className="text-button">See phrase report <ArrowUpRight size={14} /></button></div><div className="queue-row"><span>Longest queue wait</span><strong>00:42</strong><span className="metric-up">↓ 18%</span></div><div className="queue-row"><span>Abandon rate</span><strong>1.8%</strong><span className="metric-up">↓ 0.4%</span></div></aside></div></div>;
}

function Analytics() {
  return <div className="page-enter"><div className="hero-row"><div><p className="eyebrow amber-text">PERFORMANCE LAB</p><h1 className="page-title">Analytics</h1><p className="page-subtitle">Understand what turns a dial into a conversation, and a conversation into revenue.</p></div><div className="filter-select"><CalendarClock size={14} /><select><option>Last 7 days</option><option>Last 30 days</option><option>This quarter</option></select><ChevronDown size={14} /></div></div><div className="stats-grid analytics-stats"><StatCard label="Contact rate" value="42.8%" delta="6.2%" detail="vs. previous period" icon={Radio} accent="cyan" /><StatCard label="Qualified rate" value="33.9%" delta="4.8%" detail="of connected calls" icon={Target} accent="violet" /><StatCard label="Cost / conversion" value="₹184" delta="9.1%" detail="vs. previous period" icon={Zap} accent="amber" down /><StatCard label="AI QA score" value="91.4" delta="3.6%" detail="across 2,104 calls" icon={Sparkles} accent="rose" /></div><div className="main-grid"><section className="panel chart-panel"><SectionTitle eyebrow="FUNNEL" title="From dial to delight" action={<button className="text-button">Download CSV <ArrowDownRight size={14} /></button>} /><div className="funnel"><div className="funnel-row"><span>Dialled</span><div className="funnel-track"><div className="funnel-fill one" style={{ width: "100%" }} /></div><strong>12,842</strong><small>100%</small></div><div className="funnel-row"><span>Connected</span><div className="funnel-track"><div className="funnel-fill two" style={{ width: "42.8%" }} /></div><strong>5,496</strong><small>42.8%</small></div><div className="funnel-row"><span>Qualified</span><div className="funnel-track"><div className="funnel-fill three" style={{ width: "14.5%" }} /></div><strong>1,862</strong><small>14.5%</small></div><div className="funnel-row"><span>Converted</span><div className="funnel-track"><div className="funnel-fill four" style={{ width: "4.8%" }} /></div><strong>612</strong><small>4.8%</small></div></div></section><section className="panel"><SectionTitle eyebrow="DISPOSITION MIX" title="What callers say" /><div className="donut-wrap"><div className="donut"><div><strong>5,496</strong><span>connected</span></div></div><div className="donut-legend"><span><i className="dot violet" />Interested <strong>34%</strong></span><span><i className="dot cyan" />Callback <strong>21%</strong></span><span><i className="dot amber" />Not interested <strong>18%</strong></span><span><i className="dot slate" />Other <strong>27%</strong></span></div></div></section></div></div>;
}

function Compliance() {
  return <div className="page-enter"><div className="hero-row"><div><p className="eyebrow green-text">TRUST CENTER</p><h1 className="page-title">Compliance</h1><p className="page-subtitle">India-first controls that keep every campaign inside the lines.</p></div><button className="soft-button" onClick={() => toast.success("Compliance report exported")}><FileText size={15} /> Export audit log</button></div><div className="compliance-banner"><div className="compliance-score"><strong>96</strong><span>/ 100</span></div><div><p className="eyebrow green-text">OVERALL READINESS</p><h2>Good to dial</h2><p>All active campaigns pass calling-hours and DNC checks. One document renewal is due in 11 days.</p></div><div className="compliance-ring"><ShieldCheck size={25} /></div></div><div className="compliance-grid"><section className="panel"><SectionTitle eyebrow="GUARDRAILS" title="Policy checks" /><div className="policy-list"><div className="policy-row"><span className="policy-icon green"><Check size={15} /></span><div><strong>Calling hours</strong><span>09:00–21:00 in lead timezone</span></div><StatusPill>Passing</StatusPill></div><div className="policy-row"><span className="policy-icon green"><Check size={15} /></span><div><strong>DNC / suppression scrub</strong><span>Real-time registry + workspace list</span></div><StatusPill>Passing</StatusPill></div><div className="policy-row"><span className="policy-icon green"><Check size={15} /></span><div><strong>Disclosure preamble</strong><span>Locked on all AI agents</span></div><StatusPill>Passing</StatusPill></div><div className="policy-row"><span className="policy-icon amber"><Clock3 size={15} /></span><div><strong>DLT registration renewal</strong><span>Principal entity certificate</span></div><StatusPill tone="yellow">Due in 11d</StatusPill></div></div></section><section className="panel"><SectionTitle eyebrow="AUDIT TRAIL" title="Recent controls" /><div className="audit-list"><div><span className="audit-time">18:42</span><p><strong>14 contacts blocked</strong> during CSV import <span className="muted">· DNC match</span></p></div><div><span className="audit-time">17:18</span><p><strong>Campaign paused</strong> outside allowed window <span className="muted">· Auto-guard</span></p></div><div><span className="audit-time">16:55</span><p><strong>Recording retention updated</strong> to 90 days <span className="muted">· Arjun Mehta</span></p></div><div><span className="audit-time">15:26</span><p><strong>AI disclosure locked</strong> for Meera agent <span className="muted">· Policy</span></p></div></div></section></div></div>;
}

export default function Home() {
  const [active, setActive] = useState("Overview");
  const activeIndex = navigation.findIndex(item => item.label === active);
  const content = active === "Overview" ? <Overview onNavigate={setActive} /> : active === "Campaigns" ? <Campaigns onNavigate={setActive} /> : active === "Leads" ? <Leads /> : active === "AI agents" ? <AIAgents /> : active === "Live calls" ? <LiveCalls /> : active === "Analytics" ? <Analytics /> : <Compliance />;
  return <div className="app-shell"><aside className="app-sidebar"><div className="brand"><div className="brand-mark"><span /><span /><span /></div><div><strong>callforge</strong><small>OPS CONSOLE</small></div></div><div className="workspace-switcher"><span className="workspace-avatar">A</span><div><strong>Arjun’s workspace</strong><span>Pro plan · Mumbai</span></div><ChevronDown size={15} /></div><nav className="side-nav"><p className="nav-label">WORKSPACE</p>{navigation.map((item, index) => { const Icon = item.icon; return <button key={item.label} className={`nav-item ${active === item.label ? "active" : ""}`} onClick={() => setActive(item.label)}><Icon size={17} /><span>{item.label}</span>{item.label === "Live calls" && <span className="nav-count">24</span>}{active === item.label && <span className="active-rail" />}</button> })}</nav><div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={15} /></div><strong>Unlock AI insights</strong><p>Get deeper coaching signals on every call.</p><button onClick={() => toast.info("Your plan is already enabled for the demo")}>Explore Pro <ArrowUpRight size={13} /></button></div><button className="nav-item" onClick={() => toast.info("Settings panel is ready for your carrier and workspace config")}><Settings2 size={17} /><span>Settings</span></button><button className="nav-item" onClick={() => toast.info("Help center opened")}><CircleHelp size={17} /><span>Help center</span></button><div className="user-row"><span className="workspace-avatar user">AM</span><div><strong>Arjun Mehta</strong><span>Owner</span></div><MoreHorizontal size={16} className="muted" /></div></div></aside><main className="app-main"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{navigation[activeIndex]?.label}</strong></div><div className="top-actions"><div className="status-chip"><span className="status-dot" />All systems operational</div><button className="icon-button" onClick={() => toast.info("No new notifications")}><AlertTriangle size={17} /></button><button className="icon-button" onClick={() => toast.info("Command menu coming soon")}><Search size={17} /></button><div className="top-avatar">AM</div></div></header><div className="content-wrap">{content}</div></main></div>;
}
