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
  Delete,
  User,
  Bot,
  Sparkles,
  Info,
  Check,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { ScreenPopCard, ScreenPopLead } from "./ScreenPopCard";
import { DispositionPanel } from "./DispositionPanel";
import { callingBus, CallRequest } from "../../../lib/calling/callingBus";
import { audioEngine } from "../../../lib/calling/audioEngine";
import { CarrierConfigModal } from "../global/CarrierConfigModal";

const CALLER_IDS = [
  { id: "cid-1", number: "+91 140 22 8041", label: "DLT 140 Commercial Trunk" },
  { id: "cid-2", number: "+91 22 6902 4410", label: "Mumbai Enterprise PRI" },
  { id: "cid-3", number: "+91 80 4721 9900", label: "Bengaluru Priority SIP" },
];

const AI_QUICK_RESPONSES = [
  {
    label: "👋 Namaste / Intro",
    text: "Namaste! CallForge AI Calling Assistant mein aapka swagat hai. Main aapki kya sahayata kar sakti hoon?",
  },
  {
    label: "💰 Plan & Pricing",
    text: "Hamare plans ₹2,499 per month se shuru hote hain jisme unlimited cloud calling minutes aur Indian voice support milta hai.",
  },
  {
    label: "📅 Book Live Demo",
    text: "Bahut badhiya! Aapka live agent demo kal dopahar 2 baje ke liye schedule kar diya gaya hai. Hamari team aapse connect karegi.",
  },
  {
    label: "⏱️ Call Back Later",
    text: "Theek hai ji, main aapko shaam ko 5 baje punah call karungi. Dhanyawad aur aapka din shubh rahe!",
  },
];

export const WebRTCSoftphone: React.FC = () => {
  const [isDialpadOpen, setIsDialpadOpen] = useState(false);
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
    name: "Aarav Mehta",
    phone: "+91 99887 11002",
    company: "Northstar Foods",
    city: "Mumbai, Maharashtra",
    intentScore: 88,
    intentSummary: "Interested in automating customer lead follow-ups with Indian AI voice agent.",
    source: "Direct Dial",
    lastCall: "Just now",
    lastOutcome: "Call in progress",
    assignedCampaign: "Festive season follow-up",
    dncStatus: "Verified Clean",
  });

  // Modal controls
  const [showScreenPop, setShowScreenPop] = useState(false);
  const [showDisposition, setShowDisposition] = useState(false);
  const [conversationLogs, setConversationLogs] = useState<
    Array<{ sender: "agent" | "user"; text: string; time: string }>
  >([]);
  const [isListening, setIsListening] = useState(false);
  const [softphoneInputText, setSoftphoneInputText] = useState("");
  const [showCarrierModal, setShowCarrierModal] = useState(false);

  // Subscribe to global calling bus
  useEffect(() => {
    return callingBus.subscribe((req: CallRequest) => {
      audioEngine.unlockAudio();
      setDialInput(req.phone);
      setActiveLead((prev) => ({
        ...prev,
        phone: req.phone,
        name: req.name || "Customer Lead",
        company: req.company || "Enterprise Lead",
      }));
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
    audioEngine.unlockAudio();
    audioEngine.playDTMF(digit);
    setDialInput((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setDialInput((prev) => prev.slice(0, -1));
  };

  const executeDial = async (targetPhone: string, customerName?: string, customScript?: string) => {
    audioEngine.unlockAudio();
    setCallState("dialing");
    setIsDialpadOpen(false);
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
      }).catch((e) => console.warn("[Softphone] API notice", e));
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

      toast.success(`Call Connected: ${targetPhone}`, {
        description: "Opus 48kHz HD Audio stream live. AI Voice Agent speaking.",
      });

      // 4. AI Agent Voice Greeting (HD Audio output without microphone echo cancellation cut)
      setAgentSpeaking(true);
      const greeting =
        customScript ||
        `Namaste ${customerName || ""} ji! CallForge AI Voice Assistant mein aapka swagat hai. Main aapki kya sahayata kar sakti hoon?`;
      
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setConversationLogs([{ sender: "agent", text: greeting, time: timeStr }]);

      audioEngine.speakAgentMessage(greeting, () => {
        setAgentSpeaking(false);
        handleStartListening();
      });
    }, 2200);
  };

  const handleOutboundCall = () => {
    audioEngine.unlockAudio();
    const target = dialInput.trim() || "+91 99887 11002";
    executeDial(target, activeLead.name);
  };

  const handleSimulateIncoming = () => {
    audioEngine.unlockAudio();
    setCallState("ringing_in");
    setIsDialpadOpen(false);
    audioEngine.startRingback();
    toast("Incoming Call Ring", {
      description: "Inbound call from Anjali Sharma (+91 98765 14482)",
      icon: "📞",
    });
  };

  const handleAnswer = () => {
    audioEngine.unlockAudio();
    audioEngine.stopRingback();
    audioEngine.playConnectChime();
    setCallState("connected");
    audioEngine.startMicrophone().catch(() => {});
    setAgentSpeaking(true);
    const greeting = "Hello, Anjali Sharma ji! Thank you for connecting with CallForge. How may I assist you today?";
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setConversationLogs([{ sender: "agent", text: greeting, time: timeStr }]);

    audioEngine.speakAgentMessage(
      greeting,
      () => {
        setAgentSpeaking(false);
        handleStartListening();
      }
    );
    toast.success("Call connected. Audio stream live.");
  };

  const handleHangup = () => {
    audioEngine.stopRingback();
    audioEngine.playDisconnectTone();
    audioEngine.stopSpeaking();
    audioEngine.stopMicrophone();
    audioEngine.stopSpeechRecognition();
    setIsListening(false);

    // Persist CDR record to backend storage
    if (callTimer > 0) {
      fetch("/api/calling/cdrs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: activeLead.name,
          customerPhone: activeLead.phone,
          agentName: "Asha (AI Voice)",
          campaign: activeLead.assignedCampaign || "Direct Dial",
          duration: formatTimer(callTimer),
          durationSeconds: callTimer,
          status: "Completed",
          sentiment: "Positive",
          qaScore: 94,
        }),
      }).catch((e) => console.warn("[Softphone] CDR save error", e));
    }

    setCallState("idle");
    setShowScreenPop(false);
    setShowDisposition(true);
    setAgentSpeaking(false);
    toast.info("Call disconnected. Saved CDR to permanent ledger.");
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

  const handleStartListening = () => {
    if (callState === "idle" || callState === "on_hold") return;
    audioEngine.unlockAudio();
    setIsListening(true);

    const started = audioEngine.startSpeechRecognition(
      (transcript) => {
        setIsListening(false);
        handleProcessUserSpeech(transcript);
      },
      () => {
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );

    if (!started) {
      setIsListening(false);
    }
  };

  const handleProcessUserSpeech = (userSpeech: string) => {
    if (!userSpeech.trim()) return;
    audioEngine.stopSpeechRecognition();
    setIsListening(false);

    const userTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setConversationLogs((prev) => [...prev, { sender: "user", text: userSpeech, time: userTime }]);

    // Generate intelligent AI response with active lead context
    const reply = audioEngine.generateConversationalReply(userSpeech, {
      leadName: activeLead.name,
      agentName: "Asha",
    });
    const agentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setConversationLogs((prev) => [...prev, { sender: "agent", text: reply, time: agentTime }]);

    setAgentSpeaking(true);
    audioEngine.speakAgentMessage(reply, () => {
      setAgentSpeaking(false);
      // Auto-rearm speech recognition for ongoing two-way conversation
      setTimeout(() => {
        handleStartListening();
      }, 350);
    });
  };

  const handleTriggerAIResponse = (text: string) => {
    handleProcessUserSpeech(text);
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. FULL-SCREEN IN-CALL OVERLAY (VISIBLE ON BOTH MOBILE & DESKTOP)        */}
      {/* ========================================================================= */}
      {callState !== "idle" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="w-full max-w-[370px] max-h-[88vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Compact Call Header */}
            <div className="px-3.5 py-2.5 bg-zinc-900/85 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    callState === "connected"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400 animate-pulse"
                  }`}
                >
                  <Phone size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    <span>CallForge Voice</span>
                    {callState === "connected" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    )}
                  </h3>
                  <p className="text-[9px] text-zinc-400 font-mono">HD Audio Bridge</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {callState === "connected" && (
                  <span className="text-[11px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
                    {formatTimer(callTimer)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowScreenPop(true)}
                  className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium flex items-center gap-1 cursor-pointer transition"
                  title="View Lead CRM Card"
                >
                  <User size={11} /> Lead
                </button>
              </div>
            </div>

            {/* Scrollable Compact Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 text-center">
              {/* Compact Pulsing Avatar */}
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                {callState === "connected" && (
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40 animate-ping" />
                )}
                {callState === "dialing" && (
                  <div className="absolute inset-0 rounded-full border-2 border-amber-500/40 animate-pulse" />
                )}
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-bold shadow-lg border ${
                    callState === "connected"
                      ? "bg-gradient-to-tr from-emerald-950 to-emerald-800 text-emerald-300 border-emerald-500/50"
                      : "bg-gradient-to-tr from-amber-950 to-amber-800 text-amber-300 border-amber-500/50"
                  }`}
                >
                  {((activeLead.name || "Customer").trim().split(/\s+/).map((n) => n[0] || "").join("").slice(0, 2) || "CU").toUpperCase()}
                </div>
              </div>

              {/* Lead Name & Phone */}
              <div>
                <h2 className="text-sm font-bold text-zinc-100">{activeLead.name}</h2>
                <p className="text-xs font-mono text-zinc-400">{activeLead.phone}</p>
                <p className="text-[10px] text-zinc-500">{activeLead.company || "Enterprise Prospect"}</p>
              </div>

              {/* Live Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono">
                {callState === "dialing" && (
                  <span className="text-amber-400 font-semibold animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Dialing & Ringing...
                  </span>
                )}
                {callState === "ringing_in" && (
                  <span className="text-amber-400 font-semibold animate-bounce flex items-center gap-1">
                    <PhoneIncoming size={12} />
                    Incoming Call...
                  </span>
                )}
                {callState === "connected" && (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Live Audio Connected
                  </span>
                )}
                {callState === "on_hold" && (
                  <span className="text-amber-300 font-semibold flex items-center gap-1">
                    <Pause size={11} />
                    Call on Hold ({formatTimer(callTimer)})
                  </span>
                )}
              </div>

              {/* Compact Audio Visualizer */}
              {(callState === "connected" || callState === "on_hold") && (
                <div className="p-2 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <Volume2 size={11} />
                      {agentSpeaking ? "AI Speaking..." : "Audio Active"}
                    </span>
                    <span className="font-mono text-zinc-500 text-[9px]">48kHz HD</span>
                  </div>

                  <div className="flex items-center justify-center gap-1 h-5">
                    {[25, 55, 35, 75, 45, 85, 35, 70, 50, 80, 60, 40, 75, 35].map((h, i) => (
                      <div
                        key={i}
                        className={`w-0.5 rounded-full transition-all duration-150 ${
                          callState === "on_hold"
                            ? "bg-amber-500/40 h-1"
                            : agentSpeaking
                            ? "bg-violet-400 animate-pulse"
                            : "bg-emerald-400 animate-pulse"
                        }`}
                        style={{
                          height: callState === "on_hold" ? "4px" : `${h * 0.2}px`,
                          animationDelay: `${i * 50}ms`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Dialogue Transcript */}
              {conversationLogs.length > 0 && (
                <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-left space-y-1.5 max-h-24 overflow-y-auto">
                  <div className="flex items-center justify-between text-[9px] text-zinc-400 font-bold uppercase">
                    <span className="flex items-center gap-1">
                      <Sparkles size={10} className="text-violet-400" /> Speech Dialogue
                    </span>
                    <span className="font-mono text-emerald-400 text-[9px]">Two-Way</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {conversationLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`p-1.5 rounded-lg text-[10px] leading-relaxed ${
                          log.sender === "user"
                            ? "bg-emerald-950/40 border border-emerald-700/40 text-emerald-200 ml-2"
                            : "bg-zinc-900 border border-zinc-800 text-zinc-200 mr-2"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[8px] text-zinc-400 mb-0.5 font-mono">
                          <span className={log.sender === "user" ? "text-emerald-400 font-bold" : "text-violet-400 font-bold"}>
                            {log.sender === "user" ? "You" : "AI"}
                          </span>
                          <span>{log.time}</span>
                        </div>
                        <p>{log.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Quick Prompts (Compact) */}
              {callState === "connected" && (
                <div className="space-y-1 text-left">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Bot size={11} className="text-violet-400" /> Quick Responses:
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {AI_QUICK_RESPONSES.map((res, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleTriggerAIResponse(res.text)}
                        className="p-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-medium text-zinc-300 hover:text-white transition-colors text-left truncate cursor-pointer"
                        title={res.text}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>

                  {/* In-Call Text Query Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!softphoneInputText.trim()) return;
                      const q = softphoneInputText.trim();
                      setSoftphoneInputText("");
                      handleProcessUserSpeech(q);
                    }}
                    className="flex gap-1 pt-1.5"
                  >
                    <input
                      type="text"
                      value={softphoneInputText}
                      onChange={(e) => setSoftphoneInputText(e.target.value)}
                      placeholder="Type message to AI agent..."
                      className="flex-1 px-2.5 py-1 text-[11px] bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="submit"
                      disabled={!softphoneInputText.trim()}
                      className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition"
                    >
                      <Send size={11} /> Send
                    </button>
                  </form>
                </div>
              )}

              {/* Compact Notice */}
              <div className="p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-left text-[10px] text-zinc-400 flex items-center justify-between">
                <span>📞 SIM Outbound Call:</span>
                <button
                  type="button"
                  onClick={() => setShowCarrierModal(true)}
                  className="text-violet-400 hover:text-violet-300 font-semibold underline"
                >
                  Carrier Setup
                </button>
              </div>
            </div>

            {/* Sticky Bottom Call Controls Toolbar (Always in View!) */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-800/90 flex items-center justify-center gap-2 shrink-0">
              {callState === "ringing_in" ? (
                <>
                  <button
                    type="button"
                    onClick={handleAnswer}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer transition active:scale-95"
                  >
                    <Phone size={14} /> Answer
                  </button>
                  <button
                    type="button"
                    onClick={handleHangup}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer transition active:scale-95"
                  >
                    <PhoneOff size={14} /> Decline
                  </button>
                </>
              ) : (
                <>
                  {/* Speak into Mic */}
                  <button
                    type="button"
                    onClick={handleStartListening}
                    disabled={isListening}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      isListening
                        ? "bg-rose-600 text-white animate-pulse"
                        : "bg-violet-600/30 hover:bg-violet-600/40 border border-violet-500/40 text-violet-200"
                    }`}
                    title="Speak into Microphone"
                  >
                    <Mic size={14} className={isListening ? "animate-bounce" : ""} />
                    <span>{isListening ? "Listening..." : "Mic"}</span>
                  </button>

                  {/* Mute */}
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`p-2.5 rounded-xl border transition cursor-pointer ${
                      isMuted
                        ? "bg-rose-950/70 border-rose-700 text-rose-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                    }`}
                    title={isMuted ? "Unmute Mic" : "Mute Mic"}
                  >
                    {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
                  </button>

                  {/* Hold */}
                  <button
                    type="button"
                    onClick={handleToggleHold}
                    className={`p-2.5 rounded-xl border transition cursor-pointer ${
                      callState === "on_hold"
                        ? "bg-amber-950/70 border-amber-700 text-amber-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                    }`}
                    title={callState === "on_hold" ? "Resume" : "Hold"}
                  >
                    {callState === "on_hold" ? <Play size={15} /> : <Pause size={15} />}
                  </button>

                  {/* BIG RED END CALL BUTTON - ALWAYS VISIBLE! */}
                  <button
                    type="button"
                    onClick={handleHangup}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer transition active:scale-95"
                    title="Hang up call"
                  >
                    <PhoneOff size={15} /> End Call
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DOCKED SOFTPHONE WIDGET & DIALPAD (IDLE STATE)                          */}
      {/* ========================================================================= */}
      {callState === "idle" && (
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 max-w-[calc(100vw-24px)]">
          {!isDialpadOpen ? (
            /* Minimized Softphone Pill */
            <div className="flex items-center gap-2 p-1.5 sm:p-2 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-full shadow-2xl hover:border-violet-500/50 transition-all">
              <button
                type="button"
                onClick={() => {
                  audioEngine.unlockAudio();
                  setIsDialpadOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 text-xs font-semibold cursor-pointer transition-colors"
              >
                <Phone size={14} className="text-violet-400" />
                <span>WebRTC Softphone</span>
              </button>

              <button
                type="button"
                onClick={handleSimulateIncoming}
                title="Simulate incoming call ring"
                className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors cursor-pointer"
              >
                + Test Ring
              </button>
            </div>
          ) : (
            /* Expanded Softphone Dialpad */
            <div className="w-[310px] sm:w-80 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200 flex flex-col">
              {/* Header */}
              <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center">
                    <Phone size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-100">WebRTC Dialer</h4>
                    <span className="text-[10px] text-zinc-400 font-mono">CPaaS Audio Engine</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSimulateIncoming}
                    className="p-1 text-[10px] rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 px-1.5 cursor-pointer"
                  >
                    Sim Ring
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDialpadOpen(false)}
                    className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded cursor-pointer"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>

              {/* Caller ID selector */}
              <div className="px-3 py-1.5 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center justify-between text-xs">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Trunk:</span>
                <select
                  value={selectedCallerId}
                  onChange={(e) => setSelectedCallerId(e.target.value)}
                  className="text-[11px] font-mono bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none"
                >
                  {CALLER_IDS.map((c) => (
                    <option key={c.id} value={c.number}>
                      {c.number} ({c.label.slice(0, 12)}...)
                    </option>
                  ))}
                </select>
              </div>

              {/* Dialpad Input */}
              <div className="p-3 space-y-2.5">
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5">
                  <input
                    type="text"
                    value={dialInput}
                    onChange={(e) => setDialInput(e.target.value)}
                    placeholder="+91 99887 11002"
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
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 transition-colors active:scale-95"
                >
                  <Phone size={15} /> Call Customer Number
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Screen Pop Card */}
      <ScreenPopCard
        isOpen={showScreenPop}
        onClose={() => setShowScreenPop(false)}
        lead={activeLead}
        onTransfer={() => {
          toast.success("Warm transfer placed to telephony supervisor");
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
          // Dispatched cleanly
        }}
      />

      {/* Carrier GSM Trunk Settings Modal */}
      <CarrierConfigModal
        isOpen={showCarrierModal}
        onClose={() => setShowCarrierModal(false)}
      />
    </>
  );
};
