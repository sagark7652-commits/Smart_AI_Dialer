import React, { useState } from "react";
import {
  X,
  CreditCard,
  Zap,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  ArrowRight,
  Building,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
}

const QUICK_AMOUNTS = [2000, 5000, 10000, 25000, 50000];

export const TopUpModal: React.FC<TopUpModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [amount, setAmount] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("upi_instant");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [txnRef, setTxnRef] = useState("");

  if (!isOpen) return null;

  const currentAmount = customAmount ? Number(customAmount) || 0 : amount;
  const gstAmount = +(currentAmount * 0.18).toFixed(2);
  const totalPayable = +(currentAmount + gstAmount).toFixed(2);

  const handleSelectQuick = (amt: number) => {
    setAmount(amt);
    setCustomAmount("");
  };

  const handleCustomChange = (val: string) => {
    setCustomAmount(val);
    if (val) setAmount(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAmount < 500) {
      toast.error("Minimum recharge amount is ₹500");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch("/api/calling/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: currentAmount,
          paymentMethod:
            paymentMethod === "upi_instant"
              ? "Instant UPI (NPCI QR)"
              : paymentMethod === "card"
              ? "Corporate Credit Card"
              : "NetBanking HDFC/ICICI",
          notes: `Telephony prepaid top-up (Total credited: ₹${currentAmount.toLocaleString("en-IN")})`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsDone(true);
        setTxnRef(data.transaction?.referenceId || `TXN-${Date.now()}`);
        toast.success(`₹${currentAmount.toLocaleString("en-IN")} Added Successfully!`, {
          description: `Updated prepaid balance: ₹${data.balance?.toLocaleString("en-IN")}`,
        });
        if (onSuccess) onSuccess(data.balance);
      } else {
        toast.error(data.error || "Top-up failed");
      }
    } catch {
      toast.error("Failed to connect to billing gateway");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    setIsDone(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              ₹
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Top Up Telephony Wallet</h3>
              <p className="text-[11px] text-zinc-400">Add prepaid balance for AI voice agent calls</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {isDone ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 className="text-base font-bold text-zinc-100">Payment Verified & Credited</h4>
              <p className="text-xs text-zinc-400 mt-1">
                ₹{currentAmount.toLocaleString("en-IN")} has been deposited to your prepaid balance.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-left space-y-1 font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>Reference ID:</span>
                <span className="text-zinc-200 font-bold">{txnRef}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Gateway Status:</span>
                <span className="text-emerald-400 font-bold">Captured (Instant)</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>GST Tax Invoice:</span>
                <span className="text-violet-300 font-bold">Generated in Ledger</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs cursor-pointer transition shadow-lg shadow-emerald-600/30"
            >
              Done & Return to Console
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            {/* Quick Amount Chips */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
                Select Top-Up Amount (INR)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleSelectQuick(amt)}
                    className={`py-2 px-3 rounded-lg font-mono font-bold text-xs transition border cursor-pointer ${
                      amount === amt && !customAmount
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm"
                        : "bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    ₹{amt.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                Or Enter Custom Amount
              </label>
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                <span className="text-zinc-500 font-bold mr-1.5">₹</span>
                <input
                  type="number"
                  min="500"
                  step="500"
                  value={customAmount}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full bg-transparent text-zinc-100 font-mono text-sm focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Minimum recharge: ₹500 (No maximum limit)
              </span>
            </div>

            {/* Payment Method */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
                Payment Channel
              </label>
              <div className="space-y-1.5">
                <label
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                    paymentMethod === "upi_instant"
                      ? "bg-violet-950/40 border-violet-600/60 text-zinc-100"
                      : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <QrCode size={16} className="text-violet-400" />
                    <div>
                      <strong className="block text-xs font-semibold">Instant UPI / QR Code</strong>
                      <span className="text-[10px] text-zinc-400">
                        PhonePe, Google Pay, Paytm, BHIM (Zero gateway fees)
                      </span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="method"
                    value="upi_instant"
                    checked={paymentMethod === "upi_instant"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="accent-violet-500"
                  />
                </label>

                <label
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                    paymentMethod === "card"
                      ? "bg-violet-950/40 border-violet-600/60 text-zinc-100"
                      : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-violet-400" />
                    <div>
                      <strong className="block text-xs font-semibold">Corporate Card</strong>
                      <span className="text-[10px] text-zinc-400">Visa, Mastercard, RuPay</span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="method"
                    value="card"
                    checked={paymentMethod === "card"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="accent-violet-500"
                  />
                </label>

                <label
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                    paymentMethod === "netbanking"
                      ? "bg-violet-950/40 border-violet-600/60 text-zinc-100"
                      : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-violet-400" />
                    <div>
                      <strong className="block text-xs font-semibold">NetBanking</strong>
                      <span className="text-[10px] text-zinc-400">
                        HDFC, ICICI, SBI, Axis Corporate RTGS
                      </span>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="method"
                    value="netbanking"
                    checked={paymentMethod === "netbanking"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="accent-violet-500"
                  />
                </label>
              </div>
            </div>

            {/* GST Summary Box */}
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-zinc-400">
                <span>Wallet Credit:</span>
                <span>₹{currentAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>GST (18% Input Tax Credit):</span>
                <span>₹{gstAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="border-t border-zinc-800 pt-1 flex justify-between font-bold text-zinc-100 text-xs">
                <span>Total Payable:</span>
                <span className="text-emerald-400 font-mono">₹{totalPayable.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Trust badge & Submit */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-400" /> RBI Compliant Gateway
              </span>
              <button
                type="submit"
                disabled={isProcessing || currentAmount < 500}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-600/25"
              >
                {isProcessing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <span>Pay ₹{totalPayable.toLocaleString("en-IN")}</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
