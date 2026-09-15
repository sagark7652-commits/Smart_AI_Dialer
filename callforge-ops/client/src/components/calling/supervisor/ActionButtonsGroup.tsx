import React from "react";
import { Headphones, MessageSquare, Volume2, UserX } from "lucide-react";
import { toast } from "sonner";

interface ActionButtonsGroupProps {
  callId: string;
  agentName: string;
  customerName: string;
  className?: string;
  onActionTriggered?: (action: "listen" | "whisper" | "barge" | "takeover") => void;
}

export const ActionButtonsGroup: React.FC<ActionButtonsGroupProps> = ({
  callId,
  agentName,
  customerName,
  className = "",
  onActionTriggered,
}) => {
  const handleAction = (action: "listen" | "whisper" | "barge" | "takeover") => {
    onActionTriggered?.(action);

    switch (action) {
      case "listen":
        toast.info(`Silent Monitoring Started`, {
          description: `Listening to ${agentName} talking with ${customerName}. You are muted on both ends.`,
        });
        break;
      case "whisper":
        toast.success(`Supervisor Whisper Active`, {
          description: `Audio connected to ${agentName} only. The customer cannot hear you.`,
        });
        break;
      case "barge":
        toast.warning(`Barge-in: 3-Way Bridge Active`, {
          description: `Merged your audio into the active call. Both ${agentName} and ${customerName} can hear you.`,
        });
        break;
      case "takeover":
        toast.error(`Call Takeover Completed`, {
          description: `${agentName} has been released to Ready state. You are now speaking directly with ${customerName}.`,
        });
        break;
    }
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Silent Monitor / Listen */}
      <button
        type="button"
        onClick={() => handleAction("listen")}
        title="Silent Monitor: Listen in without either party knowing"
        className="p-1.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-zinc-700/60"
      >
        <Headphones size={13} />
      </button>

      {/* Whisper Coaching */}
      <button
        type="button"
        onClick={() => handleAction("whisper")}
        title="Whisper: Speak coaching guidance to agent only"
        className="p-1.5 rounded-md bg-violet-950/50 hover:bg-violet-900/60 text-violet-300 border border-violet-700/50 transition-colors cursor-pointer"
      >
        <MessageSquare size={13} />
      </button>

      {/* 3-Way Barge-In */}
      <button
        type="button"
        onClick={() => handleAction("barge")}
        title="Barge-In: Join audio bridge so both parties hear you"
        className="p-1.5 rounded-md bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-700/50 transition-colors cursor-pointer"
      >
        <Volume2 size={13} />
      </button>

      {/* Takeover */}
      <button
        type="button"
        onClick={() => handleAction("takeover")}
        title="Takeover: Disconnect agent and speak directly to customer"
        className="p-1.5 rounded-md bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50 transition-colors cursor-pointer"
      >
        <UserX size={13} />
      </button>
    </div>
  );
};
