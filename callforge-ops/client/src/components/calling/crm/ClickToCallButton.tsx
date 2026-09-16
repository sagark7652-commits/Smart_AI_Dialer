import React, { useState } from "react";
import { Phone, PhoneCall } from "lucide-react";
import { callingBus } from "../../../lib/calling/callingBus";

interface ClickToCallButtonProps {
  phoneNumber: string;
  leadName?: string;
  leadId?: string;
  className?: string;
}

export const ClickToCallButton: React.FC<ClickToCallButtonProps> = ({
  phoneNumber,
  leadName = "Lead Contact",
  leadId = "lead-01",
  className = "",
}) => {
  const [isCalling, setIsCalling] = useState(false);

  const handleClickToCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCalling(true);

    callingBus.triggerCall({
      phone: phoneNumber,
      name: leadName,
      source: "CRM Lead List",
    });

    toast.info(`Dialing ${leadName} (${phoneNumber})...`, {
      description: "Opening WebRTC Softphone audio bridge.",
    });

    setTimeout(() => {
      setIsCalling(false);
    }, 1500);
  };

  return (
    <button
      type="button"
      onClick={handleClickToCall}
      disabled={isCalling}
      title={`Click-to-call ${phoneNumber}`}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
        isCalling
          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
          : "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50"
      } ${className}`}
    >
      {isCalling ? <PhoneCall size={12} className="animate-bounce" /> : <Phone size={12} />}
      <span>{isCalling ? "Bridging..." : "Call"}</span>
    </button>
  );
};
