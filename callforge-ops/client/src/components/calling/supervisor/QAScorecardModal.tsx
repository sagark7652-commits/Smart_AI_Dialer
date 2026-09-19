import React, { useState } from "react";
import {
  X,
  Star,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Edit3,
  Save,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

export interface QACriteria {
  id: string;
  name: string;
  aiScore: number; // 1 to 5
  manualScore: number; // 1 to 5
  comment: string;
  isMandatoryCompliance?: boolean;
  passedCompliance?: boolean;
}

interface QAScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  callData?: {
    callId: string;
    agentName: string;
    customerName: string;
    duration: string;
    overallScore: number;
  };
  onSaveEvaluation?: (evaluation: any) => void;
}

const DEFAULT_CRITERIA: QACriteria[] = [
  {
    id: "preamble",
    name: "Mandatory TRAI Recording & AI Disclosure",
    aiScore: 5,
    manualScore: 5,
    comment: "Preamble stated clearly word-for-word at 00:02 mark.",
    isMandatoryCompliance: true,
    passedCompliance: true,
  },
  {
    id: "tone",
    name: "Empathy, Polite Greeting & Professional Tone",
    aiScore: 4,
    manualScore: 4,
    comment: "Professional tone maintained even when customer hesitated on budget.",
  },
  {
    id: "objection",
    name: "Objection Handling & Value Pitch",
    aiScore: 4,
    manualScore: 4,
    comment: "Effectively highlighted 20% festive discount and zero onboarding fee.",
  },
  {
    id: "listening",
    name: "Active Listening & Talk-Over Prevention",
    aiScore: 5,
    manualScore: 5,
    comment: "Zero interruptions detected. Smooth conversational handoff.",
  },
  {
    id: "closing",
    name: "Clear Call-to-Action / Demo Booking",
    aiScore: 5,
    manualScore: 5,
    comment: "Successfully scheduled next-day demonstration with calendar confirmation.",
  },
];

export const QAScorecardModal: React.FC<QAScorecardModalProps> = ({
  isOpen,
  onClose,
  callData = {
    callId: "call-901",
    agentName: "Asha (AI Voice Agent)",
    customerName: "Anjali Sharma",
    duration: "04:32",
    overallScore: 92,
  },
  onSaveEvaluation,
}) => {
  const [criteria, setCriteria] = useState<QACriteria[]>(DEFAULT_CRITERIA);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [supervisorNotes, setSupervisorNotes] = useState(
    "Exemplary call flow. Perfect demonstration of compliant disclosure and consultative tone."
  );

  if (!isOpen) return null;

  const handleScoreChange = (id: string, newScore: number) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, manualScore: newScore } : c))
    );
  };

  const calculatedScore = Math.round(
    (criteria.reduce(
      (acc, curr) => acc + (isManualOverride ? curr.manualScore : curr.aiScore),
      0
    ) /
      (criteria.length * 5)) *
      100
  );

  const handleSave = async () => {
    const payload = {
      callId: callData.callId,
      overallScore: calculatedScore,
      isManualOverride,
      supervisorNotes,
      criteria,
      evaluatedAt: new Date().toISOString(),
    };

    try {
      await fetch(`/api/calling/cdrs/${callData.callId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Failed to persist QA evaluation:", err);
    }

    onSaveEvaluation?.(payload);
    toast.success("QA Scorecard Saved", {
      description: `Evaluation score of ${calculatedScore}% logged for Call ${callData.callId}.`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-violet-600/20 text-violet-300 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Call Quality & Compliance Scorecard
              </h3>
              <p className="text-[11px] text-zinc-400">
                Call {callData.callId} · {callData.agentName} ↔ {callData.customerName} (
                {callData.duration})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Top Score Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-violet-950/40 via-zinc-900 to-zinc-900 border border-violet-800/40 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  {isManualOverride ? "Manual QA Score" : "Claude AI Auto-QA"}
                </span>
                <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                  {calculatedScore}%
                </span>
              </div>
              <div className="h-10 w-px bg-zinc-800" />
              <div>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <ShieldCheck size={13} /> All Statutory TRAI Guidelines Passed
                </span>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Call adheres to calling hours, mandatory recording preamble & opt-out rules.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsManualOverride(!isManualOverride)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isManualOverride
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700"
              }`}
            >
              <Edit3 size={13} /> {isManualOverride ? "Override Mode Active" : "Override Scores"}
            </button>
          </div>

          {/* Criteria List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
              Scoring Rubric Breakdown
            </h4>

            {criteria.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.isMandatoryCompliance && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                        MANDATORY
                      </span>
                    )}
                    <span className="font-semibold text-zinc-200">{item.name}</span>
                  </div>

                  {/* Stars Rating */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const currentVal = isManualOverride ? item.manualScore : item.aiScore;
                      return (
                        <button
                          key={star}
                          type="button"
                          disabled={!isManualOverride}
                          onClick={() => handleScoreChange(item.id, star)}
                          className={`p-0.5 ${
                            isManualOverride ? "cursor-pointer hover:scale-110" : "cursor-default"
                          }`}
                        >
                          <Star
                            size={15}
                            className={
                              star <= currentVal
                                ? "text-amber-400 fill-amber-400"
                                : "text-zinc-600"
                            }
                          />
                        </button>
                      );
                    })}
                    <span className="font-mono text-zinc-400 text-xs ml-1.5 font-bold">
                      {(isManualOverride ? item.manualScore : item.aiScore) * 20}%
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 italic bg-zinc-950/60 p-2 rounded border border-zinc-800/70">
                  AI Note: {item.comment}
                </p>
              </div>
            ))}
          </div>

          {/* Supervisor Notes */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5 flex items-center gap-1.5">
              <MessageSquare size={13} className="text-violet-400" /> Supervisor Feedback & Coaching Notes
            </label>
            <textarea
              rows={2}
              value={supervisorNotes}
              onChange={(e) => setSupervisorNotes(e.target.value)}
              placeholder="Provide specific coaching notes for the agent..."
              className="w-full p-2.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-zinc-400">Audited under CallForge QA Policy v2.4</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
            >
              <Save size={13} /> Save QA Scorecard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
