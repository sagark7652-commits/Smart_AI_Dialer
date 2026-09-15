import React, { useState, useEffect } from "react";
import { ChevronDown, Coffee, CircleDot, Headphones, LogOut, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export type AgentStatusType = "ready" | "on_call" | "wrap_up" | "break" | "offline";

export interface AgentStatusConfig {
  id: AgentStatusType;
  label: string;
  color: string;
  dotColor: string;
  bgColor: string;
  canReceiveCalls: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const AGENT_STATUSES: Record<AgentStatusType, AgentStatusConfig> = {
  ready: {
    id: "ready",
    label: "Ready for calls",
    color: "text-emerald-400",
    dotColor: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    bgColor: "bg-emerald-950/40 border-emerald-800/40",
    canReceiveCalls: true,
    icon: CheckCircle,
  },
  on_call: {
    id: "on_call",
    label: "On live call",
    color: "text-violet-400",
    dotColor: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)] animate-pulse",
    bgColor: "bg-violet-950/40 border-violet-800/40",
    canReceiveCalls: false,
    icon: Headphones,
  },
  wrap_up: {
    id: "wrap_up",
    label: "Wrap-up / Dispo",
    color: "text-amber-400",
    dotColor: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
    bgColor: "bg-amber-950/40 border-amber-800/40",
    canReceiveCalls: false,
    icon: CircleDot,
  },
  break: {
    id: "break",
    label: "On break / Lunch",
    color: "text-orange-400",
    dotColor: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]",
    bgColor: "bg-orange-950/40 border-orange-800/40",
    canReceiveCalls: false,
    icon: Coffee,
  },
  offline: {
    id: "offline",
    label: "Offline",
    color: "text-zinc-400",
    dotColor: "bg-zinc-500",
    bgColor: "bg-zinc-900 border-zinc-800",
    canReceiveCalls: false,
    icon: LogOut,
  },
};

interface AgentStatusDropdownProps {
  currentStatus?: AgentStatusType;
  onStatusChange?: (status: AgentStatusType) => void;
  agentName?: string;
  className?: string;
}

export const AgentStatusDropdown: React.FC<AgentStatusDropdownProps> = ({
  currentStatus = "ready",
  onStatusChange,
  agentName = "Arjun Mehta",
  className = "",
}) => {
  const [status, setStatus] = useState<AgentStatusType>(currentStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [secondsInStatus, setSecondsInStatus] = useState(0);

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  // Status timer
  useEffect(() => {
    setSecondsInStatus(0);
    const interval = setInterval(() => {
      setSecondsInStatus((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const handleSelect = (newStatus: AgentStatusType) => {
    setStatus(newStatus);
    setIsOpen(false);
    onStatusChange?.(newStatus);

    const config = AGENT_STATUSES[newStatus];
    if (config.canReceiveCalls) {
      toast.success("Agent status: Ready", {
        description: "Inbound and progressive outbound calls will be routed to your browser softphone.",
      });
    } else {
      toast.info(`Agent status: ${config.label}`, {
        description: "Call routing paused. You will not receive any new calls.",
      });
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const currentConfig = AGENT_STATUSES[status];

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${currentConfig.bgColor} hover:brightness-110`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${currentConfig.dotColor}`} />
        <span className={currentConfig.color}>{currentConfig.label}</span>
        <span className="text-[11px] font-mono text-zinc-400 font-normal">
          ({formatTimer(secondsInStatus)})
        </span>
        <ChevronDown size={14} className="text-zinc-400 ml-0.5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in-80 zoom-in-95 duration-150">
            <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                Agent Status Control
              </span>
              <span className="text-xs text-zinc-300 font-medium">{agentName}</span>
            </div>

            {Object.values(AGENT_STATUSES).map((item) => {
              const isSelected = item.id === status;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer text-left ${
                    isSelected ? "bg-zinc-900 font-semibold" : "hover:bg-zinc-900/60 font-normal"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${item.dotColor}`} />
                    <span className={item.color}>{item.label}</span>
                  </div>
                  <Icon size={14} className="text-zinc-500" />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
