import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  Calendar,
  ShieldBan,
  AlertCircle,
  FileText,
  UserCheck,
  Send,
} from "lucide-react";
import { toast } from "sonner";

export interface DispositionData {
  callId: string;
  leadName: string;
  leadPhone: string;
  outcome: string;
  callbackTime?: string;
  notes: string;
  autoDNC: boolean;
  duration: string;
}

interface DispositionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  leadInfo?: {
    callId?: string;
    name?: string;
    phone?: string;
    duration?: string;
  };
  onSubmitDisposition: (data: DispositionData) => void;
}

const OUTCOMES = [
  { id: "interested", label: "Interested / Demo Booked", tone: "emerald", dnc: false },
  { id: "callback", label: "Callback Requested", tone: "cyan", dnc: false },
  { id: "not_interested", label: "Not Interested", tone: "amber", dnc: false },
  { id: "price_objection", label: "Pricing Objection", tone: "amber", dnc: false },
  { id: "dnc", label: "DNC / Never Call Again", tone: "rose", dnc: true },
  { id: "wrong_number", label: "Wrong Number / Invalid", tone: "rose", dnc: false },
  { id: "no_answer", label: "No Answer / Ringing", tone: "zinc", dnc: false },
];

export const DispositionPanel: React.FC<DispositionPanelProps> = ({
  isOpen,
  onClose,
  leadInfo,
  onSubmitDisposition,
}) => {
  const [selectedOutcome, setSelectedOutcome] = useState("interested");
  const [callbackTime, setCallbackTime] = useState("Tomorrow at 11:30 AM");
  const [notes, setNotes] = useState("");
  const [autoDNC, setAutoDNC] = useState(false);
  const [wrapUpSeconds, setWrapUpSeconds] = useState(60);

  // Wrap-up countdown timer
  useEffect(() => {
    if (!isOpen) {
      setWrapUpSeconds(60);
      return;
    }
    const timer = setInterval(() => {
      setWrapUpSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (selectedOutcome === "dnc") {
      setAutoDNC(true);
    }
  }, [selectedOutcome]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: DispositionData = {
      callId: leadInfo?.callId || `call-${Date.now().toString().slice(-4)}`,
      leadName: leadInfo?.name || "Customer Lead",
      leadPhone: leadInfo?.phone || "+91 98765 00000",
      outcome: selectedOutcome,
      callbackTime: selectedOutcome === "callback" ? callbackTime : undefined,
      notes,
      autoDNC,
      duration: leadInfo?.duration || "02:45",
    };

    onSubmitDisposition(data);

    if (autoDNC) {
      toast.warning("DNC Suppression Added", {
        description: `${data.leadPhone} added to workspace suppression ledger.`,
      });
    } else {
      toast.success("Call Disposition Logged", {
        description: `Outcome: ${selectedOutcome} · Returned agent to Ready state.`,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header with Wrap-up Timer */}
        <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1.5">
              <Clock size={12} className="animate-spin" /> Wrap-Up Freeze ({wrapUpSeconds}s left)
            </span>
            <h3 className="text-sm font-semibold text-zinc-100 mt-0.5">
              Tag Call Outcome & Disposition
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-zinc-300 bg-zinc-800 px-2 py-1 rounded">
            {leadInfo?.duration || "02:45"}
          </span>
        </div>

        {/* Lead Context Pill */}
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center justify-between text-xs">
          <div>
            <strong className="text-zinc-200">{leadInfo?.name || "Anjali Sharma"}</strong>
            <span className="text-zinc-400 ml-2 font-mono">{leadInfo?.phone || "+91 98765 14482"}</span>
          </div>
          <span className="text-[11px] text-zinc-400">Call ID: {leadInfo?.callId || "#8412"}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">
              Select Call Outcome *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OUTCOMES.map((o) => {
                const isSelected = selectedOutcome === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOutcome(o.id)}
                    className={`p-2 rounded-lg border text-left text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-violet-500 bg-violet-950/40 text-violet-200 ring-1 ring-violet-500/50"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700"
                    }`}
                  >
                    <span>{o.label}</span>
                    {isSelected && <CheckCircle2 size={13} className="text-violet-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Callback Time Picker if Callback selected */}
          {selectedOutcome === "callback" && (
            <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 space-y-2 animate-in fade-in">
              <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                <Calendar size={13} /> Scheduled Callback Time
              </label>
              <input
                type="text"
                value={callbackTime}
                onChange={(e) => setCallbackTime(e.target.value)}
                placeholder="e.g. Tomorrow at 11:30 AM"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {/* DNC Alert if DNC selected */}
          {selectedOutcome === "dnc" && (
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 space-y-1.5 animate-in fade-in">
              <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                <ShieldBan size={14} /> TRAI Regulatory DNC Scrub
              </span>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                This contact will be permanently locked and scrubbed from all current & future
                outbound campaigns for 365 days.
              </p>
            </div>
          )}

          {/* Agent Notes */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
              <FileText size={13} /> Conversation Notes & Next Action
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Customer interested in multi-agent package. Requested pricing deck on WhatsApp."
              className="w-full p-2.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Send size={13} /> Submit Outcome & Set Status to Ready
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
