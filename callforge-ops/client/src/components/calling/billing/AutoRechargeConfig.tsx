import React, { useState, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Building,
  Save,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

export const AutoRechargeConfig: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [threshold, setThreshold] = useState(5000);
  const [rechargeAmount, setRechargeAmount] = useState(25000);
  const [paymentMethod, setPaymentMethod] = useState("upi_autopay");
  const [gstin, setGstin] = useState("27AABCC1234F1Z8");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/calling/billing/autorecharge")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.autoRecharge) {
          const cfg = data.autoRecharge;
          if (typeof cfg.enabled === "boolean") setEnabled(cfg.enabled);
          if (cfg.threshold) setThreshold(cfg.threshold);
          if (cfg.rechargeAmount) setRechargeAmount(cfg.rechargeAmount);
          if (cfg.paymentMethod) setPaymentMethod(cfg.paymentMethod);
          if (cfg.gstin) setGstin(cfg.gstin);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/calling/billing/autorecharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          threshold,
          rechargeAmount,
          paymentMethod,
          gstin,
        }),
      });
      const data = await res.json();
      toast.success("Auto-Recharge Policy Saved to Storage", {
        description: `Wallet will automatically top up ₹${rechargeAmount.toLocaleString()} when balance falls below ₹${threshold.toLocaleString()}. (e-Mandate: ${paymentMethod})`,
      });
    } catch {
      toast.error("Failed to save auto-recharge settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/70 space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
            <CreditCard size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100">Auto-Recharge & Spend Safeguards</h3>
            <p className="text-[11px] text-zinc-400">
              Prevent campaign stalling by automatically topping up telephony trunks
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          <span className="ml-2 text-xs font-semibold text-zinc-300">
            {enabled ? "Active" : "Disabled"}
          </span>
        </label>
      </div>

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
              Low Balance Threshold (INR)
            </label>
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
              <span className="text-zinc-500 font-bold mr-1.5">₹</span>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full bg-transparent text-zinc-100 font-mono focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Triggers auto-recharge when balance hits this floor
            </span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
              Auto Top-Up Amount (INR)
            </label>
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
              <span className="text-zinc-500 font-bold mr-1.5">₹</span>
              <input
                type="number"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(Number(e.target.value))}
                className="w-full bg-transparent text-zinc-100 font-mono focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Credited instantly to avoid queue disconnects
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
              Mandated Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100"
            >
              <option value="upi_autopay">UPI AutoPay (NPCI e-Mandate)</option>
              <option value="corporate_card">Corporate Credit Card (Mastercard / Visa)</option>
              <option value="netbanking">Direct Bank Debit (RTGS / NEFT)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
              India GSTIN for Input Tax Credit
            </label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="e.g. 27AABCC1234F1Z8"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 font-mono uppercase"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span>Bank e-Mandate validated under RBI recurrent payment framework.</span>
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <Save size={13} /> Save Safeguards
          </button>
        </div>
      </form>
    </div>
  );
};
