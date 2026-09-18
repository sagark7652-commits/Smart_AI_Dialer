import React, { useState } from "react";
import { Bot, Volume2, Play, Pause, Check, Sliders, Sparkles } from "lucide-react";
import { toast } from "sonner";

export interface VoiceOption {
  id: string;
  name: string;
  gender: "Female" | "Male";
  provider: "Sarvam AI" | "ElevenLabs" | "OpenAI Neural";
  languages: string;
  tone: string;
  samplePhrase: string;
  badge?: string;
  sampleUrl?: string;
}

export const VOICES: VoiceOption[] = [
  {
    id: "v-asha",
    name: "Asha",
    gender: "Female",
    provider: "Sarvam AI",
    languages: "Hindi + English (Bilingual)",
    tone: "Warm, empathetic, consultative Indian accent",
    samplePhrase: "नमस्ते! मैं कॉलफोर्ज एआई से बोल रही हूँ, क्या यह आपसे बात करने का सही समय है?",
    badge: "Sarvam Bulbul V2",
  },
  {
    id: "v-kabir",
    name: "Kabir",
    gender: "Male",
    provider: "Sarvam AI",
    languages: "Hinglish + Indian English",
    tone: "Confident, executive, consultative renewal specialist",
    samplePhrase: "Hello! Main Kabir bol raha hoon CallForge se, aapke renewal ke regarding connect kiya tha.",
    badge: "Sarvam Shaan V2",
  },
  {
    id: "v-meera",
    name: "Meera",
    gender: "Female",
    provider: "Sarvam AI",
    languages: "Indian English + Hindi",
    tone: "Energetic, clear enunciation, fast response",
    samplePhrase: "Hello! Meera here from CallForge Ops, how can I assist your business today?",
    badge: "High Conversion",
  },
  {
    id: "v-rohan",
    name: "Rohan",
    gender: "Male",
    provider: "Sarvam AI",
    languages: "Hindi + Marathi + English",
    tone: "Polite, friendly retail sales tone",
    samplePhrase: "Namaste! Main Rohan, CallForge team se baat kar raha hoon.",
    badge: "Retail Dialect",
  },
  {
    id: "v-priya",
    name: "Priya",
    gender: "Female",
    provider: "Sarvam AI",
    languages: "Marathi + Hindi",
    tone: "Polite, empathetic, Pune/Mumbai regional dialect",
    samplePhrase: "नमस्कार! मी कॉलफोर्ज टीमकडून बोलतेय, आपल्या अर्जाबद्दल माहिती देण्यासाठी फोन केला आहे.",
    badge: "Sarvam Bhashini",
  },
  {
    id: "v-ananya",
    name: "Ananya",
    gender: "Female",
    provider: "Sarvam AI",
    languages: "Tamil + English",
    tone: "Gentle, customer delight & support oriented",
    samplePhrase: "வணக்கம்! நான் கால்ஃபோர்ஜ்-லிருந்து பேசுகிறேன், உங்களுக்கு உதவ முடியுமா?",
    badge: "Sarvam Dhwani",
  },
  {
    id: "v-suresh",
    name: "Suresh",
    gender: "Male",
    provider: "Sarvam AI",
    languages: "Telugu + English",
    tone: "Energetic, clear enunciation, fast response",
    samplePhrase: "నమస్కారం! నేను కాల్‌ఫోర్జ్ నుండి మాట్లాడుతున్నాను, మీ రిజిస్ట్రేషన్ వివరాలు సరిచూసుకోవడానికి కాల్ చేశాను.",
    badge: "Sarvam Pravakta",
  },
  {
    id: "v-soumya",
    name: "Soumya",
    gender: "Female",
    provider: "Sarvam AI",
    languages: "Bengali + Hindi",
    tone: "Courteous, appointment booking & advisory",
    samplePhrase: "নমস্কার! আমি কলফোর্জ থেকে বলছি, আপনার সাথে কথা বলার জন্য দু'মিনিট সময় হবে কি?",
    badge: "Sarvam Sangeet",
  },
  {
    id: "v-adam",
    name: "Adam",
    gender: "Male",
    provider: "ElevenLabs",
    languages: "English (Global / Executive)",
    tone: "Deep, authoritative, financial services advisor",
    samplePhrase: "Hello there, I'm calling from CallForge Ops to follow up on your enterprise cloud telephony review.",
    badge: "ElevenLabs Turbo v2.5",
  },
  {
    id: "v-rachel",
    name: "Rachel",
    gender: "Female",
    provider: "ElevenLabs",
    languages: "English (Neutral / Conversational)",
    tone: "Upbeat, crisp articulation, inbound concierge",
    samplePhrase: "Hi! Thanks for reaching out to CallForge. How can I assist you with your telephony operations today?",
    badge: "ElevenLabs Multilingual",
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
  const [providerFilter, setProviderFilter] = useState<string>("All");
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);

  const handlePlaySample = (voice: VoiceOption, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingVoiceId === voice.id) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingVoiceId(null);
      return;
    }

    setPlayingVoiceId(voice.id);
    toast.info(`Playing ${voice.name} (${voice.provider}) sample...`);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(voice.samplePhrase);
      utterance.rate = speed;
      utterance.pitch = pitch;
      
      // Try to find matching voice
      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find((v) =>
        voice.languages.includes("Hindi") ? v.lang.includes("hi") : v.lang.includes("en")
      );
      if (matched) utterance.voice = matched;

      utterance.onend = () => setPlayingVoiceId(null);
      utterance.onerror = () => setPlayingVoiceId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setPlayingVoiceId(null), 3000);
    }
  };

  const handleSelect = (voice: VoiceOption) => {
    setSelectedId(voice.id);
    onSelectVoice?.(voice);
    toast.info(`Active Voice Persona: ${voice.name} (${voice.provider})`);
  };

  const filteredVoices = VOICES.filter(
    (v) => providerFilter === "All" || v.provider === providerFilter
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-violet-400" />
          <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
            Neural Indian & Global Voice Engine
          </h4>
        </div>
        
        {/* Provider Tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800 text-[11px]">
          {["All", "Sarvam AI", "ElevenLabs"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProviderFilter(p)}
              className={`px-2.5 py-0.5 rounded-md font-medium transition cursor-pointer ${
                providerFilter === p
                  ? "bg-violet-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Voice Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredVoices.map((voice) => {
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
                      <span className="text-[10px] text-zinc-400 block">{voice.languages}</span>
                      <span className="text-[9px] font-mono text-violet-400/80">{voice.provider}</span>
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
