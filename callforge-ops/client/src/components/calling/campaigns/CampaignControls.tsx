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
    id: initialCampaign?.id || "camp-001",
    name: initialCampaign?.name || "No Active Campaign",
    totalLeads: initialCampaign?.totalLeads || 0,
    dialed: initialCampaign?.dialed || 0,
    connected: initialCampaign?.connected || 0,
    qualified: initialCampaign?.qualified || 0,
    failed: initialCampaign?.failed || 0,
    liveCalls: initialCampaign?.liveCalls || 0,
    status: (initialCampaign?.status as any) || "Draft",
    avgDuration: initialCampaign?.avgDuration || "00:00",
  });

  const [isPolling, setIsPolling] = useState(true);
  const [lastPollTime, setLastPollTime] = useState<string>("just now");

  useEffect(() => {
    if (initialCampaign) {
      setStats((prev) => ({
        ...prev,
        id: initialCampaign.id || prev.id,
        name: initialCampaign.name || prev.name,
        totalLeads: initialCampaign.totalLeads ?? prev.totalLeads,
        dialed: initialCampaign.dialed ?? prev.dialed,
        connected: initialCampaign.connected ?? prev.connected,
        qualified: initialCampaign.qualified ?? prev.qualified,
        failed: initialCampaign.failed ?? prev.failed,
        liveCalls: initialCampaign.liveCalls ?? prev.liveCalls,
        status: (initialCampaign.status as any) || prev.status,
        avgDuration: initialCampaign.avgDuration || prev.avgDuration,
      }));
    }
  }, [initialCampaign?.id, initialCampaign?.status, initialCampaign?.name, initialCampaign?.totalLeads, initialCampaign?.connected]);

  // Live polling effect (fetch from backend every 5 seconds if running)
  useEffect(() => {
    if (!isPolling || stats.status !== "Running") return;

    const fetchStats = () => {
      fetch(`/api/calling/campaigns/${stats.id}/stats`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.stats) {
            setStats((prev) => ({
              ...prev,
              totalLeads: data.stats.totalLeads ?? prev.totalLeads,
              dialed: data.stats.dialed ?? prev.dialed,
              connected: data.stats.connected ?? prev.connected,
              qualified: data.stats.qualified ?? prev.qualified,
              failed: data.stats.failed ?? prev.failed,
              liveCalls: data.stats.liveCalls ?? 0,
              avgDuration: data.stats.averageDurationSeconds
                ? `${Math.floor(data.stats.averageDurationSeconds / 60).toString().padStart(2, "0")}:${(data.stats.averageDurationSeconds % 60).toString().padStart(2, "0")}`
                : prev.avgDuration,
            }));
          }
          setLastPollTime(new Date().toLocaleTimeString());
        })
        .catch(() => {});
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [isPolling, stats.status, stats.id]);

  const toggleRunPause = async () => {
    const nextStatus = stats.status === "Running" ? "Paused" : "Running";
    setStats((prev) => ({ ...prev, status: nextStatus }));
    onStatusChange?.(nextStatus);

    try {
      const endpoint = nextStatus === "Running" ? "resume" : "pause";
      await fetch(`/api/calling/campaigns/${stats.id}/${endpoint}`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Error toggling campaign status on backend:", err);
    }

    toast(nextStatus === "Running" ? "Campaign resumed" : "Campaign paused", {
      description:
        nextStatus === "Running"
          ? "Dialer queues are actively placing outbound calls."
          : "Active calls remain connected, but no new numbers will be dialed.",
    });
  };

  const handleStop = async () => {
    setStats((prev) => ({ ...prev, status: "Completed", liveCalls: 0 }));
    onStatusChange?.("Completed");
    try {
      await fetch(`/api/calling/campaigns/${stats.id}/stop`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Error stopping campaign on backend:", err);
    }
    toast.error("Campaign halted", {
      description: "Dialer stopped. Campaign marked as Completed.",
    });
  };

  const progressPercent = stats.totalLeads > 0 ? Math.min(100, Math.round((stats.dialed / stats.totalLeads) * 100)) : 0;
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
