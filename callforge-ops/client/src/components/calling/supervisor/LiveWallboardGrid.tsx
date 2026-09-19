import React, { useState, useEffect } from "react";
import {
  Users,
  Radio,
  Clock,
  AlertTriangle,
  Sparkles,
  Search,
  Filter,
  Activity,
  Bot,
  User,
} from "lucide-react";
import { ActionButtonsGroup } from "./ActionButtonsGroup";

export interface WallboardAgent {
  id: string;
  name: string;
  type: "human" | "ai";
  status: "on_call" | "ready" | "wrap_up" | "break";
  currentCall?: {
    callId: string;
    customerName: string;
    customerPhone: string;
    campaign: string;
    duration: number; // in seconds
    sentiment: "Positive" | "Neutral" | "Negative";
    aiScore: number;
    hasTalkOverAlert?: boolean;
  };
}

export const INITIAL_AGENTS: WallboardAgent[] = [];

export const LiveWallboardGrid: React.FC = () => {
  const [agents, setAgents] = useState<WallboardAgent[]>(INITIAL_AGENTS);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Connect to live backend wallboard and stream
  useEffect(() => {
    const fetchWallboard = async () => {
      try {
        const res = await fetch("/api/calling/wallboard");
        const data = await res.json();
        if (data && Array.isArray(data.agents)) {
          const mapped: WallboardAgent[] = data.agents.map((a: any) => {
            const activeCall = (data.activeCalls || []).find((c: any) => c.agentId === a.id);
            return {
              id: a.id,
              name: a.name,
              type: a.type || (a.name.toLowerCase().includes("ai") ? "ai" : "human"),
              status: (a.state === "on_call"
                ? "on_call"
                : a.state === "ready"
                ? "ready"
                : a.state === "wrap_up"
                ? "wrap_up"
                : "break") as any,
              currentCall: activeCall
                ? {
                    callId: activeCall.id,
                    customerName: activeCall.customerName || "Enterprise Contact",
                    customerPhone: activeCall.customerPhone,
                    campaign: activeCall.campaign || "Outbound Active Queue",
                    duration: activeCall.durationSeconds || 1,
                    sentiment:
                      activeCall.sentiment === "positive"
                        ? "Positive"
                        : activeCall.sentiment === "negative"
                        ? "Negative"
                        : "Neutral",
                    aiScore: 92,
                  }
                : undefined,
            };
          });
          setAgents(mapped);
        }
      } catch {}
    };

    fetchWallboard();

    let sse: EventSource | null = null;
    try {
      sse = new EventSource("/api/calling/live");
      sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "agent_status" && payload.agentId) {
            setAgents((prev) =>
              prev.map((ag) =>
                ag.id === payload.agentId
                  ? {
                      ...ag,
                      status:
                        payload.state === "on_call"
                          ? "on_call"
                          : payload.state === "ready"
                          ? "ready"
                          : payload.state === "wrap_up"
                          ? "wrap_up"
                          : "break",
                    }
                  : ag
              )
            );
          } else if (payload.activeCalls || payload.agents) {
            fetchWallboard();
          }
        } catch {}
      };
    } catch {}

    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((agent) => {
          if (agent.status === "on_call" && agent.currentCall) {
            return {
              ...agent,
              currentCall: {
                ...agent.currentCall,
                duration: agent.currentCall.duration + 1,
              },
            };
          }
          return agent;
        })
      );
    }, 1000);

    return () => {
      clearInterval(interval);
      if (sse) sse.close();
    };
  }, []);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const filtered = agents.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.currentCall?.customerName.toLowerCase().includes(q) ||
        a.currentCall?.customerPhone.includes(q)
      );
    }
    return true;
  });

  const onCallCount = agents.filter((a) => a.status === "on_call").length;
  const readyCount = agents.filter((a) => a.status === "ready").length;
  const wrapCount = agents.filter((a) => a.status === "wrap_up").length;

  return (
    <div className="space-y-4">
      {/* Wallboard Floor Summary Banner */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] animate-pulse" />
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                SSE Live Stream
              </span>
              <strong className="text-sm text-zinc-100 font-mono">Floor Connected</strong>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-800 hidden sm:block" />

          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-[10px] text-zinc-400 block">Active Calls</span>
              <strong className="text-violet-400 font-mono text-sm">{onCallCount}</strong>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">Agents Ready</span>
              <strong className="text-emerald-400 font-mono text-sm">{readyCount}</strong>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">In Wrap-Up</span>
              <strong className="text-amber-400 font-mono text-sm">{wrapCount}</strong>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block">Floor SLA</span>
              <strong className="text-cyan-400 font-mono text-sm">94.8%</strong>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs">
            <Search size={13} className="text-zinc-500 mr-1.5" />
            <input
              type="text"
              placeholder="Search agent / customer"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-zinc-200 placeholder-zinc-500 focus:outline-none w-36 text-xs"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-300 focus:outline-none"
          >
            <option value="all">All States</option>
            <option value="on_call">On Live Call</option>
            <option value="ready">Ready</option>
            <option value="wrap_up">Wrap-Up</option>
            <option value="break">Break</option>
          </select>
        </div>
      </div>

      {/* Empty State when no active agents */}
      {filtered.length === 0 && (
        <div className="p-12 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 my-2">
          <Radio size={32} className="mx-auto text-zinc-600 mb-2.5 animate-pulse" />
          <h4 className="text-sm font-semibold text-zinc-300">No active calls on the floor</h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            When your agents or autonomous AI bots connect to live phone calls, real-time audio channels and supervisor controls (Whisper, Barge-in) will appear here.
          </p>
        </div>
      )}

      {/* Grid of Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filtered.map((agent) => {
          const isOnCall = agent.status === "on_call" && agent.currentCall;
          return (
            <div
              key={agent.id}
              className={`p-4 rounded-xl border transition-all relative ${
                agent.status === "on_call"
                  ? "border-violet-500/60 bg-zinc-950 shadow-md shadow-violet-950/20"
                  : agent.status === "ready"
                  ? "border-emerald-500/30 bg-zinc-950/70"
                  : agent.status === "wrap_up"
                  ? "border-amber-500/30 bg-zinc-950/70"
                  : "border-zinc-800 bg-zinc-950/40 opacity-70"
              }`}
            >
              {/* Agent Top Row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      agent.type === "ai"
                        ? "bg-violet-600/30 text-violet-300 border border-violet-500/40"
                        : "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
                    }`}
                  >
                    {agent.type === "ai" ? <Bot size={15} /> : <User size={15} />}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                      {agent.name}
                      {agent.type === "ai" && (
                        <span className="text-[9px] bg-violet-900/50 text-violet-300 px-1 py-0.2 rounded font-mono">
                          AI
                        </span>
                      )}
                    </h5>
                    <span className="text-[10px] text-zinc-500">ID: {agent.id}</span>
                  </div>
                </div>

                {/* Status Pill */}
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono ${
                    agent.status === "on_call"
                      ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/40"
                      : agent.status === "ready"
                      ? "bg-amber-950/30 text-amber-300 border border-amber-500/40"
                      : agent.status === "wrap_up"
                      ? "bg-violet-950/30 text-violet-300 border border-violet-500/40"
                      : "bg-rose-950/30 text-rose-400 border border-rose-800/40"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      agent.status === "on_call"
                        ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse"
                        : agent.status === "ready"
                        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse"
                        : agent.status === "wrap_up"
                        ? "bg-violet-400 shadow-[0_0_8px_rgba(168,85,247,0.7)]"
                        : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                    }`}
                  />
                  {agent.status === "on_call"
                    ? "ACTIVE CALL"
                    : agent.status === "ready"
                    ? "RINGING / READY"
                    : agent.status === "wrap_up"
                    ? "WRAP-UP"
                    : "BREAK"}
                </span>
              </div>

              {/* On-Call Details Area */}
              {isOnCall ? (
                <div className="space-y-2.5 pt-1">
                  <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-zinc-200">
                        {agent.currentCall?.customerName}
                      </strong>
                      <span className="font-mono text-emerald-400 font-bold">
                        {formatDuration(agent.currentCall?.duration || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-mono">{agent.currentCall?.customerPhone}</span>
                      <span className="text-violet-300">{agent.currentCall?.campaign}</span>
                    </div>
                  </div>

                  {/* Sentiment & Talk-over */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Sparkles size={12} className="text-violet-400" />
                      Sentiment:{" "}
                      <strong
                        className={
                          agent.currentCall?.sentiment === "Positive"
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }
                      >
                        {agent.currentCall?.sentiment}
                      </strong>
                    </span>
                    <span className="text-zinc-400 font-mono">
                      AI QA: <strong className="text-zinc-200">{agent.currentCall?.aiScore}</strong>
                      /100
                    </span>
                  </div>

                  {agent.currentCall?.hasTalkOverAlert && (
                    <div className="px-2 py-1 rounded bg-amber-950/40 border border-amber-800/50 flex items-center gap-1 text-[10px] text-amber-300">
                      <AlertTriangle size={12} /> Talk-over spike detected (coaching cue suggested)
                    </div>
                  )}

                  {/* Supervisor Action Bar */}
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-zinc-500">
                      Supervisor Controls:
                    </span>
                    <ActionButtonsGroup
                      callId={agent.currentCall?.callId || ""}
                      agentName={agent.name}
                      customerName={agent.currentCall?.customerName || ""}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-28 flex flex-col items-center justify-center text-center p-3 text-zinc-500 text-xs">
                  <Clock size={18} className="mb-1 text-zinc-600" />
                  <p>Agent is currently {agent.status.replace("_", " ")}.</p>
                  <span className="text-[10px] text-zinc-600 mt-1">
                    Waiting for next queue distribution
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
