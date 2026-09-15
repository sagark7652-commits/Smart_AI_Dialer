import React, { useState } from "react";
import { Bot, Volume2, Play, Pause, Check, Sliders, Sparkles } from "lucide-react";
import { toast } from "sonner";

export interface VoiceOption {
  id: string;
  name: string;
  gender: "Female" | "Male";
  languages: string;
  tone: string;
  sampleUrl?: string;
  badge?: string;
}

export const VOICES: VoiceOption[] = [
  {
    id: "v-asha",
    name: "Asha",
    gender: "Female",
    languages: "Hindi + English (Bilingual)",
    tone: "Warm, empathetic, professional consultative",
    badge: "Most Popular",
  },
  {
    id: "v-kabir",
    name: "Kabir",
    gender: "Male",
    languages: "Hinglish + Indian English",
    tone: "Confident, executive, consultative renewal specialist",
    badge: "Enterprise",
  },
  {
    id: "v-meera",
    name: "Meera",
    gender: "Female",
    languages: "Indian English + Hindi",
    tone: "Energetic, clear enunciation, fast response",
    badge: "High Conversion",
  },
  {
    id: "v-rohan",
    name: "Rohan",
    gender: "Male",
    languages: "Hindi + Marathi + English",
    tone: "Polite, friendly retail sales tone",
  },
  {
    id: "v-ananya",
    name: "Ananya",
    gender: "Female",
    languages: "Tamil + English + Hindi",
    tone: "Gentle, customer delight & support oriented",
  },
];

interface VoiceSelectionPickerProps {
  selectedVoiceId?: string;
  onSelectVoice?: (voice: VoiceOption) => void;
  className?: string;
}

export const VoiceSelectionPicker: React.FC<VoiceSelectionPickerProps> = ({
  selectedVoiceId = "v-asha",
  onSelectVoice,
  className = "",
}) => {
  const [selectedId, setSelectedId] = useState(selectedVoiceId);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);

  const handlePlaySample = (voice: VoiceOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingVoiceId === voice.id) {
      setPlayingVoiceId(null);
    } else {
      setPlayingVoiceId(voice.id);
      toast.success(`Playing sample for ${voice.name} (${voice.languages})`);
      setTimeout(() => setPlayingVoiceId(null), 3500);
    }
  };

  const handleSelect = (voice: VoiceOption) => {
    setSelectedId(voice.id);
    onSelectVoice?.(voice);
    toast.info(`Active Voice Persona: ${voice.name}`);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-violet-400" />
          <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
            India Voice Assistant Library
          </h4>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono">5 Neural Indian Accents</span>
      </div>

      {/* Voice Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {VOICES.map((voice) => {
          const isSelected = selectedId === voice.id;
          const isPlaying = playingVoiceId === voice.id;
          return (
            <div
              key={voice.id}
              onClick={() => handleSelect(voice)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                isSelected
                  ? "border-violet-500 bg-violet-950/30 shadow-md shadow-violet-950/40 ring-1 ring-violet-500/50"
                  : "border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isSelected
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {voice.name[0]}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                        {voice.name}
                        {voice.badge && (
                          <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-mono font-medium">
                            {voice.badge}
                          </span>
                        )}
                      </h5>
                      <span className="text-[10px] text-zinc-400">{voice.languages}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px]">
                      <Check size={10} />
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400 italic mb-3 leading-relaxed">
                  “{voice.tone}”
                </p>
              </div>

              {/* Sample Audio Button */}
              <button
                type="button"
                onClick={(e) => handlePlaySample(voice, e)}
                className={`w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  isPlaying
                    ? "bg-violet-600 text-white animate-pulse"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                }`}
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                {isPlaying ? "Playing Sample..." : "Listen Voice Sample"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Speed & Pitch Controls */}
      <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <div className="flex items-center justify-between text-zinc-300 mb-1.5">
            <span className="text-[11px] font-semibold flex items-center gap-1">
              <Sliders size={12} /> Speech Cadence / Speed
            </span>
            <span className="font-mono text-violet-400">{speed}x</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.3"
            step="0.05"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full accent-violet-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-zinc-300 mb-1.5">
            <span className="text-[11px] font-semibold flex items-center gap-1">
              <Sparkles size={12} /> Voice Pitch / Tone Depth
            </span>
            <span className="font-mono text-cyan-400">{pitch}x</span>
          </div>
          <input
            type="range"
            min="0.85"
            max="1.15"
            step="0.05"
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
            className="w-full accent-cyan-500"
          />
        </div>
      </div>
    </div>
  );
};
