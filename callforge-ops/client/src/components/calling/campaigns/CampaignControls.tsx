import React, { useState, useEffect } from "react";
import { Play, Pause, Square, RefreshCw, Radio, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export interface CampaignStats {
  id: string;
  name: string;
  totalLeads: number;
  dialed: number;
  connected: number;
  qualified: number;
  failed: number;
  liveCalls: number;
  status: "Running" | "Paused" | "Completed" | "Draft";
  avgDuration: string;
}

interface CampaignControlsProps {
  initialCampaign?: Partial<CampaignStats>;
  onStatusChange?: (status: CampaignStats["status"]) => void;
  className?: string;
}

export const CampaignControls: React.FC<CampaignControlsProps> = ({
  initialCampaign,
  onStatusChange,
  className = "",
}) => {
  const [stats, setStats] = useState<CampaignStats>({
    id: initialCampaign?.id || "camp-101",
    name: initialCampaign?.name || "Festive season follow-up",
    totalLeads: initialCampaign?.totalLeads || 2480,
    dialed: initialCampaign?.dialed || 1686,
    connected: initialCampaign?.connected || 842,
    qualified: initialCampaign?.qualified || 286,
    failed: initialCampaign?.failed || 120,
    liveCalls: initialCampaign?.liveCalls || 14,
    status: (initialCampaign?.status as any) || "Running",
    avgDuration: initialCampaign?.avgDuration || "03:42",
  });

  const [isPolling, setIsPolling] = useState(true);
  const [lastPollTime, setLastPollTime] = useState<string>("just now");

  // Simulated live polling effect (every 5 seconds)
  useEffect(() => {
    if (!isPolling || stats.status !== "Running") return;

    const interval = setInterval(() => {
      setStats((prev) => {
        if (prev.dialed >= prev.totalLeads) return prev;
        const newDials = Math.floor(Math.random() * 4) + 1;
        const newConnects = Math.random() > 0.4 ? 1 : 0;
        const newQualified = newConnects && Math.random() > 0.6 ? 1 : 0;

        return {
          ...prev,
          dialed: Math.min(prev.totalLeads, prev.dialed + newDials),
          connected: prev.connected + newConnects,
          qualified: prev.qualified + newQualified,
          liveCalls: Math.floor(Math.random() * 8) + 10,
        };
      });
      setLastPollTime(new Date().toLocaleTimeString());
    }, 5000);

    return () => clearInterval(interval);
  }, [isPolling, stats.status]);

  const toggleRunPause = () => {
    const nextStatus = stats.status === "Running" ? "Paused" : "Running";
    setStats((prev) => ({ ...prev, status: nextStatus }));
    onStatusChange?.(nextStatus);
    toast(nextStatus === "Running" ? "Campaign resumed" : "Campaign paused", {
      description:
        nextStatus === "Running"
          ? "Dialer queues are actively placing outbound calls."
          : "Active calls remain connected, but no new numbers will be dialed.",
    });
  };

  const handleStop = () => {
    setStats((prev) => ({ ...prev, status: "Completed", liveCalls: 0 }));
    onStatusChange?.("Completed");
    toast.error("Campaign halted", {
      description: "Dialer stopped. Campaign marked as Completed.",
    });
  };

  const progressPercent = Math.min(100, Math.round((stats.dialed / stats.totalLeads) * 100));
  const connectRate = stats.dialed > 0 ? ((stats.connected / stats.dialed) * 100).toFixed(1) : "0";
  const qualRate =
    stats.connected > 0 ? ((stats.qualified / stats.connected) * 100).toFixed(1) : "0";

  return (
    <div className={`p-4 rounded-xl border border-zinc-800 bg-zinc-900/70 space-y-4 ${className}`}>
      {/* Header with Title & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              stats.status === "Running"
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                : stats.status === "Paused"
                ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                : "bg-zinc-500"
            }`}
          />
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">{stats.name}</h4>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span>ID: {stats.id}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Radio size={12} className={stats.status === "Running" ? "text-emerald-400" : ""} />
                {stats.liveCalls} live calls now
              </span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleRunPause}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              stats.status === "Running"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm"
            }`}
          >
            {stats.status === "Running" ? (
              <>
                <Pause size={13} /> Pause Campaign
              </>
            ) : (
              <>
                <Play size={13} /> Resume Campaign
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleStop}
            disabled={stats.status === "Completed"}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-rose-400 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Square size={12} /> Stop
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPolling(!isPolling);
              toast.info(isPolling ? "Live polling paused" : "Live polling resumed");
            }}
            title={`Polling /api/calling/campaigns/${stats.id}/stats every 5s`}
            className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
              isPolling
                ? "border-violet-500/50 bg-violet-950/40 text-violet-300"
                : "border-zinc-800 bg-zinc-900 text-zinc-500"
            }`}
          >
            <RefreshCw size={13} className={isPolling ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-mono">
          <span>
            Progress:{" "}
            <strong className="text-zinc-100 font-semibold">{stats.dialed.toLocaleString()}</strong>{" "}
            / {stats.totalLeads.toLocaleString()} leads
          </span>
          <span className="text-violet-400 font-bold">{progressPercent}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-zinc-800/90 overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
          <span className="text-[10px] uppercase font-medium text-zinc-400 block">Connected</span>
          <span className="text-sm font-semibold text-zinc-100 font-mono">
            {stats.connected.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">{connectRate}% rate</span>
        </div>

        <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
          <span className="text-[10px] uppercase font-medium text-zinc-400 block">Qualified</span>
          <span className="text-sm font-semibold text-emerald-400 font-mono">
            {stats.qualified.toLocaleString()}
          </span>
          <span className="text-[10px] text-emerald-500/80 block mt-0.5">{qualRate}% of connected</span>
        </div>

        <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
          <span className="text-[10px] uppercase font-medium text-zinc-400 block">Avg Talk Time</span>
          <span className="text-sm font-semibold text-zinc-100 font-mono">{stats.avgDuration}</span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">Telecom billable</span>
        </div>

        <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
          <span className="text-[10px] uppercase font-medium text-zinc-400 block">Polling Status</span>
          <span className="text-sm font-semibold text-violet-300 flex items-center gap-1 font-mono">
            <CheckCircle2 size={13} /> {isPolling ? "Live" : "Idle"}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-0.5">{lastPollTime}</span>
        </div>
      </div>
    </div>
  );
};
