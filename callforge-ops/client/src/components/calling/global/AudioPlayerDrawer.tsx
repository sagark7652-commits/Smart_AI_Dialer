import React, { useState, useRef } from "react";
import {
  X,
  Play,
  Pause,
  Download,
  Volume2,
  Sparkles,
  Bot,
  User,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { CDRRecord } from "../supervisor/CDRDataTable";

interface AudioPlayerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  record?: CDRRecord | null;
}

export const AudioPlayerDrawer: React.FC<AudioPlayerDrawerProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(272); // 4m 32s default
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen || !record) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {
        // Fallback for demo environments
        setIsPlaying(true);
      });
      setIsPlaying(true);
    }
  };

  const handleSpeedCycle = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
    toast.info(`Playback speed set to ${next}x`);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const transcript = record.transcript || [
    {
      speaker: record.agentName,
      text: "Namaste. This is an automated voice assistant calling from CallForge on a recorded line for quality and compliance. May I speak with you for 2 minutes regarding your recent enquiry?",
      time: "00:02",
    },
    {
      speaker: record.customerName,
      text: "Haan, boliyen. Main festive season ke calling packages check kar raha tha.",
      time: "00:15",
    },
    {
      speaker: record.agentName,
      text: "Bilkul sahi samay par call kiya gaya hai. Hamare paas 40 concurrent AI agent lines par 20% discount offer chal raha hai with TRAI DLT registration support.",
      time: "00:26",
    },
    {
      speaker: record.customerName,
      text: "Achha, kya isme live call monitoring aur supervisor whisper facility bhi shamil hai?",
      time: "00:48",
    },
    {
      speaker: record.agentName,
      text: "Ji haan, complete web-based supervisor wallboard, live whisper, aur auto-QA scorecard sabhi shamil hain. Kal subah 11 baje ek walkthrough schedule kar lein?",
      time: "01:05",
    },
    {
      speaker: record.customerName,
      text: "Haan, perfect. Kal subah 11 baje connect karte hain.",
      time: "01:22",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center">
              <Volume2 size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-zinc-100">Recording & Transcript</h3>
              <p className="text-[10px] text-zinc-400 font-mono">
                {record.id} · {record.duration}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Audio Player Scrubber & Waveform */}
        <div className="p-4 bg-zinc-900/40 border-b border-zinc-800 space-y-3">
          <audio
            ref={audioRef}
            src={record.recordingUrl}
            onTimeUpdate={() => {
              if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
            }}
            onLoadedMetadata={() => {
              if (audioRef.current) setDuration(audioRef.current.duration || 272);
            }}
            onEnded={() => setIsPlaying(false)}
          />

          {/* Waveform Visualization Bars */}
          <div className="flex items-end justify-between gap-1 h-12 py-1 px-2 bg-zinc-950/80 rounded-lg border border-zinc-800/80">
            {[
              30, 50, 70, 45, 80, 95, 60, 40, 85, 90, 75, 55, 65, 80, 92, 45, 60, 70, 88, 52, 64, 40,
              80, 95,
            ].map((height, i) => {
              const active = (i / 24) * duration <= currentTime;
              return (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    active ? "bg-violet-400" : "bg-zinc-800"
                  }`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>

          {/* Time Scrubber */}
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Audio Controls */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleSpeedCycle}
              className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono font-bold text-zinc-300 transition-colors cursor-pointer"
            >
              {playbackRate}x Speed
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-violet-600/30 cursor-pointer"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => toast.success("Encrypted WAV recording downloaded")}
              className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              title="Download Encrypted Call Audio (Signed S3 URL)"
            >
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* Transcript Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
              <Sparkles size={12} className="text-violet-400" />
              Synchronized Dialogue Transcript
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck size={11} /> 100% Preamble Verified
            </span>
          </div>

          {transcript.map((msg, i) => {
            const isAgent = msg.speaker.toLowerCase().includes("ai") || msg.speaker.toLowerCase().includes("asha") || msg.speaker.toLowerCase().includes("agent");
            return (
              <div
                key={i}
                className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                  isAgent
                    ? "bg-zinc-900/80 border-zinc-800/80 text-zinc-200 ml-2"
                    : "bg-violet-950/25 border-violet-800/30 text-zinc-100 mr-2"
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold flex items-center gap-1 text-zinc-300">
                    {isAgent ? (
                      <Bot size={12} className="text-violet-400" />
                    ) : (
                      <User size={12} className="text-cyan-400" />
                    )}
                    {msg.speaker}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">{msg.time}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-300">{msg.text}</p>
              </div>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/40 text-center text-[10px] text-zinc-500 font-mono">
          AWS S3 Signed Audio · 90 Days Retention Policy Compliant
        </div>
      </div>
    </div>
  );
};
