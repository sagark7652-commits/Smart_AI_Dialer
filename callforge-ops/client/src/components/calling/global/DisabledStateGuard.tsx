import React, { useState } from "react";
import { ShieldAlert, Key, CheckCircle, ExternalLink, Settings, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface DisabledStateGuardProps {
  children?: React.ReactNode;
}

export const DisabledStateGuard: React.FC<DisabledStateGuardProps> = ({ children }) => {
  const [hasCredentials, setHasCredentials] = useState(true); // Demo mode is enabled by default
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Form State
  const [provider, setProvider] = useState("tata_smartflo");
  const [apiKey, setApiKey] = useState("sk_live_india_telecom_4891");
  const [dltEntityId, setDltEntityId] = useState("1401552890014");

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setHasCredentials(true);
    setShowConfigModal(false);
    toast.success("Telephony Carrier Credentials Configured", {
      description: `Connected to ${provider.toUpperCase()} with DLT Entity ID ${dltEntityId}.`,
    });
  };

  return (
    <>
      {/* Top Warning Banner if missing credentials */}
      {!hasCredentials && (
        <div className="p-3 mb-4 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <ShieldAlert size={16} className="shrink-0 text-amber-400" />
            <span>
              <strong>Telephony Carrier Not Connected:</strong> Real carrier dialing is paused.
              Configure your CPaaS credentials or continue in Sandbox Demo Mode.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHasCredentials(true)}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium cursor-pointer"
            >
              Use Demo Sandbox
            </button>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer"
            >
              Configure Provider
            </button>
          </div>
        </div>
      )}

      {children}

      {/* Provider Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-violet-400" />
                <h3 className="text-sm font-bold text-zinc-100">Configure Telephony Provider</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-3.5 text-xs">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  CPaaS / Carrier Platform
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100"
                >
                  <option value="tata_smartflo">Tata Teleservices Smartflo</option>
                  <option value="exotel">Exotel India Telephony</option>
                  <option value="ozonetel">Ozonetel CloudAgent</option>
                  <option value="twilio">Twilio Programmable Voice</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  API Key / Sid
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter provider API key"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  TRAI DLT Principal Entity ID (PE ID)
                </label>
                <input
                  type="text"
                  value={dltEntityId}
                  onChange={(e) => setDltEntityId(e.target.value)}
                  placeholder="e.g. 1401552890014"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 font-mono"
                />
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Mandatory 14-digit registration ID under TRAI Vilpower / DLT portal
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold cursor-pointer shadow-md shadow-violet-600/20"
                >
                  Save & Validate Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
