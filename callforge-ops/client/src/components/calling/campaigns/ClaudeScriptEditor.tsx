import React, { useState } from "react";
import { ShieldCheck, Lock, Sparkles, AlertCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const MANDATORY_COMPLIANCE_PREAMBLE =
  "Namaste. This is an automated voice assistant calling from CallForge on a recorded line for quality and compliance. May I speak with you for 2 minutes regarding your recent enquiry?";

interface ClaudeScriptEditorProps {
  value: string;
  onChange: (val: string) => void;
  objective?: string;
  onObjectiveChange?: (val: string) => void;
}

const TEMPLATE_VARIABLES = [
  { tag: "{lead_name}", label: "Lead Name" },
  { tag: "{company}", label: "Company" },
  { tag: "{source}", label: "Lead Source" },
  { tag: "{product_interest}", label: "Product Interest" },
  { tag: "{callback_time}", label: "Callback Time" },
];

export const ClaudeScriptEditor: React.FC<ClaudeScriptEditorProps> = ({
  value,
  onChange,
  objective = "Qualify inbound retail interest and book a 15-minute product demonstration with our solutions team.",
  onObjectiveChange,
}) => {
  const [copied, setCopied] = useState(false);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.round(wordCount / 2.3); // Avg 140 WPM speech rate

  const insertTag = (tag: string) => {
    onChange(value + (value.endsWith(" ") ? "" : " ") + tag + " ");
    toast.info(`Inserted ${tag} variable`);
  };

  const copyFullPayload = () => {
    const full = `${MANDATORY_COMPLIANCE_PREAMBLE}\n\n[PROMPT OBJECTIVE]\n${objective}\n\n[CONVERSATION SCRIPT]\n${value}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied prompt with compliance preamble to clipboard");
  };

  return (
    <div className="space-y-4">
      {/* Objective Input */}
      {onObjectiveChange && (
        <div>
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
            Agent Goal / Objective
          </label>
          <input
            type="text"
            value={objective}
            onChange={(e) => onObjectiveChange(e.target.value)}
            placeholder="e.g. Confirm interest in festive discount and offer callback"
            className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>
      )}

      {/* Mandatory Preamble Box */}
      <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40 relative">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>TRAI Mandatory Compliance Preamble</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-900/40 border border-emerald-700/50 px-1.5 py-0.2 rounded font-mono">
              <Lock size={10} /> LOCKED
            </span>
          </div>
          <span className="text-[10px] text-zinc-400">Appended automatically on dial</span>
        </div>
        <p className="text-xs text-zinc-300 font-mono italic leading-relaxed bg-zinc-950/60 p-2.5 rounded border border-emerald-900/30">
          “{MANDATORY_COMPLIANCE_PREAMBLE}”
        </p>
        <p className="text-[10px] text-emerald-400/80 mt-1.5 flex items-center gap-1">
          <AlertCircle size={11} /> Required by Indian Telecom Commercial Communications Customer
          Preference Regulations (TCCCPR). Cannot be removed.
        </p>
      </div>

      {/* Script Body */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={13} className="text-violet-400" />
            <span>Agent Conversation Script / Instructions</span>
          </label>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span>{wordCount} words</span>
            <span>·</span>
            <span>~{estimatedSeconds}s talk time</span>
            <button
              type="button"
              onClick={copyFullPayload}
              className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 ml-2 cursor-pointer"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Variable Insertion Pills */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="text-[11px] text-zinc-500 self-center mr-1">Insert:</span>
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.tag}
              type="button"
              onClick={() => insertTag(v.tag)}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-violet-900/40 hover:text-violet-300 hover:border-violet-700/50 border border-zinc-700 transition-colors cursor-pointer"
            >
              + {v.tag}
            </button>
          ))}
        </div>

        <textarea
          rows={7}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="If lead says Yes: Thank them and explain our 3-tier enterprise plans. If lead mentions they are busy, offer to schedule a callback using {callback_time}. If lead is hesitant on pricing, emphasize the zero-setup fee offer..."
          className="w-full p-3 text-xs font-mono bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors resize-y leading-relaxed"
        />
      </div>
    </div>
  );
};
