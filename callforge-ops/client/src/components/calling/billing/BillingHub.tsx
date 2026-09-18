import React, { useState } from "react";
import {
  CreditCard,
  Sparkles,
  PlusCircle,
  Receipt,
  Zap,
  ShieldCheck,
  Building,
} from "lucide-react";
import { LiveSpendCounter } from "./LiveSpendCounter";
import { RateCard } from "./RateCard";
import { AutoRechargeConfig } from "./AutoRechargeConfig";
import { InvoicesTable } from "./InvoicesTable";
import { TopUpModal } from "./TopUpModal";

interface BillingHubProps {
  onUpgradePlanClick?: () => void;
}

export const BillingHub: React.FC<BillingHubProps> = ({ onUpgradePlanClick }) => {
  const [showTopUp, setShowTopUp] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTopUpSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
            TELEPHONY COMMERCE & USAGE
          </p>
          <h2 className="text-xl font-bold text-zinc-100">Billing, Wallet & Telephony Rates</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time balance, second-by-second call billing, auto-recharge and GST invoices
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowTopUp(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
          >
            <PlusCircle size={14} />
            <span>Top Up Wallet</span>
          </button>

          {onUpgradePlanClick && (
            <button
              type="button"
              onClick={onUpgradePlanClick}
              className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-violet-600/20"
            >
              <Sparkles size={14} />
              <span>Change Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Live Spend & Wallet Balance */}
      <LiveSpendCounter
        onTopUpClick={() => setShowTopUp(true)}
        refreshTrigger={refreshTrigger}
      />

      {/* 2. Current Plan Quota & Telecom Rate Card */}
      <RateCard onUpgradePlanClick={onUpgradePlanClick} />

      {/* 3. Auto-Recharge & Spend Safeguards */}
      <AutoRechargeConfig />

      {/* 4. GST Invoices & Recharge History Ledger */}
      <InvoicesTable key={refreshTrigger} />

      {/* Top Up Modal */}
      <TopUpModal
        isOpen={showTopUp}
        onClose={() => setShowTopUp(false)}
        onSuccess={handleTopUpSuccess}
      />
    </div>
  );
};
