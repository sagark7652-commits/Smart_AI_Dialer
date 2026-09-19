import React, { useState, useRef, useEffect } from "react";
import { Headphones, MessageSquare, Volume2, UserX, MoreVertical, ShieldAlert, Radio } from "lucide-react";
import { toast } from "sonner";

interface ActionButtonsGroupProps {
  callId: string;
  agentName: string;
  customerName: string;
  className?: string;
  onActionTriggered?: (action: "listen" | "whisper" | "barge" | "takeover") => void;
}

export const ActionButtonsGroup: React.FC<ActionButtonsGroupProps> = ({
  callId,
  agentName,
  customerName,
  className = "",
  onActionTriggered,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const playSupervisorTone = (freq1 = 440, freq2 = 480, durationMs = 180) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.frequency.value = freq1;
      osc2.frequency.value = freq2;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + durationMs / 1000);
      osc2.stop(ctx.currentTime + durationMs / 1000);
    } catch {}
  };

  const handleAction = async (action: "listen" | "whisper" | "barge" | "takeover") => {
    setDropdownOpen(false);
    onActionTriggered?.(action);

    // Audio feedback for supervisor operations
    if (action === "listen") playSupervisorTone(440, 480, 160);
    if (action === "whisper") playSupervisorTone(580, 620, 200);
    if (action === "barge") playSupervisorTone(700, 800, 250);
    if (action === "takeover") playSupervisorTone(350, 400, 300);

    try {
      await fetch("/api/calling/call-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, action, supervisorId: "sup-01" }),
      });
    } catch (err) {
      console.error("Failed to notify backend call-action:", err);
    }

    switch (action) {
      case "listen":
        toast.info(`Silent Monitoring Started`, {
          description: `Listening to ${agentName} talking with ${customerName}. You are muted on both ends.`,
        });
        break;
      case "whisper":
        toast.success(`Supervisor Whisper Active`, {
          description: `Audio connected to ${agentName} only. The customer cannot hear you.`,
        });
        break;
      case "barge":
        toast.warning(`Barge-in: 3-Way Bridge Active`, {
          description: `Merged your audio into the active call. Both ${agentName} and ${customerName} can hear you.`,
        });
        break;
      case "takeover":
        toast.error(`Call Takeover Completed`, {
          description: `${agentName} has been released to Ready state. You are now speaking directly with ${customerName}.`,
        });
        break;
    }
  };

  return (
    <div className={`flex items-center gap-1 relative ${className}`} ref={menuRef}>
      {/* Quick Action Icons */}
      <button
        type="button"
        onClick={() => handleAction("listen")}
        title="Silent Monitor: Listen in"
        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer border border-zinc-700/60"
      >
        <Headphones size={13} />
      </button>

      <button
        type="button"
        onClick={() => handleAction("whisper")}
        title="Whisper Coaching: Speak to agent only"
        className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 hover:text-emerald-300 transition cursor-pointer border border-emerald-700/40"
      >
        <MessageSquare size={13} />
      </button>

      <button
        type="button"
        onClick={() => handleAction("barge")}
        title="3-Way Barge: Merge audio with customer"
        className="p-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 hover:text-amber-300 transition cursor-pointer border border-amber-700/40"
      >
        <Volume2 size={13} />
      </button>

      {/* 3-Dots Ellipsis Dropdown Trigger */}
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        title="Supervisor Telephony Menu"
        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer border border-zinc-800"
      >
        <MoreVertical size={13} />
      </button>

      {/* Sleek Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 top-8 w-48 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider border-b border-zinc-800/80">
            Supervisor Actions
          </div>
          <button
            type="button"
            onClick={() => handleAction("listen")}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 text-zinc-200 hover:bg-zinc-900 hover:text-white transition"
          >
            <Headphones size={13} className="text-zinc-400" />
            <span>Silent Monitor</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction("whisper")}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 text-emerald-300 hover:bg-emerald-950/30 transition"
          >
            <MessageSquare size={13} className="text-emerald-400" />
            <span>Whisper Coaching</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction("barge")}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 text-amber-300 hover:bg-amber-950/30 transition"
          >
            <Volume2 size={13} className="text-amber-400" />
            <span>3-Way Call Barge</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction("takeover")}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 text-rose-400 hover:bg-rose-950/30 transition"
          >
            <UserX size={13} className="text-rose-400" />
            <span>Call Takeover</span>
          </button>
        </div>
      )}
    </div>
  );
};
