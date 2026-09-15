import React from "react";
import { Zap, Users, Play, Sparkles } from "lucide-react";

export type DialerMode = "preview" | "progressive" | "predictive" | "ai_blast";

export interface DialerModeInfo {
  id: DialerMode;
  name: string;
  description: string;
  speed: string;
  pacingRatio: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tag: string;
  color: string;
}

export const DIALER_MODES: DialerModeInfo[] = [
  {
    id: "preview",
    name: "Preview Dialer",
    description: "Agent reviews lead context & CRM history before manually triggering each call.",
    speed: "Paced / 1 call per agent",
    pacingRatio: "1:1",
    icon: Users,
    tag: "High Value B2B",
    color: "amber",
  },
  {
    id: "progressive",
    name: "Progressive Dialer",
    description: "Dials next contact automatically the moment an agent becomes available.",
    speed: "Automatic / Zero idle lag",
    pacingRatio: "1:1",
    icon: Play,
    tag: "Renewal & Sales",
    color: "cyan",
  },
  {
    id: "predictive",
    name: "Predictive Dialer",
    description: "Dials ahead of agent availability using statistical connect-rate algorithms.",
    speed: "Aggressive / Overdialing",
    pacingRatio: "2.5:1",
    icon: Zap,
    tag: "Collections / Leads",
    color: "violet",
  },
  {
    id: "ai_blast",
    name: "AI Autonomous Blast",
    description: "Runs fully automated AI voice agents concurrently with real-time intent qualification.",
    speed: "Ultra-scale / Up to 100 concurrent",
    pacingRatio: "10:1",
    icon: Sparkles,
    tag: "India-first AI",
    color: "rose",
  },
];

interface DialerModeSelectorProps {
  value: DialerMode;
  onChange: (mode: DialerMode) => void;
  className?: string;
}

export const DialerModeSelector: React.FC<DialerModeSelectorProps> = ({
  value,
  onChange,
  className = "",
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
        Dialer Mode & Cadence
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {DIALER_MODES.map((mode) => {
          const isSelected = value === mode.id;
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={`p-3 rounded-lg border text-left transition-all relative cursor-pointer ${
                isSelected
                  ? "border-violet-500/80 bg-violet-950/30 shadow-sm shadow-violet-500/20 ring-1 ring-violet-500/40"
                  : "border-zinc-800/90 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center ${
                      isSelected
                        ? "bg-violet-500/20 text-violet-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <Icon size={14} />
                  </div>
                  <span className="font-semibold text-xs text-zinc-100">{mode.name}</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                    isSelected
                      ? "bg-violet-500/25 text-violet-300 border border-violet-500/30"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {mode.pacingRatio}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed mb-2">
                {mode.description}
              </p>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-800/80">
                <span>{mode.speed}</span>
                <span className="text-zinc-400 font-medium">{mode.tag}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
