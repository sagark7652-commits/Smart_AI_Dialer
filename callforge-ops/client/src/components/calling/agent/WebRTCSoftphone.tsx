import React, { useState, useEffect } from "react";
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  Mic,
  MicOff,
  Pause,
  Play,
  Volume2,
  ChevronDown,
  ChevronUp,
  Delete,
  Radio,
  Sparkles,
  ShieldCheck,
  User,
  MessageSquare,
  Activity,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenPopCard, ScreenPopLead } from "./ScreenPopCard";
import { DispositionPanel, DispositionData } from "./DispositionPanel";
import { callingBus, CallRequest } from "../../../lib/calling/callingBus";
import { audioEngine } from "../../../lib/calling/audioEngine";

const CALLER_IDS = [
  { id: "cid-1", number: "+91 140 22 8041", label: "DLT 140 Commercial Series" },
  { id: "cid-2", number: "+91 22 6902 4410", label: "Mumbai Enterprise Trunk" },
  { id: "cid-3", number: "+91 80 4721 9900", label: "Bengaluru Priority Desk" },
];

const AI_QUICK_RESPONSES = [
  {
    label: "👋 Namaste / Intro",
    text: "Namaste! CallForge AI Calling Platform mein aapka swagat hai. Main aapki kya sahayata kar sakti hoon?",
  },
  {
    label: "💰 Plan & Pricing",
    text: "Hamare plans ₹2,499 per month se shuru hote hain jisme unlimited cloud calling minutes aur Indian voice support milta hai.",
  },
  {
    label: "📅 Book Live Demo",
    text: "Bahut badhiya! Aapka live agent demo kal dopahar 2 baje ke liye schedule kar diya gaya hai. Hamare senior consultant aapse connect karenge.",
  },
  {
    label: "⏱️ Call Back Later",
    text: "Theek hai ji, main aapko shaam ko 5 baje punah call karungi. Aapka din shubh rahe!",
  },
];

export const WebRTCSoftphone: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dialInput, setDialInput] = useState("");
  const [selectedCallerId, setSelectedCallerId] = useState(CALLER_IDS[0].number);

  // Call states: "idle" | "dialing" | "ringing_in" | "connected" | "on_hold"
  const [callState, setCallState] = useState<
    "idle" | "dialing" | "ringing_in" | "connected" | "on_hold"
  >("idle");
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [activeLead, setActiveLead] = useState<ScreenPopLead>({
    name: "Anjali Sharma",
    phone: "+91 98765 14482",
    company: "Sharma Retail Mart Pvt Ltd",
    city: "Mumbai, Maharashtra",
    intentScore: 92,
    intentSummary: "Requested annual pricing for 12 storefronts during Meta Ads lead campaign.",
    source: "Inbound Callback Queue",
    lastCall: "Yesterday, 16:30",
    lastOutcome: "Call back today at 11am",
    assignedCampaign: "Festive season follow-up",
    dncStatus: "Verified Clean",
  });

  // Modal controls
  const [showScreenPop, setShowScreenPop] = useState(false);
  const [showDisposition, setShowDisposition] = useState(false);

  // Subscribe to global calling bus
  useEffect(() => {
    return callingBus.subscribe((req: CallRequest) => {
      setDialInput(req.phone);
      setActiveLead((prev) => ({
        ...prev,
        phone: req.phone,
        name: req.name || "Customer Lead",
        company: req.company || "Enterprise Lead",
      }));
      setIsExpanded(true);
      executeDial(req.phone, req.name, req.script);
    });
  }, []);

  // Call timer interval
  useEffect(() => {
    let interval: any;
    if (callState === "connected" || callState === "on_hold") {
      interval = setInterval(() => setCallTimer((t) => t + 1), 1000);
    } else if (callState === "idle") {
      setCallTimer(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleDialDigit = (digit: string) => {
    audioEngine.playDTMF(digit);
    setDialInput((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setDialInput((prev) => prev.slice(0, -1));
  };

  const executeDial = async (targetPhone: string, customerName?: string, customScript?: string) => {
    setCallState("dialing");
    setIsExpanded(true);
    toast.info(`Dialing ${targetPhone}...`, {
      description: "Audio bridge connecting (Ringback tone live).",
    });

    // 1. Play real telephone ringback tone
    audioEngine.startRingback();

    // 2. Dispatch call to server API
    try {
      fetch("/api/calling/click-to-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: targetPhone,
          name: customerName || "Direct Contact",
          callerId: selectedCallerId,
          script: customScript,
        }),
      }).catch((e) => console.warn("[Softphone] API call notice", e));
    } catch {
      // Non-blocking
    }

    // 3. Connect call after ringing cadence
    setTimeout(() => {
      audioEngine.stopRingback();
      audioEngine.playConnectChime();
      setCallState("connected");
      setActiveLead((prev) => ({
        ...prev,
        phone: targetPhone,
        name: customerName || prev.name,
      }));
      setShowScreenPop(true);

      toast.success(`Call Connected: ${targetPhone}`, {
        description: "Opus 48kHz HD Audio stream live. AI Voice Agent speaking.",
      });

      // 4. Start Microphone & AI Agent Voice Greeting
      audioEngine.startMicrophone().catch(() => {});
      setAgentSpeaking(true);
      const greeting =
        customScript ||
        `Namaste ${customerName || ""} ji! CallForge AI Voice Assistant mein aapka swagat hai. Main aapki kya sahayata kar sakti hoon?`;
      audioEngine.speakAgentMessage(greeting, () => {
        setAgentSpeaking(false);
      });
    }, 2400);
  };

  const handleOutboundCall = () => {
    const target = dialInput.trim() || "+91 98765 14482";
    executeDial(target, activeLead.name);
  };

  const handleSimulateIncoming = () => {
    setCallState("ringing_in");
    setIsExpanded(true);
    setShowScreenPop(true);
    audioEngine.startRingback();
    toast("Incoming Call Ring", {
      description: "Inbound call from Anjali Sharma (+91 98765 14482)",
      icon: "📞",
    });
  };

  const handleAnswer = () => {
    audioEngine.stopRingback();
    audioEngine.playConnectChime();
    setCallState("connected");
    audioEngine.startMicrophone().catch(() => {});
    setAgentSpeaking(true);
    audioEngine.speakAgentMessage(
      "Hello, Anjali Sharma ji! Thank you for connecting with CallForge. How may I assist you today?",
      () => setAgentSpeaking(false)
    );
    toast.success("Call connected. Audio stream live.");
  };

  const handleHangup = () => {
    audioEngine.stopRingback();
    audioEngine.playDisconnectTone();
    audioEngine.stopSpeaking();
    audioEngine.stopMicrophone();

    setCallState("idle");
    setShowScreenPop(false);
    setShowDisposition(true);
    setAgentSpeaking(false);
    toast.info("Call disconnected. Opening disposition wrap-up.");
  };

  const handleToggleHold = () => {
    if (callState === "connected") {
      setCallState("on_hold");
      audioEngine.stopSpeaking();
      toast.warning("Call put on hold. Hold music playing.");
    } else if (callState === "on_hold") {
      setCallState("connected");
      toast.info("Call resumed from hold.");
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    toast.info(isMuted ? "Microphone unmuted" : "Microphone muted");
  };

  const handleTriggerAIResponse = (text: string) => {
    setAgentSpeaking(true);
    audioEngine.speakAgentMessage(text, () => {
      setAgentSpeaking(false);
    });
  };

  return (
    <>
      {/* Docked Softphone Bar / Container */}
      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 max-w-[calc(100vw-24px)]">
        {!isExpanded ? (
          /* Minimized Pill Widget */
          <div className="flex items-center gap-2 p-1.5 sm:p-2 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-full shadow-2xl hover:border-violet-500/50 transition-all">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 text-xs font-semibold cursor-pointer transition-colors"
            >
              <Phone size={14} className="text-violet-400" />
              <span>WebRTC Softphone</span>
              {callState === "connected" && (
                <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  {formatTimer(callTimer)}
                </span>
              )}
              {callState === "dialing" && (
                <span className="text-amber-400 font-mono text-[11px] animate-pulse">
                  Dialing...
                </span>
              )}
            </button>

            {callState === "idle" && (
              <button
                type="button"
                onClick={handleSimulateIncoming}
                title="Simulate incoming ring to test CTI Screen Pop"
                className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors cursor-pointer"
              >
                + Test Ring
              </button>
            )}

            {callState === "connected" && (
              <button
                type="button"
                onClick={handleHangup}
                className="p-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-500 transition-colors cursor-pointer"
              >
                <PhoneOff size={13} />
              </button>
            )}
          </div>
        ) : (
          /* Expanded Softphone Window */
          <div className="w-[320px] sm:w-84 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200 flex flex-col">
            {/* Header */}
            <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    callState === "connected"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : callState === "dialing" || callState === "ringing_in"
                      ? "bg-amber-500/20 text-amber-400 animate-pulse"
                      : "bg-violet-500/20 text-violet-400"
                  }`}
                >
                  <Phone size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    <span>WebRTC Dialer</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </h4>
                  <span className="text-[10px] text-zinc-400 font-mono">Audio Bridge & PSTN Gateway</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {callState === "idle" && (
                  <button
                    type="button"
                    onClick={handleSimulateIncoming}
                    title="Simulate incoming call"
                    className="p-1 text-[10px] rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 px-1.5 cursor-pointer"
                  >
                    Sim Ring
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded cursor-pointer"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            {/* Caller ID selector */}
            <div className="px-3 py-1.5 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-[10px] uppercase font-bold text-zinc-500">Trunk ID:</span>
              <select
                value={selectedCallerId}
                onChange={(e) => setSelectedCallerId(e.target.value)}
                disabled={callState !== "idle"}
                className="text-[11px] font-mono bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none"
              >
                {CALLER_IDS.map((c) => (
                  <option key={c.id} value={c.number}>
                    {c.number} ({c.label.slice(0, 14)}...)
                  </option>
                ))}
              </select>
            </div>

            {/* Call State: Dialing / Ringing Out */}
            {callState === "dialing" && (
              <div className="p-4 bg-amber-950/20 border-b border-amber-900/40 text-center space-y-2 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                  <Phone size={18} className="animate-bounce" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-zinc-100">{activeLead.name}</h5>
                  <p className="text-[11px] font-mono text-amber-300">Ringing: {dialInput || activeLead.phone}...</p>
                  <p className="text-[10px] text-zinc-400 mt-1">Connecting WebRTC audio bridge</p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleHangup}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <PhoneOff size={12} /> Cancel Call
                  </button>
                </div>
              </div>
            )}

            {/* Call State: Ringing Inbound */}
            {callState === "ringing_in" && (
              <div className="p-4 bg-amber-950/20 border-b border-amber-900/40 text-center space-y-2 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                  <PhoneIncoming size={18} className="animate-bounce" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-zinc-100">{activeLead.name}</h5>
                  <p className="text-[11px] font-mono text-zinc-400">{activeLead.phone}</p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleAnswer}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Phone size={12} /> Answer
                  </button>
                  <button
                    type="button"
                    onClick={handleHangup}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <PhoneOff size={12} /> Decline
                  </button>
                </div>
              </div>
            )}

            {/* Call State: Connected or On Hold */}
            {(callState === "connected" || callState === "on_hold") && (
              <div className="p-4 bg-zinc-900/60 border-b border-zinc-800 text-center space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="text-left">
                    <span className="text-[12px] text-zinc-200 font-semibold block">{activeLead.name}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{activeLead.phone}</span>
                  </div>
                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                      callState === "on_hold"
                        ? "bg-amber-500/20 text-amber-400 animate-pulse"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {callState === "on_hold" ? "ON HOLD" : formatTimer(callTimer)}
                  </span>
                </div>

                {/* Animated Live Audio Waveform */}
                <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Volume2 size={11} /> {agentSpeaking ? "AI Agent Speaking..." : "Audio Stream (48kHz)"}
                    </span>
                    <span className="font-mono text-zinc-500">Latency: 18ms</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 h-7 py-1">
                    {[35, 70, 50, 85, 60, 95, 40, 80, 65, 55, 90, 75, 45, 85].map((h, idx) => (
                      <div
                        key={idx}
                        className={`w-1 rounded-full transition-all duration-150 ${
                          callState === "on_hold"
                            ? "bg-amber-500/40 h-1.5"
                            : agentSpeaking
                            ? "bg-violet-400 animate-pulse"
                            : "bg-emerald-400 animate-pulse"
                        }`}
                        style={{
                          height: callState === "on_hold" ? "5px" : `${h * 0.25}px`,
                          animationDelay: `${idx * 65}ms`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* AI Interactive Voice Prompt Buttons */}
                <div className="text-left space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Bot size={11} className="text-violet-400" /> Interactive AI Voice Responses:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {AI_QUICK_RESPONSES.map((res, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleTriggerAIResponse(res.text)}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-medium text-zinc-300 hover:text-white transition-colors text-left truncate cursor-pointer"
                        title={res.text}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* In-Call Actions Toolbar */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`p-2 rounded-lg border text-xs cursor-pointer ${
                      isMuted
                        ? "bg-rose-950/60 border-rose-800 text-rose-300"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                    }`}
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleHold}
                    className={`p-2 rounded-lg border text-xs cursor-pointer ${
                      callState === "on_hold"
                        ? "bg-amber-950/60 border-amber-800 text-amber-300"
                        : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                    }`}
                    title={callState === "on_hold" ? "Resume" : "Hold"}
                  >
                    {callState === "on_hold" ? <Play size={14} /> : <Pause size={14} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowScreenPop(true)}
                    className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-xs cursor-pointer"
                    title="View Lead Screen Pop"
                  >
                    <User size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={handleHangup}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20"
                  >
                    <PhoneOff size={14} /> End Call
                  </button>
                </div>
              </div>
            )}

            {/* Dialpad & Input Area (Idle State) */}
            {callState === "idle" && (
              <div className="p-3 space-y-2.5">
                {/* Number Input Bar */}
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5">
                  <input
                    type="text"
                    value={dialInput}
                    onChange={(e) => setDialInput(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full text-sm font-mono bg-transparent text-zinc-100 focus:outline-none placeholder-zinc-600 tracking-wide"
                  />
                  {dialInput && (
                    <button
                      type="button"
                      onClick={handleBackspace}
                      className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                    >
                      <Delete size={14} />
                    </button>
                  )}
                </div>

                {/* 12-key Grid with DTMF Sounds */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { d: "1", l: "" },
                    { d: "2", l: "ABC" },
                    { d: "3", l: "DEF" },
                    { d: "4", l: "GHI" },
                    { d: "5", l: "JKL" },
                    { d: "6", l: "MNO" },
                    { d: "7", l: "PQRS" },
                    { d: "8", l: "TUV" },
                    { d: "9", l: "WXYZ" },
                    { d: "*", l: "" },
                    { d: "0", l: "+" },
                    { d: "#", l: "" },
                  ].map((btn) => (
                    <button
                      key={btn.d}
                      type="button"
                      onClick={() => handleDialDigit(btn.d)}
                      className="py-2.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800/80 active:bg-violet-900/30 text-zinc-200 transition-colors flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-sm font-bold leading-none">{btn.d}</span>
                      {btn.l && (
                        <span className="text-[8px] font-semibold text-zinc-500 tracking-widest mt-0.5">
                          {btn.l}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Call Button */}
                <button
                  type="button"
                  onClick={handleOutboundCall}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 transition-colors"
                >
                  <Phone size={15} /> Call Customer Number
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screen Pop Card */}
      <ScreenPopCard
        isOpen={showScreenPop}
        onClose={() => setShowScreenPop(false)}
        lead={activeLead}
        onTransfer={() => {
          toast.success("Warm transfer placed to supervisor Arjun");
        }}
      />

      {/* Disposition Panel Modal */}
      <DispositionPanel
        isOpen={showDisposition}
        onClose={() => setShowDisposition(false)}
        leadInfo={{
          name: activeLead.name,
          phone: activeLead.phone,
          duration: formatTimer(callTimer),
        }}
        onSubmitDisposition={() => {
          // Dispatched
        }}
      />
    </>
  );
};
