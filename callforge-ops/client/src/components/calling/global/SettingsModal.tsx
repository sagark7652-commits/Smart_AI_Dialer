import React, { useState } from "react";
import {
  X,
  Settings2,
  Sliders,
  Phone,
  Shield,
  Key,
  Bell,
  Check,
  Copy,
  Save,
  Radio,
  Volume2,
  Lock,
  Globe,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { CarrierConfigModal } from "./CarrierConfigModal";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "telephony" | "compliance" | "api">("general");
  const [showCarrierModal, setShowCarrierModal] = useState(false);

  // General state
  const [workspaceName, setWorkspaceName] = useState(() => {
    try {
      const saved = localStorage.getItem("creatorai_auth_user");
      if (saved) {
        const u = JSON.parse(saved);
        if (u.name) return `${u.name}'s Workspace`;
      }
    } catch {}
    return "Enterprise Workspace";
  });
  const [callerId, setCallerId] = useState("+91 22 6988 4000 (Mumbai PBX)");
  const [defaultLanguage, setDefaultLanguage] = useState("Hindi + Hinglish");

  // Telephony state
  const [provider, setProvider] = useState("Airtel PRI Trunk 01");
  const [codec, setCodec] = useState("Opus 48kHz HD Audio");
  const [maxRetries, setMaxRetries] = useState(3);
  const [pacingMode, setPacingMode] = useState("Predictive");

  // API State
  const [copiedKey, setCopiedKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("https://api.callforge.io/webhooks/cdr");
  const apiKey = "cf_live_98ab77d612e0944cb9128f4109";

  // Preferences
  const [audioChime, setAudioChime] = useState(true);
  const [autoWrapUp, setAutoWrapUp] = useState(true);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    toast.success("Production API Key copied to clipboard");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Settings saved successfully! Telephony parameters updated across clusters.");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Settings2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">CallForge Ops System Settings</h2>
              <p className="text-xs text-zinc-400">Manage workspace, carrier trunks, TRAI compliance, and API keys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/30 px-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("general")}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "general"
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sliders size={14} /> General
          </button>
          <button
            onClick={() => setActiveTab("telephony")}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "telephony"
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Phone size={14} /> Telephony & Trunks
          </button>
          <button
            onClick={() => setActiveTab("compliance")}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "compliance"
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Shield size={14} /> TRAI Compliance
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "api"
                ? "border-violet-500 text-violet-300"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Key size={14} /> API & Webhooks
          </button>
        </div>

        {/* Content Area */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {activeTab === "general" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-violet-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                    Default Outbound Caller ID
                  </label>
                  <select
                    value={callerId}
                    onChange={(e) => setCallerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-violet-500 text-xs"
                  >
                    <option value="+91 22 6988 4000 (Mumbai PBX)">+91 22 6988 4000 (Mumbai PBX)</option>
                    <option value="+91 11 4982 3000 (Delhi PRI)">+91 11 4982 3000 (Delhi PRI)</option>
                    <option value="+91 80 6112 5000 (Bangalore SIP)">+91 80 6112 5000 (Bangalore SIP)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                    Primary Voice Language
                  </label>
                  <select
                    value={defaultLanguage}
                    onChange={(e) => setDefaultLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-violet-500 text-xs"
                  >
                    <option value="Hindi + Hinglish">Hindi + Hinglish (Recommended)</option>
                    <option value="English (Indian Accent)">English (Indian Accent)</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Marathi">Marathi</option>
                  </select>
                </div>
              </div>

              {/* Preferences Toggles */}
              <div className="border-t border-zinc-800/80 pt-4 space-y-2.5">
                <span className="font-semibold text-zinc-300 uppercase tracking-wider block">
                  Agent Desktop Experience
                </span>
                <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                  <div className="flex items-center gap-2.5 text-zinc-200">
                    <Volume2 size={16} className="text-violet-400" />
                    <div>
                      <div className="font-medium">Audio Connect Chime</div>
                      <div className="text-[11px] text-zinc-500">Play pleasant earcon chime when call connects</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={audioChime}
                    onChange={(e) => setAudioChime(e.target.checked)}
                    className="accent-violet-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                  <div className="flex items-center gap-2.5 text-zinc-200">
                    <Bell size={16} className="text-cyan-400" />
                    <div>
                      <div className="font-medium">Auto-Pop Wrap-up Disposition</div>
                      <div className="text-[11px] text-zinc-500">Automatically open disposition timer on call termination</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoWrapUp}
                    onChange={(e) => setAutoWrapUp(e.target.checked)}
                    className="accent-violet-600 rounded"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === "telephony" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                    Carrier Trunk Route
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-violet-500 text-xs"
                  >
                    <option value="Airtel PRI Trunk 01">Airtel PRI Trunk 01 (Latency: 22ms)</option>
                    <option value="Tata Smartflo SIP 02">Tata Smartflo SIP 02 (Latency: 28ms)</option>
                    <option value="Jio Cloud Trunk">Jio Cloud Enterprise (Latency: 45ms)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                    Audio Codec
                  </label>
                  <select
                    value={codec}
                    onChange={(e) => setCodec(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-violet-500 text-xs"
                  >
                    <option value="Opus 48kHz HD Audio">Opus 48kHz HD Audio (Recommended)</option>
                    <option value="G.711u (PCMU)">G.711u (PCMU - Legacy PSTN)</option>
                    <option value="G.711a (PCMA)">G.711a (PCMA)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                    Dialer Pacing Engine
                  </label>
                  <select
                    value={pacingMode}
                    onChange={(e) => setPacingMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-violet-500 text-xs"
                  >
                    <option value="Predictive">Predictive (Erlang Model Auto-Pacing)</option>
                    <option value="Progressive">Progressive (1:1 Ratio When Agent Ready)</option>
                    <option value="Preview">Preview (Manual Agent Dial Approval)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                    Max Unanswered Retries
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-violet-500 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Gateway Status Box */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio size={16} className="text-emerald-400" />
                  <div>
                    <div className="font-semibold text-zinc-200">SBC Gateway Health: Optimal</div>
                    <div className="text-[11px] text-zinc-500">STUN/TURN: turn.mumbai.callforge.io:3478</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  CONNECTED
                </span>
              </div>

              {/* Live GSM Cellular Carrier Setup Button */}
              <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-900/40 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-violet-300 text-xs">Twilio & Exotel GSM Gateway Trunks</div>
                  <div className="text-[11px] text-zinc-400">Add credentials to place live cellular phone calls to mobile numbers</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCarrierModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-violet-600/30"
                >
                  Configure GSM Trunks
                </button>
              </div>
            </div>
          )}

          {activeTab === "compliance" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock size={15} className="text-rose-400" />
                    <span className="font-bold text-rose-200">TRAI TCCCPR 2018 Calling Window</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/50">
                    ENFORCED
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Outbound telemarketing calls are strictly restricted to 09:00 - 21:00 IST. The dialer worker halts automatically outside this window.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                  National DNC Scrubbing Configuration
                </label>
                <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300">DLT Principal Entity ID:</span>
                    <span className="font-mono text-zinc-200 font-bold">1401552890014</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300">Auto-Wash Frequency:</span>
                    <span className="font-mono text-emerald-400">Pre-dial Instant Check</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-300">DNC Registry Sync:</span>
                    <span className="font-mono text-zinc-400">TRAI NDNC API v2.1</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "api" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Production Telephony & WebRTC API Key
                </label>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <Key size={15} className="text-zinc-500 shrink-0" />
                  <span className="font-mono text-zinc-300 truncate flex-1">{apiKey}</span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
                  >
                    {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Real-time CDR Webhook Destination URL
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-800 text-zinc-400 text-[11px] leading-relaxed">
                Webhooks will fire on events: <code>call.initiated</code>, <code>call.answered</code>, <code>call.recorded</code>, and <code>disposition.logged</code> with JSON signature validation.
              </div>
            </div>
          )}

          {/* Footer Save Actions */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-violet-600/30"
            >
              <Save size={14} /> Save Configuration
            </button>
          </div>
        </form>
      </div>

      <CarrierConfigModal
        isOpen={showCarrierModal}
        onClose={() => setShowCarrierModal(false)}
      />
    </div>
  );
}
