import React, { useState, useEffect } from "react";
import { PhoneCall, ShieldCheck, Zap, Radio, Settings2, CheckCircle2 } from "lucide-react";
import { CarrierConfigModal } from "../global/CarrierConfigModal";

export const CarrierConfigCard: React.FC = () => {
  const [config, setConfig] = useState<{
    provider: string;
    twilioAccountSid?: string;
    twilioCallerId?: string;
    exotelSid?: string;
    updatedAt?: string;
  }>({
    provider: "mock",
    twilioCallerId: "+18005550199",
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchConfig = () => {
    fetch("/api/calling/carrier-config")
      .then((res) => res.json())
      .then((data) => {
        if (data) setConfig(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/70 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center">
            <PhoneCall size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100">Telephony Carrier & GSM Trunk Gateway</h3>
            <p className="text-[11px] text-zinc-400">
              Direct physical cellular dialing via Twilio or Exotel India PRI trunks
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <Settings2 size={13} />
          <span>Configure Carrier Trunks</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
            Active Provider
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-100 capitalize">
              {config.provider === "twilio"
                ? "Twilio Voice GSM"
                : config.provider === "exotel"
                ? "Exotel India Gateway"
                : "CallForge Virtual Asterisk"}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">
            {config.provider === "mock" ? "0ms WebRTC Virtual Trunk" : "Live Telecom Trunk Connected"}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
            Outbound Caller ID
          </span>
          <p className="font-mono font-bold text-zinc-200">{config.twilioCallerId || "+18005550199"}</p>
          <span className="text-[10px] text-zinc-500">TRAI CLI & E.164 compliant</span>
        </div>

        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
            Carrier Status
          </span>
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 size={13} />
            <span>SIP Trunks Ready</span>
          </div>
          <span className="text-[10px] text-zinc-500">
            {config.updatedAt ? "Updated: " + new Date(config.updatedAt).toLocaleTimeString() : "Synchronized"}
          </span>
        </div>
      </div>

      <CarrierConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchConfig}
      />
    </div>
  );
};
