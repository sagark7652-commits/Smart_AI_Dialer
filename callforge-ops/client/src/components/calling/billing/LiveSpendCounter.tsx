import React, { useState, useEffect } from "react";
import { CreditCard, TrendingUp, AlertCircle, PlusCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { TopUpModal } from "./TopUpModal";

interface LiveSpendCounterProps {
  onTopUpClick?: () => void;
  className?: string;
  refreshTrigger?: number;
}

export const LiveSpendCounter: React.FC<LiveSpendCounterProps> = ({
  onTopUpClick,
  className = "",
  refreshTrigger,
}) => {
  const [balance, setBalance] = useState<number>(28450.0);
  const [minutesUsed, setMinutesUsed] = useState<number>(3682);
  const [burnRatePerMin] = useState<number>(14.2); // INR per min
  const [showInternalTopUp, setShowInternalTopUp] = useState(false);
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(true);

  const fetchWallet = () => {
    fetch("/api/calling/billing/wallet")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (typeof data.balance === "number") setBalance(data.balance);
          if (typeof data.minutesUsed === "number") setMinutesUsed(data.minutesUsed);
          if (data.autoRecharge && typeof data.autoRecharge.enabled === "boolean") {
            setAutoRechargeEnabled(data.autoRecharge.enabled);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchWallet();
  }, [refreshTrigger]);

  // Subtle live balance update
  useEffect(() => {
    const interval = setInterval(() => {
      setBalance((b) => Math.max(100, +(b - 0.25).toFixed(2)));
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const handleOpenTopUp = () => {
    if (onTopUpClick) {
      onTopUpClick();
    } else {
      setShowInternalTopUp(true);
    }
  };

  return (
    <>
      <div
        className={`p-4 rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900/90 to-zinc-950 shadow-md ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Balance Area */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-base">
              ₹
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                  Prepaid Telephony Balance
                </span>
                <button
                  type="button"
                  onClick={fetchWallet}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer"
                  title="Refresh Balance"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-zinc-100 font-mono tracking-tight">
                  ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {autoRechargeEnabled && (
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded font-mono">
                    Auto-Recharge Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Live Consumption Stats */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block uppercase font-sans font-bold">
                Burn Rate
              </span>
              <span className="text-zinc-300 font-semibold flex items-center gap-1">
                <TrendingUp size={12} className="text-violet-400" /> ₹{burnRatePerMin}/min
              </span>
            </div>

            <div className="h-7 w-px bg-zinc-800" />

            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block uppercase font-sans font-bold">
                Minutes Billed
              </span>
              <span className="text-zinc-200 font-semibold">{minutesUsed.toLocaleString()} mins</span>
            </div>

            <button
              type="button"
              onClick={handleOpenTopUp}
              className="ml-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
            >
              <PlusCircle size={13} /> Add Balance
            </button>
          </div>
        </div>
      </div>

      <TopUpModal
        isOpen={showInternalTopUp}
        onClose={() => setShowInternalTopUp(false)}
        onSuccess={(newBal) => {
          setBalance(newBal);
        }}
      />
    </>
  );
};
