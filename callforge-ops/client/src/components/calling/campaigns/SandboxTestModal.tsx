import React, { useState, useEffect, useRef } from "react";
import { X, Phone, PhoneOff, Bot, User, Mic, MicOff, ShieldCheck, Sparkles, Send, Volume2 } from "lucide-react";
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
  speaker: "agent" | "user";
  text: string;
  time: string;
}

const QUICK_TEST_QUERIES = [
  "Kya offer chal raha hai?",
  "Pricing aur rate kitna hai?",
  "Demo kaise dekh sakte hain?",
  "Ye software kaise kaam karta hai?",
  "Nahi, mujhe abhi zaroorat nahi hai",
];

export const SandboxTestModal: React.FC<SandboxTestModalProps> = ({
  isOpen,
  onClose,
  scriptText = "Offer festive season 20% discount on annual cloud calling packs.",
  agentName = "Asha (Hindi/English)",
  onCallCompleted,
}) => {
  const [phoneNumber, setPhoneNumber] = useState("+91 98201 55432");
  const [leadName, setLeadName] = useState("Rajesh Varma");
  const [callState, setCallState] = useState<"idle" | "ringing" | "connected" | "ended">("idle");
  const [timer, setTimer] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [inputText, setInputText] = useState("");
  const [statusText, setStatusText] = useState("Ready to dial");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  }, [messages, isListening, isAgentSpeaking]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Trigger speech recognition loop to listen to customer's microphone
  const startListeningLoop = () => {
    if (callState === "ended" || callState === "idle") return;

    audioEngine.unlockAudio();
    setIsListening(true);
    setStatusText("🎤 AI listening to your voice... Speak now into your mic!");

    const supported = audioEngine.startSpeechRecognition(
      (transcript) => {
        // User spoke successfully
        setIsListening(false);
        handleUserMessage(transcript);
      },
      (err) => {
        // Recognition error or timeout
        setIsListening(false);
        setStatusText("Click mic or type below to reply to the AI");
      },
      () => {
        // Recognition ended
        setIsListening(false);
      }
    );

    if (!supported) {
      setIsListening(false);
      setStatusText("Type in the box or click prompt buttons to talk with AI");
    }
  };

  // Process any user message (from voice mic, text input, or quick chip)
  const handleUserMessage = (userText: string) => {
    if (!userText.trim()) return;

    // Stop active listening and speaking
    audioEngine.stopSpeechRecognition();
    setIsListening(false);

    const currentTime = formatTime(timer);
    const userMsg: ChatMessage = {
      speaker: "user",
      text: userText,
      time: currentTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    setStatusText("🤖 AI is thinking & formulating response...");
    setIsAgentSpeaking(true);

    // Generate smart context-aware conversational reply
    setTimeout(() => {
      const reply = audioEngine.generateConversationalReply(userText, {
        leadName,
        agentName,
        scriptText,
      });

      const agentMsg: ChatMessage = {
        speaker: "agent",
        text: reply,
        time: formatTime(timer + 1),
      };

      setMessages((prev) => [...prev, agentMsg]);
      setStatusText("🔊 AI speaking...");

      // Speak response out loud, then automatically start listening for the user again!
      audioEngine.speakAgentMessage(reply, () => {
        setIsAgentSpeaking(false);
        // Automatically re-arm microphone for two-way continuous voice dialogue
        setTimeout(() => {
          startListeningLoop();
        }, 300);
      });
    }, 400);
  };

  const handleStartCall = () => {
    if (!phoneNumber) {
      toast.error("Please provide a valid test phone number");
      return;
    }

    audioEngine.unlockAudio();
    setCallState("ringing");
    setMessages([]);
    setStatusText(`Dialing ${phoneNumber}...`);
    toast.info(`Dialing ${phoneNumber}...`);
    audioEngine.startRingback();

    // Connect call after telecom ring cadence
    setTimeout(() => {
      audioEngine.stopRingback();
      audioEngine.playConnectChime();
      setCallState("connected");
      toast.success("Call connected to Live Voice AI Sandbox");

      // AI Agent delivers initial customized greeting / pitch
      setTimeout(() => {
        const greeting = scriptText
          ? `Namaste ${leadName} ji! Main CallForge AI voice agent ${agentName.split(" ")[0]} bol rahi hoon. ${scriptText} Batayiye, kya main iske baare me aapse 2 minute baat kar sakti hoon?`
          : `Namaste ${leadName} ji! Main CallForge AI Calling platform se bol rahi hoon. Hamare paas aapke business ke liye exclusive festive calling offer aur direct DLT setup uplabdh hai. Main isme aapki kaise help kar sakti hoon?`;

        setMessages([
          {
            speaker: "agent",
            text: greeting,
            time: "00:01",
          },
        ]);

        setStatusText("🔊 AI agent introducing call...");
        setIsAgentSpeaking(true);

        // Speak opening greeting, then automatically start listening to the user!
        audioEngine.speakAgentMessage(greeting, () => {
          setIsAgentSpeaking(false);
          startListeningLoop();
        });
      }, 500);
    }, 2000);
  };

  const handleHangup = () => {
    audioEngine.stopRingback();
    audioEngine.playDisconnectTone();
    audioEngine.stopSpeaking();
    audioEngine.stopSpeechRecognition();
    setIsListening(false);
    setIsAgentSpeaking(false);
    setCallState("ended");
    setStatusText("Call disconnected");
    toast.info("Sandbox test call ended");

    // Post CDR log so the test call updates dashboard metrics
    try {
      fetch("/api/calling/cdrs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: leadName,
          customerPhone: phoneNumber,
          agentName: agentName,
          campaign: "Sandbox Voice Test",
          duration: formatTime(timer || 12),
          durationSeconds: timer || 12,
          status: "Completed",
          sentiment: "Positive",
          qaScore: 95,
        }),
      })
        .then(() => onCallCompleted?.())
        .catch(() => {});
    } catch {}

    setTimeout(() => {
      setCallState("idle");
      setStatusText("Ready to dial");
    }, 1500);
  };

  const handleSendInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");
    handleUserMessage(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Sandbox Interactive Voice Call</span>
                {callState === "connected" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </h3>
              <p className="text-[11px] text-zinc-400">Two-way natural conversation with microphone speech & smart AI</p>
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
          {/* Target Number & Contact Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">Test Phone Number</label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={callState !== "idle"}
                placeholder="+91 99887 76655"
                className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 font-mono disabled:opacity-60"
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
                className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Active Voice Agent:</span>
            <span className="font-semibold text-violet-300 flex items-center gap-1.5">
              <Bot size={13} /> {agentName}
            </span>
          </div>

          {/* Call Screen Area */}
          <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/90 flex flex-col items-center justify-center min-h-[220px]">
            {callState === "idle" && (
              <div className="text-center space-y-2 py-4">
                <div className="w-12 h-12 rounded-full bg-violet-600/20 text-violet-400 mx-auto flex items-center justify-center">
                  <Phone size={20} />
                </div>
                <p className="text-xs text-zinc-300 font-medium">
                  Two-Way Speech Test Ready
                </p>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  Jab call connect hogi, AI aapse baat karegi aur aap mic me bol kar sawaal puch sakte hain. AI turant jawab degi!
                </p>
                <button
                  type="button"
                  onClick={handleStartCall}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg flex items-center gap-2 mx-auto transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Phone size={14} /> Place Test Call
                </button>
              </div>
            )}

            {callState === "ringing" && (
              <div className="text-center space-y-2 py-6 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                  <Phone size={20} className="animate-bounce" />
                </div>
                <p className="text-xs font-semibold text-amber-300">Ringing {phoneNumber}...</p>
                <p className="text-[10px] text-zinc-500 font-mono">Audio bridge establishing</p>
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
                    <span className="text-xs font-semibold text-zinc-100">Live Call Connected</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                    {formatTime(timer)}
                  </span>
                  <button
                    type="button"
                    onClick={handleHangup}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-md flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <PhoneOff size={12} /> End Call
                  </button>
                </div>

                {/* Real-time status badge */}
                <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
                  <div className="flex items-center gap-1.5 truncate">
                    {isListening ? (
                      <span className="text-rose-400 font-semibold flex items-center gap-1 animate-pulse">
                        <Mic size={13} /> AI Listening... Speak into mic
                      </span>
                    ) : isAgentSpeaking ? (
                      <span className="text-violet-400 font-semibold flex items-center gap-1">
                        <Volume2 size={13} className="animate-bounce" /> AI Speaking...
                      </span>
                    ) : (
                      <span className="text-zinc-400">{statusText}</span>
                    )}
                  </div>

                  {/* Manual Mic Toggle */}
                  {callState === "connected" && (
                    <button
                      type="button"
                      onClick={isListening ? () => { audioEngine.stopSpeechRecognition(); setIsListening(false); } : startListeningLoop}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition ${
                        isListening
                          ? "bg-rose-600 text-white animate-pulse"
                          : "bg-violet-600 hover:bg-violet-500 text-white"
                      }`}
                      title="Toggle Microphone"
                    >
                      {isListening ? <MicOff size={10} /> : <Mic size={10} />}
                      {isListening ? "Stop Mic" : "Tap to Speak"}
                    </button>
                  )}
                </div>

                {/* Conversation Stream */}
                <div className="space-y-2 max-h-48 min-h-[120px] overflow-y-auto pr-1 border border-zinc-800/60 rounded-lg p-2 bg-zinc-950/60">
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
                            {m.speaker === "agent" ? agentName.split(" ")[0] : leadName}
                          </span>
                          <span>{m.time}</span>
                        </div>
                        <p>{m.text}</p>
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

                {/* Quick Suggestion Chips */}
                {callState === "connected" && (
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                      <Sparkles size={11} className="text-violet-400" /> Click to ask the AI directly:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {QUICK_TEST_QUERIES.map((query, i) => (
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

                {/* Text input to also chat/speak directly */}
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
            <ShieldCheck size={13} className="text-emerald-400" /> Interactive Voice Engine active
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
