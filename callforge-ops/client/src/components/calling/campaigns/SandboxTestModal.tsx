import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Phone,
  PhoneOff,
  Bot,
  User,
  Mic,
  MicOff,
  ShieldCheck,
  Sparkles,
  Send,
  Volume2,
  Globe,
  Radio,
  PhoneForwarded,
  Calendar,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { audioEngine } from "../../../lib/calling/audioEngine";

interface SandboxTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptText?: string;
  agentName?: string;
  onCallCompleted?: () => void;
}

interface ChatMessage {
  speaker: "agent" | "user" | "system";
  text: string;
  time: string;
  toolAction?: string;
}

const AGENTS = [
  {
    id: "agent_swifttel_5g",
    name: "Simran - SwiftTel 5G",
    role: "Promotional Telecaller",
    badge: "5G Telecalling & Sales",
    company: "SwiftTel 5G",
    defaultLang: "en-IN",
    sampleQuestions: {
      "en-IN": [
        "Tell me about the plan",
        "What is the price?",
        "Send details on WhatsApp",
        "Please call me in next two days",
        "Activate this plan for me",
      ],
      "hi-IN": [
        "5G plan ke baare me batayein",
        "Kitna price hai?",
        "WhatsApp par details bhej do",
        "Main busy hoon, do din baad call karna",
        "Plan activate kar do",
      ],
      "mr-IN": [
        "५G प्लॅन बद्दल माहिती सांगा",
        "किंमत किती आहे?",
        "WhatsApp वर माहिती पाठवा",
        "मी व्यस्त आहे, दोन दिवसांनी फोन करा",
        "प्लॅन ॲक्टिव्हेट करा",
      ],
    },
  },
  {
    id: "agent_aarogya_dental",
    name: "Priya - Aarogya Dental Care",
    role: "Clinic Coordinator",
    badge: "Appointment Booking",
    company: "Aarogya Dental Care",
    defaultLang: "hi-IN",
    sampleQuestions: {
      "en-IN": [
        "Can I book an appointment with Dr. Sharma?",
        "What are the charges for teeth cleaning?",
        "How much for root canal treatment?",
        "Call me back tomorrow morning",
        "Where is your clinic located?",
      ],
      "hi-IN": [
        "Dr. Sharma se appointment kab milega?",
        "Teeth cleaning ka kitna charge hai?",
        "Root canal me kitna time aur kharcha lagta hai?",
        "Kal 11 baje call karo",
        "Clinic FC Road par kahan hai?",
      ],
      "mr-IN": [
        "डॉ. शर्मा यांची अपॉइंटमेंट हवी आहे",
        "दात स्वच्छ करण्याचे शुल्क किती आहे?",
        "रूट कॅनॉलचा खर्च किती आहे?",
        "उद्या सकाळी फोन करा",
        "क्लिनिकचा पत्ता काय आहे?",
      ],
    },
  },
  {
    id: "agent_tata_banking_01",
    name: "Aarti - Tata Smartflo Banking",
    role: "Senior Relationship Officer",
    badge: "Customer Support & Loans",
    company: "Tata Smartflo Banking",
    defaultLang: "hi-IN",
    sampleQuestions: {
      "en-IN": [
        "What is my current loan balance?",
        "When is my next EMI due date?",
        "Please send payment link",
        "Transfer me to a senior specialist",
        "Call back after 3 days",
      ],
      "hi-IN": [
        "Mera loan balance kitna bacha hai?",
        "Agli EMI kab cut hogi?",
        "Payment link SMS kar do",
        "Senior agent se baat karwao",
        "Teen din baad call karna",
      ],
      "mr-IN": [
        "माझी उर्वरित कर्ज शिल्लक किती आहे?",
        "पुढील ईएमआय तारीख कोणती आहे?",
        "पेमेंट लिंक पाठवा",
        "वरिष्ठ अधिकाऱ्यांशी जोडून द्या",
        "तीन दिवसांनी संपर्क करा",
      ],
    },
  },
];

const LANGUAGES = [
  { code: "en-IN", label: "English (Indian)", flag: "🇬🇧" },
  { code: "hi-IN", label: "Hindi (हिंदी / Hinglish)", flag: "🇮🇳" },
  { code: "mr-IN", label: "Marathi (मराठी)", flag: "🚩" },
];

export const SandboxTestModal: React.FC<SandboxTestModalProps> = ({
  isOpen,
  onClose,
  onCallCompleted,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState("agent_swifttel_5g");
  const [selectedLanguage, setSelectedLanguage] = useState("en-IN");
  const [phoneNumber, setPhoneNumber] = useState("+91 98201 55432");
  const [leadName, setLeadName] = useState("Rajesh Varma");
  const [callState, setCallState] = useState<"idle" | "ringing" | "connected" | "ended">("idle");
  const [timer, setTimer] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [inputText, setInputText] = useState("");
  const [statusText, setStatusText] = useState("Ready to dial");
  const [sessionId, setSessionId] = useState<string>("");
  const [executedActions, setExecutedActions] = useState<string[]>([]);
  const [showDTMF, setShowDTMF] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeAgent = AGENTS.find((a) => a.id === selectedAgentId) || AGENTS[0];

  // Call timer interval
  useEffect(() => {
    let interval: any;
    if (callState === "connected") {
      interval = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isListening, isAgentSpeaking, isThinking]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Continuous speech recognition loop with true Barge-In detection
  const startListeningLoop = () => {
    if (callState === "ended" || callState === "idle") return;

    audioEngine.unlockAudio();
    setIsListening(true);
    setIsThinking(false);
    setStatusText("🎤 Listening... Speak naturally into your mic");

    const supported = audioEngine.startSpeechRecognition(
      (transcript) => {
        setIsListening(false);
        handleUserMessage(transcript);
      },
      (err) => {
        setIsListening(false);
        setStatusText("Click mic or tap suggestion chip to talk");
      },
      () => {
        setIsListening(false);
      },
      selectedLanguage,
      () => {
        // Barge-in occurred!
        setIsAgentSpeaking(false);
        setStatusText("⚡ Interrupted AI — Listening to you...");
        toast.info("AI speech paused (Barge-in)", { duration: 1500 });
      }
    );

    if (!supported) {
      setIsListening(false);
      setStatusText("Use suggestion buttons or type to chat with AI");
    }
  };

  // Process a user turn through the Real-Time Server LLM Turn Engine
  const handleUserMessage = async (userText: string, dtmfDigit?: string) => {
    if (!userText.trim() && !dtmfDigit) return;

    // Stop active speech recognition and speaking
    audioEngine.stopSpeechRecognition();
    audioEngine.stopSpeaking();
    setIsListening(false);
    setIsAgentSpeaking(false);
    setIsThinking(true);
    setStatusText("🧠 AI reasoning & formulating contextual response...");

    const currentTime = formatTime(timer);
    const userMsg: ChatMessage = {
      speaker: "user",
      text: userText,
      time: currentTime,
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      // Connect to the real backend LLM turn engine with full conversation memory
      const turnResult = await audioEngine.sendTurnToServer(sessionId, userText, {
        language: selectedLanguage,
        dtmfDigit,
        agentId: selectedAgentId,
        customerName: leadName,
        customerPhone: phoneNumber,
      });

      setIsThinking(false);

      // Track any executed tools (e.g. callback, booking, send details)
      let actionLabel = "";
      if (turnResult.toolsExecuted && turnResult.toolsExecuted.length > 0) {
        for (const t of turnResult.toolsExecuted) {
          const actName = t.name.replace(/_/g, " ").toUpperCase();
          actionLabel = `⚡ ${actName}: ${t.result?.message || "Executed"}`;
          setExecutedActions((prev) => [...prev, actionLabel]);
          toast.success(`Action Triggered: ${actName}`, { duration: 2500 });
        }
      }

      const agentMsg: ChatMessage = {
        speaker: "agent",
        text: turnResult.replyText,
        time: formatTime(timer + 1),
        toolAction: actionLabel || undefined,
      };

      setMessages((prev) => [...prev, agentMsg]);
      setStatusText("🔊 AI speaking...");
      setIsAgentSpeaking(true);

      // Speak response aloud in the selected language
      audioEngine.speakAgentMessage(turnResult.replyText, selectedLanguage, () => {
        setIsAgentSpeaking(false);

        if (turnResult.shouldEndCall) {
          setTimeout(() => {
            handleHangup();
          }, 1000);
        } else {
          // Continuous loop: automatically re-arm microphone
          setTimeout(() => {
            startListeningLoop();
          }, 250);
        }
      });
    } catch (e: any) {
      console.error("[Sandbox] Turn Error", e);
      setIsThinking(false);
      setStatusText("Error processing response. Please try again.");
    }
  };

  // Start Call: Initialize Session with Backend AI Engine
  const handleStartCall = async () => {
    if (!phoneNumber) {
      toast.error("Please provide a valid test phone number");
      return;
    }

    audioEngine.unlockAudio();
    setCallState("ringing");
    setMessages([]);
    setExecutedActions([]);
    setStatusText(`Dialing ${phoneNumber}...`);
    toast.info(`Dialing ${phoneNumber}...`);
    audioEngine.startRingback();

    try {
      // 1. Create Conversational Session on the Server
      const res = await fetch("/api/calling/runtime/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgentId,
          language: selectedLanguage,
          customerName: leadName,
          customerPhone: phoneNumber,
          companyName: activeAgent.company,
        }),
      });

      const sessionData = await res.json();
      const currentSessionId = sessionData.sessionId || `sess_${Date.now()}`;
      setSessionId(currentSessionId);
      const greeting = sessionData.initialGreeting || "Hello! Do you have a minute?";

      // Wait 1.8s for realistic telecom ringback
      setTimeout(() => {
        audioEngine.stopRingback();
        audioEngine.playConnectChime();
        setCallState("connected");
        toast.success(`Connected to ${activeAgent.name}`);

        // AI speaks opening greeting
        setTimeout(() => {
          setMessages([
            {
              speaker: "agent",
              text: greeting,
              time: "00:01",
            },
          ]);

          setStatusText("🔊 AI delivering natural greeting...");
          setIsAgentSpeaking(true);

          audioEngine.speakAgentMessage(greeting, selectedLanguage, () => {
            setIsAgentSpeaking(false);
            // Arm continuous listening
            startListeningLoop();
          });
        }, 400);
      }, 1800);
    } catch (err: any) {
      console.error("[Session Start Error]", err);
      audioEngine.stopRingback();
      setCallState("idle");
      toast.error("Failed to start voice call session");
    }
  };

  // End Call & Persist QA Evaluation
  const handleHangup = async () => {
    audioEngine.stopRingback();
    audioEngine.playDisconnectTone();
    audioEngine.stopSpeaking();
    audioEngine.stopSpeechRecognition();
    setIsListening(false);
    setIsAgentSpeaking(false);
    setIsThinking(false);
    setCallState("ended");
    setStatusText("Call disconnected");
    toast.info("Call ended & AI insights recorded in database");

    const fullTranscript = messages
      .filter((m) => m.speaker !== "system")
      .map((m) => `${m.speaker === "agent" ? "Agent" : "Customer"}: ${m.text}`)
      .join("\n");

    try {
      await fetch("/api/calling/runtime/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          transcript: fullTranscript,
          durationSeconds: timer || 25,
          customerName: leadName,
          customerPhone: phoneNumber,
          agentName: activeAgent.name,
        }),
      });
      onCallCompleted?.();
    } catch {}

    setTimeout(() => {
      setCallState("idle");
      setStatusText("Ready to dial");
    }, 2000);
  };

  // Immediate manual Barge-In button
  const handleBargeIn = () => {
    audioEngine.stopSpeaking();
    setIsAgentSpeaking(false);
    startListeningLoop();
    toast.info("Barge-In triggered: AI silenced, mic open", { duration: 1500 });
  };

  // DTMF Keypad Press
  const handleDTMFPress = (digit: string) => {
    if (callState !== "connected") return;
    audioEngine.playDTMF(digit);
    toast.info(`DTMF tone [${digit}] sent`, { duration: 1000 });

    let actionDesc = `Pressed DTMF ${digit}`;
    if (digit === "1") actionDesc = "DTMF 1: Confirm Offer / Booking";
    if (digit === "2") actionDesc = "DTMF 2: Schedule 2-Day Callback";
    if (digit === "9") actionDesc = "DTMF 9: Transfer to Human Agent";

    handleUserMessage(`[Keypad ${digit}]`, digit);
  };

  const handleSendInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText("");
    handleUserMessage(text);
  };

  const sampleQuestionsList =
    activeAgent.sampleQuestions[selectedLanguage as "en-IN" | "hi-IN" | "mr-IN"] ||
    activeAgent.sampleQuestions["en-IN"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Real-Time Conversational AI Voice Agent</span>
                {callState === "connected" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </h3>
              <p className="text-[11px] text-zinc-400">Two-way continuous natural speech with context memory & tools</p>
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
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Agent Persona Selector & Language Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1 flex items-center gap-1">
                <Bot size={13} className="text-violet-400" /> Select AI Agent Persona
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                disabled={callState !== "idle"}
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 disabled:opacity-60 cursor-pointer"
              >
                {AGENTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.badge})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1 flex items-center gap-1">
                <Globe size={13} className="text-emerald-400" /> Spoken Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={callState !== "idle"}
                className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-emerald-500 disabled:opacity-60 cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Customer Details */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Customer Phone Number</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={callState !== "idle"}
                placeholder="+91 98201 55432"
                className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 font-mono disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Customer Name</label>
              <input
                type="text"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                disabled={callState !== "idle"}
                placeholder="Customer Name"
                className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Active Call Interface Area */}
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/90 flex flex-col items-center justify-center min-h-[240px]">
            {callState === "idle" && (
              <div className="text-center space-y-2 py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-600/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <Phone size={22} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-200">{activeAgent.name}</p>
                  <p className="text-[11px] text-zinc-400">{activeAgent.role} • {activeAgent.company}</p>
                </div>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  Click below to start a live two-way phone call. The AI will introduce itself and listen to your actual voice continuously.
                </p>
                <button
                  type="button"
                  onClick={handleStartCall}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg flex items-center gap-2 mx-auto transition-colors cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <Phone size={15} /> Start Live Voice Call
                </button>
              </div>
            )}

            {callState === "ringing" && (
              <div className="text-center space-y-2.5 py-6 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                  <Phone size={22} className="animate-bounce" />
                </div>
                <p className="text-xs font-semibold text-amber-300">Ringing {phoneNumber}...</p>
                <p className="text-[10px] text-zinc-500 font-mono">Carrier audio bridge establishing</p>
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
              <div className="w-full space-y-2.5">
                {/* Status Bar */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <div>
                      <span className="text-xs font-semibold text-zinc-100">{activeAgent.name}</span>
                      <span className="text-[10px] text-zinc-400 ml-1.5 font-mono">[{selectedLanguage}]</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                      {formatTime(timer)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDTMF(!showDTMF)}
                      className={`px-2 py-1 text-xs rounded-md border transition ${
                        showDTMF ? "bg-zinc-700 text-white border-zinc-600" : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                      }`}
                      title="Toggle DTMF Keypad"
                    >
                      Keypad
                    </button>
                    <button
                      type="button"
                      onClick={handleHangup}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-md flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <PhoneOff size={12} /> End Call
                    </button>
                  </div>
                </div>

                {/* State Indicator Pill */}
                <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                  <div className="flex items-center gap-2 truncate">
                    {isThinking ? (
                      <span className="text-cyan-400 font-semibold flex items-center gap-1.5 animate-pulse">
                        <Zap size={13} /> 🧠 AI Reasoning & Tool Calling...
                      </span>
                    ) : isAgentSpeaking ? (
                      <span className="text-violet-400 font-semibold flex items-center gap-1.5">
                        <Volume2 size={13} className="animate-bounce" /> 🔊 AI Speaking...
                      </span>
                    ) : isListening ? (
                      <span className="text-rose-400 font-semibold flex items-center gap-1.5 animate-pulse">
                        <Mic size={13} /> 🎤 Listening to your voice... Speak now
                      </span>
                    ) : (
                      <span className="text-zinc-400">{statusText}</span>
                    )}
                  </div>

                  {/* Barge-In / Interruption Button */}
                  {callState === "connected" && isAgentSpeaking && (
                    <button
                      type="button"
                      onClick={handleBargeIn}
                      className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold flex items-center gap-1 animate-pulse"
                      title="Interrupt AI agent immediately"
                    >
                      ⚡ Interrupt (Barge-In)
                    </button>
                  )}

                  {/* Manual Mic Toggle */}
                  {callState === "connected" && !isAgentSpeaking && (
                    <button
                      type="button"
                      onClick={isListening ? () => { audioEngine.stopSpeechRecognition(); setIsListening(false); } : startListeningLoop}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition ${
                        isListening ? "bg-rose-600 text-white animate-pulse" : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      {isListening ? <MicOff size={10} /> : <Mic size={10} />}
                      {isListening ? "Mute Mic" : "Unmute Mic"}
                    </button>
                  )}
                </div>

                {/* DTMF Keypad Drawer */}
                {showDTMF && callState === "connected" && (
                  <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1.5 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-semibold px-1">
                      <span>DTMF Dialpad (Operational Actions):</span>
                      <span className="text-emerald-400">1: Confirm | 2: Callback | 9: Transfer</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleDTMFPress(key)}
                          className="py-1.5 bg-zinc-900 hover:bg-zinc-800 active:bg-violet-600 text-zinc-200 hover:text-white font-mono font-bold text-xs rounded border border-zinc-800 text-center transition"
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Conversation Transcript */}
                <div className="space-y-2 max-h-52 min-h-[140px] overflow-y-auto pr-1 border border-zinc-800/60 rounded-lg p-2.5 bg-zinc-950/70">
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
                            ? "bg-zinc-800/95 text-zinc-200 border border-zinc-700/60 shadow-sm"
                            : "bg-emerald-950/60 text-emerald-100 border border-emerald-700/50 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[9px] mb-0.5 font-mono text-zinc-400">
                          <span className={m.speaker === "agent" ? "text-violet-400 font-bold" : "text-emerald-400 font-bold"}>
                            {m.speaker === "agent" ? activeAgent.name.split(" ")[0] : leadName}
                          </span>
                          <span>{m.time}</span>
                        </div>
                        <p>{m.text}</p>
                        {m.toolAction && (
                          <div className="mt-1 pt-1 border-t border-zinc-700/50 text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={10} /> {m.toolAction}
                          </div>
                        )}
                      </div>
                      {m.speaker === "user" && (
                        <div className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                          <User size={12} />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Dynamic Suggestion Chips */}
                {callState === "connected" && (
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                      <Sparkles size={11} className="text-emerald-400" /> Or tap to speak query:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {sampleQuestionsList.map((query, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleUserMessage(query)}
                          className="px-2 py-0.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 text-[10px] text-zinc-300 hover:text-white transition cursor-pointer text-left"
                        >
                          {query}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Text Fallback Input */}
                {callState === "connected" && (
                  <form onSubmit={handleSendInput} className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Type what you want to say to the AI..."
                      className="flex-1 px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition"
                    >
                      <Send size={12} /> Send
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/40 shrink-0">
          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-400" /> Context Memory & Tool Execution Engine Active
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

export default SandboxTestModal;
