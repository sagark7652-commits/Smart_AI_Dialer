import React, { useState } from "react";
import {
  X,
  BookOpen,
  Keyboard,
  LifeBuoy,
  ChevronRight,
  ExternalLink,
  Send,
  CheckCircle2,
  ShieldCheck,
  Radio,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpCenterModal({ isOpen, onClose }: HelpCenterModalProps) {
  const [activeTab, setActiveTab] = useState<"guides" | "shortcuts" | "support">("guides");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketCategory, setTicketCategory] = useState("Telephony Trunk");
  const [ticketDetails, setTicketDetails] = useState("");

  if (!isOpen) return null;

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim()) {
      toast.error("Please enter a ticket subject");
      return;
    }
    const ticketId = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
    toast.success(`Support Ticket #${ticketId} created! Telephony NOC has been alerted.`);
    setTicketSubject("");
    setTicketDetails("");
    setActiveTab("guides");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <LifeBuoy size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">CallForge Ops Documentation & Help Center</h2>
              <p className="text-xs text-zinc-400">Technical documentation, compliance rules & NOC support</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/20 px-5">
          <button
            onClick={() => setActiveTab("guides")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === "guides"
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <BookOpen size={14} /> Quick Start Guides
          </button>
          <button
            onClick={() => setActiveTab("shortcuts")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === "shortcuts"
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Keyboard size={14} /> Shortcuts & Keys
          </button>
          <button
            onClick={() => setActiveTab("support")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === "support"
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <LifeBuoy size={14} /> NOC Support Ticket
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === "guides" && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition">
                <div className="flex items-center gap-2 text-xs font-semibold text-violet-400 mb-1">
                  <Radio size={14} /> Dialing Modes & Cadence
                </div>
                <h4 className="text-sm font-semibold text-white">How Predictive & Progressive Pacing Works</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Predictive pacing uses statistical erlang models to pre-dial numbers before an agent finishes their current call. Progressive pacing dials 1:1 strictly when an agent is in the Ready state.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1">
                  <ShieldCheck size={14} /> Statutory Regulations
                </div>
                <h4 className="text-sm font-semibold text-white">TRAI 09:00 - 21:00 Calling Window</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Indian telecommunications regulations mandate outbound telemarketing only within 09:00 to 21:00 IST. The system automatically enforces this cutoff and logs all calls in the statutory compliance ledger.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
                  <FileText size={14} /> IVR Designer
                </div>
                <h4 className="text-sm font-semibold text-white">Deploying Visual Inbound Dialplans</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Create visual decision trees with greeting nodes, DTMF keypad capture (Press 1 for Sales), and automated queue routing. Export your configuration as JSON anytime.
                </p>
              </div>
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400 mb-2">
                Use these global keyboard hotkeys to navigate rapidly across CallForge Ops:
              </p>
              <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
                <div className="p-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-200">Open Command Omnibar / Quick Search</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-violet-300 font-mono text-[11px]">
                    Ctrl + K
                  </kbd>
                </div>
                <div className="p-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-200">Close active modal, drawer or dialog</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[11px]">
                    Esc
                  </kbd>
                </div>
                <div className="p-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-200">Toggle WebRTC Softphone widget</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[11px]">
                    Alt + P
                  </kbd>
                </div>
                <div className="p-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-200">Launch New Campaign Wizard</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[11px]">
                    Alt + C
                  </kbd>
                </div>
              </div>
            </div>
          )}

          {activeTab === "support" && (
            <form onSubmit={handleTicketSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Category
                </label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
                >
                  <option value="Telephony Trunk">Telephony Trunk / PRI Jitter</option>
                  <option value="Audio Quality">Audio Codec / Opus 48kHz Glitch</option>
                  <option value="Billing">Billing, Invoicing & Wallet Balance</option>
                  <option value="TRAI Compliance">TRAI DNC Scrubbing Assistance</option>
                  <option value="Other">Other Integration Query</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PRI Trunk 01 packet loss spike observed"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Incident Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide context, call IDs, or trunk IP addresses..."
                  value={ticketDetails}
                  onChange={(e) => setTicketDetails(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow-md shadow-violet-600/30"
                >
                  <Send size={13} /> Dispatch to Telephony NOC
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-500">
          <span>Mumbai DC Telephony NOC: 24/7 Available</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
