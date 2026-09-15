import React, { useState } from "react";
import {
  X,
  Phone,
  Building,
  Calendar,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Send,
  CheckCircle2,
  Clock,
  Tag,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { ClickToCallButton } from "./ClickToCallButton";

export interface LeadRecord {
  name: string;
  phone: string;
  company: string;
  source: string;
  stage: string;
  score: number;
  last: string;
  email?: string;
  notes?: string[];
  isDnc?: boolean;
}

interface LeadDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadRecord | null;
  onUpdateLead?: (updatedLead: LeadRecord) => void;
}

export function LeadDetailsDrawer({
  isOpen,
  onClose,
  lead,
  onUpdateLead,
}: LeadDetailsDrawerProps) {
  if (!isOpen || !lead) return null;

  const [currentStage, setCurrentStage] = useState(lead.stage || "New");
  const [isDnc, setIsDnc] = useState(lead.isDnc || lead.stage === "DNC");
  const [newNote, setNewNote] = useState("");
  const [notes, setNotes] = useState<string[]>(
    lead.notes || [
      "Inbound inquiry captured via Google Ads campaign.",
      "Lead expressed high interest in AI Voice Studio automated reminders.",
    ]
  );

  const handleStageChange = (newSt: string) => {
    setCurrentStage(newSt);
    if (newSt === "DNC") {
      setIsDnc(true);
      toast.warning(`${lead.name} marked as DNC. Outbound calls blocked.`);
    } else {
      toast.success(`Lead stage updated to ${newSt}`);
    }
    if (onUpdateLead) {
      onUpdateLead({ ...lead, stage: newSt, isDnc: newSt === "DNC" });
    }
  };

  const handleToggleDnc = () => {
    const next = !isDnc;
    setIsDnc(next);
    const updatedStage = next ? "DNC" : currentStage === "DNC" ? "New" : currentStage;
    setCurrentStage(updatedStage);
    if (next) {
      toast.warning(`${lead.name}'s number added to National DNC suppression registry.`);
    } else {
      toast.info(`${lead.name} removed from DNC list.`);
    }
    if (onUpdateLead) {
      onUpdateLead({ ...lead, isDnc: next, stage: updatedStage });
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedNote = `[${timestamp}] ${newNote.trim()}`;
    const updatedNotes = [formattedNote, ...notes];
    setNotes(updatedNotes);
    setNewNote("");
    toast.success("CRM interaction note logged");
    if (onUpdateLead) {
      onUpdateLead({ ...lead, notes: updatedNotes });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Lead CRM Profile
              </h3>
              <p className="text-[11px] text-zinc-400">
                Contact ID: #{lead.phone.replace(/[^0-9]/g, "").slice(-6)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Identity Card */}
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-100">{lead.name}</h2>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                <Building size={13} /> {lead.company}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-300 mt-1">
                <Phone size={13} className="text-zinc-500" /> {lead.phone}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-zinc-400">AI Intent</div>
              <div className="text-xl font-bold text-violet-400">
                {lead.score}%
              </div>
            </div>
          </div>

          {/* Quick Click-to-Call Action */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
            <div className="text-xs text-zinc-300">
              Direct Telephony Bridge
            </div>
            <ClickToCallButton phoneNumber={lead.phone} leadName={lead.name} />
          </div>

          {/* Stage & Compliance Section */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
              Lead Stage & Pipeline
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["New", "In Progress", "Qualified", "DNC"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleStageChange(st)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition text-left flex items-center justify-between ${
                    currentStage === st
                      ? "bg-violet-600/20 border-violet-500/50 text-violet-200"
                      : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <span>{st}</span>
                  {currentStage === st && <CheckCircle2 size={13} className="text-violet-400" />}
                </button>
              ))}
            </div>

            {/* TRAI DNC Toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleToggleDnc}
                className={`w-full p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition ${
                  isDnc
                    ? "bg-rose-950/40 border-rose-800/60 text-rose-300"
                    : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isDnc ? (
                    <ShieldAlert size={15} className="text-rose-400" />
                  ) : (
                    <ShieldCheck size={15} className="text-emerald-400" />
                  )}
                  <span>
                    {isDnc
                      ? "DNC Restricted (TRAI NDNC Scrubbed)"
                      : "Compliant for Outbound Dialing"}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  {isDnc ? "Blocked" : "Clear"}
                </span>
              </button>
            </div>
          </div>

          {/* Details Metadata */}
          <div className="space-y-2 border-t border-zinc-800/80 pt-4">
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
              Contact Attributes
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-900/30 border border-zinc-800/60">
                <span className="text-zinc-500 block text-[10px] uppercase">Acquisition Source</span>
                <span className="font-medium text-zinc-200 mt-0.5 block">{lead.source}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/30 border border-zinc-800/60">
                <span className="text-zinc-500 block text-[10px] uppercase">Last Contact Touch</span>
                <span className="font-medium text-zinc-200 mt-0.5 block">{lead.last}</span>
              </div>
            </div>
          </div>

          {/* Interaction Notes Feed */}
          <div className="space-y-3 border-t border-zinc-800/80 pt-4">
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
              Activity & Agent Notes
            </span>

            {/* Add note input */}
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                placeholder="Log a call note or agent comment..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition flex items-center gap-1 shrink-0"
              >
                <Send size={12} /> Log
              </button>
            </form>

            {/* Notes list */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notes.map((nt, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60 text-xs text-zinc-300 flex items-start gap-2"
                >
                  <Clock size={13} className="text-zinc-500 mt-0.5 shrink-0" />
                  <p className="leading-relaxed">{nt}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
}
