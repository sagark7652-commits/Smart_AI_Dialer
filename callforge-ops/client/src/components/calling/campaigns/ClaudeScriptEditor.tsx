import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  Plus,
  Trash2,
  Layers,
  HelpCircle,
  GripVertical,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const MANDATORY_COMPLIANCE_PREAMBLE =
  "Namaste. This is an automated voice assistant calling from CallForge on a recorded line for quality and compliance under TRAI guidelines. May I speak with you for 2 minutes regarding your enquiry?";

interface ScriptBlock {
  id: string;
  type: "objective" | "pitch" | "objection" | "wrapup";
  title: string;
  content: string;
}

interface ClaudeScriptEditorProps {
  value: string;
  onChange: (val: string) => void;
  objective?: string;
  onObjectiveChange?: (val: string) => void;
}

const TEMPLATE_VARIABLES = [
  { tag: "{lead_name}", label: "Lead Name" },
  { tag: "{company}", label: "Company" },
  { tag: "{product_interest}", label: "Product Interest" },
  { tag: "{callback_time}", label: "Callback Time" },
];

export const ClaudeScriptEditor: React.FC<ClaudeScriptEditorProps> = ({
  value,
  onChange,
  objective = "Qualify interest in CallForge AI calling suite and book a 15-minute product demonstration.",
  onObjectiveChange,
}) => {
  const [copied, setCopied] = useState(false);

  // Notion-style blocks state
  const [blocks, setBlocks] = useState<ScriptBlock[]>([
    {
      id: "blk-obj",
      type: "objective",
      title: "Agent Mission & Objective",
      content: objective,
    },
    {
      id: "blk-pitch",
      type: "pitch",
      title: "Opening Conversation & Value Proposition",
      content: value || "Hamare paas 40 concurrent AI agent lines par festive season me 20% discount offer chal raha hai with direct TRAI DLT registration support.",
    },
    {
      id: "blk-obj-handling",
      type: "objection",
      title: "Objection Handling: Busy or Hesitant",
      content: "Agar customer bole 'I am busy right now', toh reply karein: 'Koi baat nahi {lead_name}, main aapko shaam 5 baje callback schedule kar deta hu.'",
    },
    {
      id: "blk-wrapup",
      type: "wrapup",
      title: "Wrap-up & Confirmation Trigger",
      content: "Thank you for your time. Aapke registered number par confirmation SMS aur calendar invite send kar diya gaya hai.",
    },
  ]);

  const handleBlockChange = (id: string, newContent: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content: newContent } : b))
    );
    // sync back
    if (id === "blk-pitch") {
      onChange(newContent);
    }
    if (id === "blk-obj" && onObjectiveChange) {
      onObjectiveChange(newContent);
    }
  };

  const insertTagToActive = (tag: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.type === "pitch"
          ? { ...b, content: b.content + (b.content.endsWith(" ") ? "" : " ") + tag + " " }
          : b
      )
    );
    onChange(value + " " + tag);
    toast.info(`Inserted variable ${tag}`);
  };

  const copyFullPayload = () => {
    const full = `[MANDATORY COMPLIANCE PREAMBLE - LOCKED]\n${MANDATORY_COMPLIANCE_PREAMBLE}\n\n` +
      blocks.map((b) => `[${b.title.toUpperCase()}]\n${b.content}`).join("\n\n");
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Notion-style conversation prompt copied to clipboard!");
  };

  const addCustomBlock = () => {
    const newBlock: ScriptBlock = {
      id: `blk-${Date.now()}`,
      type: "objection",
      title: "Custom Scenario Block",
      content: "Describe AI response pattern for this condition...",
    };
    setBlocks([...blocks, newBlock]);
    toast.success("Added new scenario block to AI script");
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
    toast.info("Scenario block removed");
  };

  return (
    <div className="space-y-4">
      {/* Notion-style Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Sparkles size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-100">Notion-Style AI Dialogue Canvas</h4>
            <p className="text-[10px] text-zinc-400">Block-based prompt engineering with statutory compliance guardrails</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addCustomBlock}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition"
          >
            <Plus size={13} /> Add Block
          </button>
          <button
            type="button"
            onClick={copyFullPayload}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs text-white font-medium transition shadow-md shadow-violet-600/20"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} Copy Script Prompt
          </button>
        </div>
      </div>

      {/* Dynamic Tag Injectors */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-zinc-500 text-[11px] font-semibold uppercase mr-1">Insert Dynamic Variable:</span>
        {TEMPLATE_VARIABLES.map((v) => (
          <button
            key={v.tag}
            type="button"
            onClick={() => insertTagToActive(v.tag)}
            className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-violet-400 hover:bg-violet-950/40 hover:border-violet-700/50 font-mono text-[11px] transition"
          >
            {v.tag}
          </button>
        ))}
      </div>

      {/* BLOCK 1: MANDATORY COMPLIANCE PREAMBLE (COMPLIANCE LOCK 🔒) */}
      <div className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-4 space-y-2 relative shadow-lg shadow-rose-950/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-rose-900/50 text-rose-300 border border-rose-700/60 flex items-center gap-1 text-[11px] font-bold font-mono">
              <Lock size={12} className="text-rose-400" /> COMPLIANCE LOCK
            </span>
            <span className="text-xs font-bold text-rose-200">
              TRAI Mandatory Statutory Disclosure
            </span>
          </div>
          <span className="text-[10px] text-rose-400/80 font-mono uppercase">Non-Removable / Auto-Appended</span>
        </div>

        <div className="p-3 rounded-lg bg-zinc-950/80 border border-rose-900/40 text-xs font-mono text-zinc-300 leading-relaxed italic select-all">
          “{MANDATORY_COMPLIANCE_PREAMBLE}”
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-rose-300/80">
          <AlertCircle size={12} />
          <span>Statutory compliance rule: Indian Telecom (TCCCPR 2018) mandates disclosure of call recording on outbound line.</span>
        </div>
      </div>

      {/* NOTION BLOCKS: EDITABLE SCENARIO BLOCKS */}
      <div className="space-y-3">
        {blocks.map((b, index) => (
          <div
            key={b.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3.5 space-y-2 hover:border-zinc-700/80 transition group"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-zinc-600 group-hover:text-zinc-400 cursor-grab" />
                <span className="h-5 w-5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center justify-center font-bold">
                  {index + 1}
                </span>
                <span className="font-semibold text-zinc-200">{b.title}</span>
              </div>
              {blocks.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeBlock(b.id)}
                  className="text-zinc-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition"
                  title="Delete Block"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <textarea
              rows={3}
              value={b.content}
              onChange={(e) => handleBlockChange(b.id, e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 font-sans leading-relaxed"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
