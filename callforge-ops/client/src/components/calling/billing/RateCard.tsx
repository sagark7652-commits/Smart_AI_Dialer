import React, { useState, useEffect } from "react";
import { Sparkles, Phone, Radio, Bot, Shield, Check, ArrowUpRight } from "lucide-react";

interface RateCardProps {
  onUpgradePlanClick?: () => void;
}

export const RateCard: React.FC<RateCardProps> = ({ onUpgradePlanClick }) => {
  const [sub, setSub] = useState<{
    planId: string;
    planName: string;
    price: number;
    status: string;
    callingMinutesRemaining: number;
    renewalDate: string;
  }>({
    planId: "plan_pro",
    planName: "Growth Pro Calling Suite",
    price: 19999,
    status: "active",
    callingMinutesRemaining: 4850,
    renewalDate: new Date(Date.now() + 28 * 86400000).toISOString(),
  });

  useEffect(() => {
    fetch("/api/calling/subscription")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.subscription) setSub(data.subscription);
      })
      .catch(() => {});
  }, []);

  const rates = [
    {
      channel: "AI Voice Blast (Autonomous)",
      rate: "₹1.80 / min",
      detail: "Ultra-low latency streaming voice agent with interruption handling",
      icon: Bot,
      accent: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    },
    {
      channel: "WebRTC Agent Softphone",
      rate: "₹0.60 / min",
      detail: "Direct browser-based agent calling with HD Opus audio bridge",
      icon: Phone,
      accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      channel: "Cellular GSM PRI Trunk",
      rate: "₹0.90 / min",
      detail: "Twilio / Exotel direct PSTN cellular carrier termination",
      icon: Radio,
      accent: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    },
    {
      channel: "Neural STT & Transcription",
      rate: "₹0.40 / min",
      detail: "Multilingual Hindi, English, Hinglish speech recognition",
      icon: Shield,
      accent: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Current Active Plan Card */}
      <div className="p-5 rounded-xl border border-violet-800/40 bg-gradient-to-br from-violet-950/40 via-zinc-950 to-zinc-950 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-violet-400 bg-violet-950/70 border border-violet-700/60 px-2 py-0.5 rounded-full">
              Current Active Plan
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <h3 className="text-base font-bold text-zinc-100 mt-2.5">{sub.planName}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            ₹{sub.price.toLocaleString("en-IN")}/month billed annually
          </p>

          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Included Minutes:</span>
              <span className="font-mono font-bold text-zinc-100">
                {sub.callingMinutesRemaining.toLocaleString()} mins left
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 rounded-full"
                style={{ width: `${Math.min(100, (sub.callingMinutesRemaining / 5000) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Used: {(5000 - sub.callingMinutesRemaining).toLocaleString()} mins</span>
              <span>Next Cycle: {new Date(sub.renewalDate).toLocaleDateString("en-IN")}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onUpgradePlanClick}
          className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-md shadow-violet-600/30"
        >
          <Sparkles size={14} /> Upgrade Plan / Add Concurrent Lines
        </button>
      </div>

      {/* Telephony Rate Card (2 Cols) */}
      <div className="lg:col-span-2 p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
          <div>
            <h4 className="text-xs font-bold text-zinc-100">Direct Carrier Telephony Rate Card</h4>
            <p className="text-[11px] text-zinc-400">
              Pay-as-you-go consumption deducted transparently per connected second
            </p>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">1 sec pulse billing</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {rates.map((r, i) => {
            const Icon = r.icon;
            return (
              <div
                key={i}
                className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/80 flex items-start gap-2.5"
              >
                <div className={`p-2 rounded-lg border shrink-0 ${r.accent}`}>
                  <Icon size={15} />
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-1">
                    <strong className="text-zinc-200 font-semibold">{r.channel}</strong>
                    <span className="font-mono font-bold text-emerald-400 text-[11px] shrink-0">
                      {r.rate}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">{r.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
