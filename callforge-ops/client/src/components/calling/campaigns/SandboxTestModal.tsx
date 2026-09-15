import React, { useState, useEffect } from "react";
import { X, Phone, PhoneOff, Bot, User, Mic, ShieldCheck, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MANDATORY_COMPLIANCE_PREAMBLE } from "./ClaudeScriptEditor";

interface SandboxTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptText?: string;
  agentName?: string;
}

interface ChatMessage {
  speaker: "agent" | "user";
  text: string;
  time: string;
}

export const SandboxTestModal: React.FC<SandboxTestModalProps> = ({
  isOpen,
  onClose,
  scriptText = "Offer festive season 20% discount on annual cloud calling packs.",
  agentName = "Asha (Hindi/English)",
}) => {
  const [phoneNumber, setPhoneNumber] = useState("+91 98765 43210");
  const [leadName, setLeadName] = useState("Rajesh Varma");
  const [callState, setCallState] = useState<"idle" | "ringing" | "connected" | "ended">("idle");
  const [timer, setTimer] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    let interval: any;
    if (callState === "connected") {
      interval = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  if (!isOpen) return null;

  const handleStartCall = () => {
    if (!phoneNumber) {
      toast.error("Please provide a valid test phone number");
      return;
    }

    setCallState("ringing");
    setMessages([]);
    toast.info(`Dialing ${phoneNumber}...`);

    // Simulated connection after 2 seconds
    setTimeout(() => {
      setCallState("connected");
      toast.success("Call connected to Voice Sandbox");

      // Agent delivers compliance preamble first
      setTimeout(() => {
        setMessages((m) => [
          ...m,
          {
            speaker: "agent",
            text: MANDATORY_COMPLIANCE_PREAMBLE,
            time: "00:02",
          },
        ]);

        // Simulated user response
        setTimeout(() => {
          setMessages((m) => [
            ...m,
            {
              speaker: "user",
              text: `Haan boliyen, main ${leadName} bol raha hoon. Kya offer hai?`,
              time: "00:08",
            },
          ]);

          // Agent pitch
          setTimeout(() => {
            setMessages((m) => [
              ...m,
              {
                speaker: "agent",
                text: `Dhanyawad ${leadName} ji. Hamare paas aapke retail outlets ke liye CallForge AI Calling agent pack par exclusive 20% festive discount uplabdh hai. Kya aap kal subah 11 baje ek live demo dekhna chahenge?`,
                time: "00:15",
              },
            ]);
          }, 2000);
        }, 2500);
      }, 1000);
    }, 2000);
  };

  const handleHangup = () => {
    setCallState("ended");
    toast.info("Sandbox test call ended");
    setTimeout(() => setCallState("idle"), 1500);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Sandbox Test Dial</h3>
              <p className="text-[11px] text-zinc-400">Test agent speech, preamble & prompt adherence</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Test Phone Number</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={callState !== "idle"}
                placeholder="+91 99887 76655"
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 font-mono disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Simulated Lead Name</label>
              <input
                type="text"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                disabled={callState !== "idle"}
                placeholder="Lead name"
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Active Voice Agent:</span>
            <span className="font-semibold text-violet-300">{agentName}</span>
          </div>

          {/* Call Screen Area */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/90 flex flex-col items-center justify-center min-h-[190px]">
            {callState === "idle" && (
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-violet-600/20 text-violet-400 mx-auto flex items-center justify-center">
                  <Phone size={20} />
                </div>
                <p className="text-xs text-zinc-400">
                  Ready to dial. Ensure your audio output is enabled.
                </p>
                <button
                  type="button"
                  onClick={handleStartCall}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg flex items-center gap-2 mx-auto transition-colors cursor-pointer shadow-md"
                >
                  <Phone size={14} /> Place Test Call
                </button>
              </div>
            )}

            {callState === "ringing" && (
              <div className="text-center space-y-2 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                  <Phone size={20} className="animate-bounce" />
                </div>
                <p className="text-xs font-semibold text-amber-300">Ringing {phoneNumber}...</p>
                <button
                  type="button"
                  onClick={handleHangup}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 mx-auto transition-colors cursor-pointer"
                >
                  <PhoneOff size={13} /> Cancel
                </button>
              </div>
            )}

            {(callState === "connected" || callState === "ended") && (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-semibold text-zinc-100">Live Audio Stream</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {formatTime(timer)}
                  </span>
                  <button
                    type="button"
                    onClick={handleHangup}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <PhoneOff size={12} /> End
                  </button>
                </div>

                {/* Conversation Stream Preview */}
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2 text-xs ${
                        m.speaker === "agent" ? "justify-start" : "justify-end"
                      }`}
                    >
                      {m.speaker === "agent" && (
                        <div className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot size={12} />
                        </div>
                      )}
                      <div
                        className={`p-2 rounded-lg max-w-[85%] text-[11px] leading-relaxed ${
                          m.speaker === "agent"
                            ? "bg-zinc-800/90 text-zinc-200 border border-zinc-700/60"
                            : "bg-violet-900/40 text-violet-100 border border-violet-700/50"
                        }`}
                      >
                        <p>{m.text}</p>
                        <span className="text-[9px] text-zinc-400 block text-right mt-1 font-mono">
                          {m.time}
                        </span>
                      </div>
                      {m.speaker === "user" && (
                        <div className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                          <User size={12} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-500" /> Carrier sandbox active
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
