import React, { useState, useEffect } from "react";
import {
  X,
  PhoneCall,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  Save,
  Radio,
  RefreshCw,
  Key,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

interface CarrierConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function CarrierConfigModal({ isOpen, onClose, onSaved }: CarrierConfigModalProps) {
  const [provider, setProvider] = useState<"mock" | "twilio" | "exotel">("mock");
  
  // Twilio Fields
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioCallerId, setTwilioCallerId] = useState("+18005550199");
  const [showTwilioToken, setShowTwilioToken] = useState(false);

  // Exotel Fields
  const [exotelApiKey, setExotelApiKey] = useState("");
  const [exotelApiToken, setExotelApiToken] = useState("");
  const [exotelSid, setExotelSid] = useState("");
  const [showExotelToken, setShowExotelToken] = useState(false);

  // Testing status
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    detail?: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Load existing config on open
  useEffect(() => {
    if (isOpen) {
      fetch("/api/calling/carrier-config")
        .then((res) => res.json())
        .then((data) => {
          if (data.provider) setProvider(data.provider);
          if (data.twilioAccountSid) setTwilioAccountSid(data.twilioAccountSid);
          if (data.twilioCallerId) setTwilioCallerId(data.twilioCallerId);
          if (data.exotelApiKey) setExotelApiKey(data.exotelApiKey);
          if (data.exotelSid) setExotelSid(data.exotelSid);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/calling/carrier-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          twilioAccountSid,
          twilioAuthToken,
          exotelApiKey,
          exotelApiToken,
          exotelSid,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: data.message || "Trunk connection verified successfully!",
          detail: data.accountName ? `Account: ${data.accountName} (${data.status})` : undefined,
        });
        toast.success("Carrier test successful!", { description: data.message });
      } else {
        setTestResult({
          success: false,
          message: data.message || data.error || "Connection failed.",
          detail: data.detail,
        });
        toast.error("Carrier test failed", { description: data.message || data.error });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: "Failed to connect to gateway test server.",
        detail: err.message,
      });
      toast.error("Error testing carrier trunk");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch("/api/calling/carrier-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          twilioAccountSid,
          ...(twilioAuthToken && { twilioAuthToken }),
          twilioCallerId,
          exotelApiKey,
          ...(exotelApiToken && { exotelApiToken }),
          exotelSid,
        }),
      });

      if (res.ok) {
        toast.success("Carrier credentials saved to persistent database!", {
          description: `Active trunk provider switched to: ${provider.toUpperCase()}`,
        });
        if (onSaved) onSaved();
        onClose();
      } else {
        toast.error("Failed to save carrier configuration.");
      }
    } catch (err) {
      toast.error("Network error while saving carrier configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 bg-gradient-to-r from-emerald-950/30 via-zinc-900/50 to-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <PhoneCall size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Telephony Carrier & GSM Trunk Setup</h2>
              <p className="text-xs text-zinc-400">Configure Twilio or Exotel to ring physical mobile phone SIMs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSaveConfig} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Provider Selector Cards */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
              Choose Telephony Provider
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setProvider("mock")}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  provider === "mock"
                    ? "bg-emerald-950/30 border-emerald-500 text-white shadow-md shadow-emerald-950/40"
                    : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs">CallForge Virtual</span>
                  {provider === "mock" && <CheckCircle2 size={14} className="text-emerald-400" />}
                </div>
                <span className="text-[10px] text-zinc-400">WebRTC HD Audio (Free Browser Voice)</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider("twilio")}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  provider === "twilio"
                    ? "bg-emerald-950/30 border-emerald-500 text-white shadow-md shadow-emerald-950/40"
                    : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs">Twilio Voice</span>
                  {provider === "twilio" && <CheckCircle2 size={14} className="text-emerald-400" />}
                </div>
                <span className="text-[10px] text-zinc-400">GSM Cellular Ringing (Global Trunks)</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider("exotel")}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  provider === "exotel"
                    ? "bg-emerald-950/30 border-emerald-500 text-white shadow-md shadow-emerald-950/40"
                    : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs">Exotel India</span>
                  {provider === "exotel" && <CheckCircle2 size={14} className="text-emerald-400" />}
                </div>
                <span className="text-[10px] text-zinc-400">India PRI Trunks (TRAI Approved)</span>
              </button>
            </div>
          </div>

          {/* Twilio Configuration Fields */}
          {provider === "twilio" && (
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Lock size={13} className="text-emerald-400" /> Twilio API Credentials
                </span>
                <a
                  href="https://console.twilio.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                >
                  Get from Twilio Console &rarr;
                </a>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Twilio Account SID
                </label>
                <input
                  type="text"
                  value={twilioAccountSid}
                  onChange={(e) => setTwilioAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Twilio Auth Token
                </label>
                <div className="relative">
                  <input
                    type={showTwilioToken ? "text" : "password"}
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                    placeholder="Enter or paste token to update"
                    className="w-full px-3 py-2 pr-9 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTwilioToken(!showTwilioToken)}
                    className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    {showTwilioToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Caller ID (Verified Twilio Phone Number)
                </label>
                <input
                  type="text"
                  value={twilioCallerId}
                  onChange={(e) => setTwilioCallerId(e.target.value)}
                  placeholder="+18005550199 or +91140228041"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Must be in E.164 format and registered in your Twilio Active Numbers.
                </span>
              </div>
            </div>
          )}

          {/* Exotel Configuration Fields */}
          {provider === "exotel" && (
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Lock size={13} className="text-emerald-400" /> Exotel India Gateway Credentials
                </span>
                <a
                  href="https://my.exotel.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                >
                  Get from Exotel Dashboard &rarr;
                </a>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Exotel Sub-Account SID
                </label>
                <input
                  type="text"
                  value={exotelSid}
                  onChange={(e) => setExotelSid(e.target.value)}
                  placeholder="e.g. your_company_sid"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Exotel API Key
                  </label>
                  <input
                    type="text"
                    value={exotelApiKey}
                    onChange={(e) => setExotelApiKey(e.target.value)}
                    placeholder="Key"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Exotel API Token
                  </label>
                  <div className="relative">
                    <input
                      type={showExotelToken ? "text" : "password"}
                      value={exotelApiToken}
                      onChange={(e) => setExotelApiToken(e.target.value)}
                      placeholder="Token"
                      className="w-full px-3 py-2 pr-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowExotelToken(!showExotelToken)}
                      className="absolute right-2 top-2.5 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    >
                      {showExotelToken ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CallForge Virtual Provider Note */}
          {provider === "mock" && (
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Radio size={15} />
                <span>CallForge Virtual WebRTC Asterisk Bridge (Ready)</span>
              </div>
              <p className="text-zinc-400 leading-relaxed text-[11px]">
                Virtual WebRTC mode plays full two-way audio directly through your phone or computer speakers and microphone. No external carrier billing or third-party telephony tokens are required.
              </p>
            </div>
          )}

          {/* Test Connection Status Box */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                testResult.success
                  ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                  : "bg-rose-950/30 border-rose-500/50 text-rose-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-semibold text-xs">{testResult.message}</p>
                {testResult.detail && (
                  <p className="text-[11px] opacity-80 font-mono">{testResult.detail}</p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              {isTesting ? (
                <RefreshCw size={13} className="animate-spin text-emerald-400" />
              ) : (
                <Zap size={13} className="text-emerald-400" />
              )}
              <span>{isTesting ? "Pinging Gateway..." : "Test Connection"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <Save size={13} />
                <span>{isSaving ? "Saving..." : "Save Carrier Trunk"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
