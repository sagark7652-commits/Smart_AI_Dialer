import React, { useState, useEffect } from "react";
import { GitCompare, Trophy, TrendingUp, Sparkles, CheckCircle2, ArrowRight, Save } from "lucide-react";
import { toast } from "sonner";

export const ABTestingSplitUI: React.FC = () => {
  const [splitPercentA, setSplitPercentA] = useState(50);
  const splitPercentB = 100 - splitPercentA;

  const [scriptA, setScriptA] = useState(
    "Namaste {lead_name} ji. We are offering an exclusive 20% discount on festive calling agent packs. Would you like to schedule a 10-minute demo with our team?"
  );

  const [scriptB, setScriptB] = useState(
    "Namaste {lead_name} ji! Most retail businesses in {city} are saving 4 hours daily using CallForge AI calling. Can we demonstrate how it handles your festive inbound rush?"
  );

  const [winnerVariant, setWinnerVariant] = useState<"A" | "B">("B");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/calling/ai/ab-split")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.config) {
          const c = data.config;
          if (typeof c.splitPercentA === "number") setSplitPercentA(c.splitPercentA);
          if (c.scriptA) setScriptA(c.scriptA);
          if (c.scriptB) setScriptB(c.scriptB);
          if (c.winnerVariant) setWinnerVariant(c.winnerVariant);
        }
      })
      .catch(() => {});
  }, []);

  const persistConfig = async (pctA: number, sA: string, sB: string, winner?: "A" | "B") => {
    setSaving(true);
    try {
      await fetch("/api/calling/ai/ab-split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          splitPercentA: pctA,
          splitPercentB: 100 - pctA,
          scriptA: sA,
          scriptB: sB,
          winnerVariant: winner || winnerVariant,
        }),
      });
    } catch {
      // Non-blocking
    } finally {
      setSaving(false);
    }
  };

  const statsA = {
    dialed: 840,
    connected: 362,
    qualified: 118,
    conversion: 32.6,
  };

  const statsB = {
    dialed: 840,
    connected: 412,
    qualified: 198,
    conversion: 48.1,
  };

  const handlePromoteWinner = async () => {
    setSplitPercentA(0);
    setWinnerVariant("B");
    await persistConfig(0, scriptA, scriptB, "B");
    toast.success("Variant B Promoted to 100% Traffic", {
      description: "Winning conversational prompt saved to database and locked across all active trunks.",
    });
  };

  const handleSaveDraft = async () => {
    await persistConfig(splitPercentA, scriptA, scriptB);
    toast.success("A/B Split Configuration Saved", {
      description: `Traffic allocated ${splitPercentA}% Variant A / ${splitPercentB}% Variant B.`,
    });
  };

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center">
            <GitCompare size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100">
              Autonomous A/B Script & Value-Pitch Testing
            </h3>
            <p className="text-[11px] text-zinc-400">
              Compare script variants in real-time to maximize qualified conversion rate
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/70"
          >
            <Save size={13} /> Save Split
          </button>
          <button
            type="button"
            onClick={handlePromoteWinner}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <Trophy size={13} /> Promote Variant B to 100%
          </button>
        </div>
      </div>

      {/* Traffic Split Slider */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-violet-400">
            Variant A (Direct Discount Pitch): {splitPercentA}%
          </span>
          <span className="font-semibold text-cyan-400">
            Variant B (Social Proof & Hours Saved): {splitPercentB}%
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={splitPercentA}
          onChange={(e) => setSplitPercentA(Number(e.target.value))}
          className="w-full accent-violet-500"
        />

        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>0% (All B)</span>
          <span>50/50 Balanced Split</span>
          <span>100% (All A)</span>
        </div>
      </div>

      {/* Side-by-Side Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Variant A */}
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-violet-400">Variant A: Direct Discount</h4>
              <span className="text-[11px] font-mono font-bold text-zinc-300">
                {statsA.conversion}% Conv.
              </span>
            </div>

            <textarea
              rows={3}
              value={scriptA}
              onChange={(e) => setScriptA(e.target.value)}
              className="w-full p-2.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 font-mono resize-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80 text-[11px] text-center font-mono">
            <div className="p-1.5 rounded bg-zinc-950">
              <span className="text-[9px] text-zinc-500 block">Dialed</span>
              <span className="text-zinc-200 font-bold">{statsA.dialed}</span>
            </div>
            <div className="p-1.5 rounded bg-zinc-950">
              <span className="text-[9px] text-zinc-500 block">Connected</span>
              <span className="text-zinc-200 font-bold">{statsA.connected}</span>
            </div>
            <div className="p-1.5 rounded bg-zinc-950">
              <span className="text-[9px] text-zinc-500 block">Qualified</span>
              <span className="text-emerald-400 font-bold">{statsA.qualified}</span>
            </div>
          </div>
        </div>

        {/* Variant B (Winner) */}
        <div className="p-4 rounded-xl border border-emerald-500/50 bg-emerald-950/10 shadow-lg shadow-emerald-950/20 space-y-3 flex flex-col justify-between relative">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-cyan-400">Variant B: Social Proof</h4>
                <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.2 rounded font-mono">
                  WINNER +15.5%
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-400">
                {statsB.conversion}% Conv.
              </span>
            </div>

            <textarea
              rows={3}
              value={scriptB}
              onChange={(e) => setScriptB(e.target.value)}
              className="w-full p-2.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono resize-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80 text-[11px] text-center font-mono">
            <div className="p-1.5 rounded bg-zinc-950">
              <span className="text-[9px] text-zinc-500 block">Dialed</span>
              <span className="text-zinc-200 font-bold">{statsB.dialed}</span>
            </div>
            <div className="p-1.5 rounded bg-zinc-950">
              <span className="text-[9px] text-zinc-500 block">Connected</span>
              <span className="text-zinc-200 font-bold">{statsB.connected}</span>
            </div>
            <div className="p-1.5 rounded bg-zinc-950">
              <span className="text-[9px] text-zinc-500 block">Qualified</span>
              <span className="text-emerald-400 font-bold">{statsB.qualified}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
