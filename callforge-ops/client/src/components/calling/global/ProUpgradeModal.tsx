import React from "react";
import { X, Sparkles, Check, ArrowRight, ShieldCheck, Zap, Server, Headphones } from "lucide-react";
import { toast } from "sonner";

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProUpgradeModal({ isOpen, onClose }: ProUpgradeModalProps) {
  if (!isOpen) return null;

  const handleUpgrade = (tierName: string) => {
    toast.success(`Plan request submitted for ${tierName}! Enterprise team will activate dedicated trunks.`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 border-b border-zinc-800 bg-gradient-to-r from-violet-950/40 via-zinc-900/50 to-zinc-950 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 mb-2">
              <Sparkles size={13} /> CallForge Ops Licensing
            </div>
            <h2 className="text-xl font-bold text-white">Upgrade Telephony & AI Capacity</h2>
            <p className="text-xs text-zinc-400 mt-1">Scale concurrent voice channels, lower latency, and unlock custom AI neural fine-tuning.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tiers Grid */}
        <div className="p-6 grid md:grid-cols-2 gap-4">
          {/* Growth Plan (Active) */}
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-200">Growth Pro</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  CURRENT PLAN
                </span>
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                ₹19,999 <span className="text-xs font-normal text-zinc-500">/ month</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">Ideal for fast-scaling B2C call centers & outbound teams.</p>

              <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0" /> 50 Concurrent AI Dialing Channels
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0" /> 5 Indian Regional Neural Voices
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0" /> Full TRAI DNC 09:00–21:00 Auto-Wash
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-400 shrink-0" /> WebRTC HD Opus 48kHz Audio
                </li>
              </ul>
            </div>

            <button
              disabled
              className="mt-6 w-full py-2.5 rounded-lg bg-zinc-800 text-xs font-semibold text-zinc-400 cursor-default"
            >
              Active Subscription
            </button>
          </div>

          {/* HyperScale Enterprise */}
          <div className="p-5 rounded-xl border border-violet-500/50 bg-gradient-to-b from-violet-950/20 to-zinc-900/50 flex flex-col justify-between relative shadow-lg shadow-violet-950/40">
            <div className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white shadow">
              RECOMMENDED
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-violet-300">HyperScale Dedicated</h3>
                <Zap size={15} className="text-violet-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">
                ₹49,999 <span className="text-xs font-normal text-zinc-500">/ month</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">Dedicated SIP trunks, custom fine-tuned personas & sub-120ms latency SLA.</p>

              <ul className="mt-4 space-y-2 text-xs text-zinc-200">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-violet-400 shrink-0" /> 500+ Dedicated PRI/SIP Trunks
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-violet-400 shrink-0" /> Custom Voice Clone (Own Brand Voice)
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-violet-400 shrink-0" /> Guaranteed 120ms End-to-End Latency
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-violet-400 shrink-0" /> 24/7 Dedicated Telephony Engineer
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-violet-400 shrink-0" /> On-Premise PBX / Asterisk Bridge
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleUpgrade("HyperScale Dedicated")}
              className="mt-6 w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/30"
            >
              Request Upgrade <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>TRAI & DoT Enterprise Certified Trunking</span>
          </div>
          <span>Instant provision within 2 hours</span>
        </div>
      </div>
    </div>
  );
}
