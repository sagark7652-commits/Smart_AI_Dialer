import React, { useState, useEffect } from "react";
import { X, Sparkles, Check, ArrowRight, ShieldCheck, Zap, CreditCard, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanUpdated?: () => void;
}

export function ProUpgradeModal({ isOpen, onClose, onPlanUpdated }: ProUpgradeModalProps) {
  const [currentPlan, setCurrentPlan] = useState<{
    planId: string;
    planName: string;
    price: number;
    status: string;
    callingMinutesRemaining: number;
    renewalDate: string;
    lastPaymentId?: string;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"select" | "success">("select");
  const [activePaymentId, setActivePaymentId] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setPaymentStep("select");
      fetch("/api/calling/subscription")
        .then((res) => res.json())
        .then((d) => {
          if (d.subscription) setCurrentPlan(d.subscription);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartCheckout = async (planId: string, planName: string, price: number) => {
    setIsProcessing(true);
    try {
      const orderRes = await fetch("/api/calling/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, planName, price }),
      });
      const orderData = await orderRes.json();

      const mockPayId = "pay_rzp_" + Math.random().toString(36).substring(2, 10);
      setActivePaymentId(mockPayId);

      const verifyRes = await fetch("/api/calling/billing/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderData.orderId,
          paymentId: mockPayId,
          planId,
          planName,
          price,
        }),
      });

      const verifyData = await verifyRes.json();
      if (verifyData.success) {
        setCurrentPlan(verifyData.subscription);
        setPaymentStep("success");
        toast.success("Subscription Activated!", {
          description: planName + " is now active on your workspace.",
        });
        if (onPlanUpdated) onPlanUpdated();
      } else {
        toast.error("Payment verification failed.");
      }
    } catch {
      toast.error("Checkout transaction error.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 p-4"
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
              <Sparkles size={13} /> Commercial Calling Plans
            </div>
            <h2 className="text-xl font-bold text-white">Upgrade Telephony & AI Concurrency</h2>
            <p className="text-xs text-zinc-400 mt-1">Instant provision: Dedicated PRI trunks, lower latency, and expanded calling balance.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {paymentStep === "success" ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Payment & Plan Activation Successful!</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Your account is credited with extra minutes. Payment ID: <span className="font-mono text-emerald-400">{activePaymentId}</span>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between text-zinc-300">
                <span>Active Plan:</span>
                <span className="font-bold text-white">{currentPlan?.planName}</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Calling Minutes Balance:</span>
                <span className="font-bold text-emerald-400">{currentPlan?.callingMinutesRemaining?.toLocaleString()} mins</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>Next Renewal Date:</span>
                <span className="font-mono text-zinc-400">
                  {currentPlan?.renewalDate ? new Date(currentPlan.renewalDate).toLocaleDateString("en-IN") : "In 30 days"}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              Back to Operations Console
            </button>
          </div>
        ) : (
          /* Tiers Grid */
          <div className="p-6 grid md:grid-cols-2 gap-4">
            {/* Growth Plan */}
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200">Growth Pro</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    POPULAR
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
                    <Check size={14} className="text-emerald-400 shrink-0" /> +2,000 Calling Minutes Included
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-400 shrink-0" /> Full TRAI DNC 09:00–21:00 Auto-Wash
                  </li>
                </ul>
              </div>

              <button
                disabled={isProcessing}
                onClick={() => handleStartCheckout("plan_growth", "Growth Pro", 19999)}
                className="mt-6 w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />}
                <span>Activate Growth Plan</span>
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
                    <Check size={14} className="text-violet-400 shrink-0" /> +5,000 Calling Minutes Included
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-violet-400 shrink-0" /> Guaranteed 120ms End-to-End Latency
                  </li>
                </ul>
              </div>

              <button
                disabled={isProcessing}
                onClick={() => handleStartCheckout("plan_enterprise", "HyperScale Enterprise", 49999)}
                className="mt-6 w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/30 cursor-pointer"
              >
                {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                <span>Activate Enterprise Plan</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>TRAI & DoT Enterprise Certified Trunking</span>
          </div>
          <span>NPCI UPI & Corporate Card Supported</span>
        </div>
      </div>
    </div>
  );
}
