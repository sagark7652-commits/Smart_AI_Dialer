// Web Audio & Speech Synthesizer Engine for WebRTC Softphone & Simulator
class CallAudioEngine {
  private ctx: AudioContext | null = null;
  private ringOsc1: OscillatorNode | null = null;
  private ringOsc2: OscillatorNode | null = null;
  private ringGain: GainNode | null = null;
  private ringInterval: any = null;
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Explicitly unlock audio and speech synthesis inside direct user touch/click gesture
  unlockAudio() {
    try {
      const ctx = this.getContext();
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      if ("speechSynthesis" in window && !window.speechSynthesis.speaking) {
        const silent = new SpeechSynthesisUtterance(" ");
        silent.volume = 0.01;
        window.speechSynthesis.speak(silent);
      }
    } catch (e) {
      console.warn("[AudioEngine] unlockAudio notice", e);
    }
  }

  // 1. Play DTMF tones for keypresses (authentic telecom tones)
  playDTMF(digit: string) {
    try {
      const ctx = this.getContext();
      const dtmfFrequencies: Record<string, [number, number]> = {
        "1": [697, 1209],
        "2": [697, 1336],
        "3": [697, 1477],
        "4": [770, 1209],
        "5": [770, 1336],
        "6": [770, 1477],
        "7": [852, 1209],
        "8": [852, 1336],
        "9": [852, 1477],
        "*": [941, 1209],
        "0": [941, 1336],
        "#": [941, 1477],
      };

      const freqs = dtmfFrequencies[digit];
      if (!freqs) return;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.value = freqs[0];
      osc2.frequency.value = freqs[1];

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.16);
      osc2.stop(now + 0.16);
    } catch (e) {
      console.warn("[AudioEngine] DTMF error", e);
    }
  }

  // 2. Play realistic telephone ringback tone (400Hz + 450Hz cadence)
  startRingback() {
    this.stopRingback();
    try {
      const ctx = this.getContext();

      const playBurst = () => {
        try {
          if (!this.ctx || this.ctx.state === "closed") return;
          const now = ctx.currentTime;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.frequency.value = 400;
          osc2.frequency.value = 450;

          // Fade in & out
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
          gain.gain.setValueAtTime(0.12, now + 1.2);
          gain.gain.linearRampToValueAtTime(0.001, now + 1.3);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.35);
          osc2.stop(now + 1.35);
        } catch {
          // Ignore
        }
      };

      playBurst();
      this.ringInterval = setInterval(playBurst, 3000);
    } catch (e) {
      console.warn("[AudioEngine] Ringback error", e);
    }
  }

  stopRingback() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  // 3. Play pleasant connected chime earcon
  playConnectChime() {
    this.stopRingback();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Note 1: C5 (523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.value = 523.25;
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: E5 (659.25 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = 659.25;
      gain2.gain.setValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn("[AudioEngine] Connect chime error", e);
    }
  }

  // 4. Play disconnect busy tone
  playDisconnectTone() {
    this.stopRingback();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 425;
        const start = now + i * 0.35;
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.2);
      }
    } catch (e) {
      console.warn("[AudioEngine] Disconnect tone error", e);
    }
  }

  // 5. Speak with AI Voice via Web Speech API (Smooth, non-choppy, Indian natural voice)
  speakAgentMessage(text: string, onEnd?: () => void) {
    if (!("speechSynthesis" in window)) {
      if (onEnd) onEnd();
      return;
    }

    try {
      // Humanize text for clear pronunciation without phoneme clipping
      const cleanText = text
        .replace(/CallForge/gi, "Call Forge")
        .replace(/AI/g, "A.I.")
        .replace(/₹/g, "Rupaye ")
        .replace(/(\d+)%/g, "$1 percent ")
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      // Pacing 0.90 ensures words don't trip over each other or stutter on mobile
      utterance.rate = 0.90;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Select best natural Indian voice
      const voices = window.speechSynthesis.getVoices();
      const bestVoice =
        voices.find((v) => v.lang === "hi-IN" || v.lang === "hi_IN") ||
        voices.find((v) => v.lang === "en-IN" || v.lang === "en_IN") ||
        voices.find((v) => v.name.toLowerCase().includes("india") || v.name.toLowerCase().includes("hindi")) ||
        voices.find((v) => v.name.includes("Google") && (v.lang.startsWith("hi") || v.lang.startsWith("en"))) ||
        voices.find((v) => v.lang.startsWith("en"));

      if (bestVoice) {
        utterance.voice = bestVoice;
        utterance.lang = bestVoice.lang;
      }

      utterance.onend = () => {
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        if (onEnd) onEnd();
      };

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("[AudioEngine] Speech error", e);
      if (onEnd) onEnd();
    }
  }

  stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  // 6. Microphone access & audio analyser for live waveform
  async startMicrophone(): Promise<AnalyserNode | null> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return null;
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = this.getContext();
      const source = ctx.createMediaStreamSource(this.micStream);
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 64;
      source.connect(this.micAnalyser);
      return this.micAnalyser;
    } catch {
      return null;
    }
  }

  stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.micAnalyser = null;
  }
}

export const audioEngine = new CallAudioEngine();
