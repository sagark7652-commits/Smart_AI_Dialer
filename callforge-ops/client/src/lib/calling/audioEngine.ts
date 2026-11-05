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

  public isSpeaking = false;
  public lastSpokenText: string = "";
  public lastSpokenEndTime: number = 0;

  public isAgentEcho(transcript: string): boolean {
    // Crucial: Echo CAN ONLY occur when agent is actively speaking through device speakers!
    // Once speaking has stopped, caller speech is ALWAYS genuine and NEVER discarded.
    if (!this.isSpeaking || !this.lastSpokenText) return false;
    const cleanUser = transcript.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    const cleanAgent = this.lastSpokenText.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    if (!cleanUser || !cleanAgent) return false;

    // Only flag as echo if it's a long phrase (>= 15 chars) matching agent output almost verbatim
    if (cleanAgent.includes(cleanUser) && cleanUser.length >= 15) {
      return true;
    }
    const userWords = cleanUser.split(/\s+/).filter((w) => w.length > 2);
    if (userWords.length >= 4) {
      const matchCount = userWords.filter((w) => cleanAgent.includes(w)).length;
      if (matchCount / userWords.length >= 0.85) {
        return true;
      }
    }
    return false;
  }

  private currentAudioElement: HTMLAudioElement | null = null;

  async playAudio(src: string, onEnd?: () => void): Promise<boolean> {
    try {
      this.stopSpeaking();
      this.isSpeaking = true;

      const audio = new Audio(src);
      audio.volume = 1.0;
      this.currentAudioElement = audio;

      let hasEnded = false;
      // Watchdog timer: Guarantee speaking state resets even if onended event stalls
      const safetyWatchdog = setTimeout(() => {
        if (!hasEnded) {
          console.warn("[AudioEngine] Audio watchdog timeout, releasing speaking state");
          finish();
        }
      }, 14000);

      const finish = () => {
        if (!hasEnded) {
          hasEnded = true;
          clearTimeout(safetyWatchdog);
          this.isSpeaking = false;
          this.lastSpokenEndTime = Date.now();
          this.currentAudioElement = null;
          if (onEnd) onEnd();
        }
      };

      audio.onended = finish;
      audio.onerror = (e) => {
        console.warn("[AudioEngine] Audio playback error for src:", src, e);
        finish();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn("[AudioEngine] Playback promise rejected:", e);
          finish();
        });
      }

      return true;
    } catch (e) {
      console.warn("[AudioEngine] Could not play audio stream:", e);
      this.isSpeaking = false;
      this.currentAudioElement = null;
      if (onEnd) onEnd();
      return false;
    }
  }

  // 5. Speak with Cloned AI Voice or Web Speech API Fallback
  async speakAgentMessage(
    text: string,
    languageOrOptions?: string | { language?: string; audioUrl?: string | null; audioBase64?: string | null; agentId?: string; intent?: string } | (() => void),
    onEnd?: () => void
  ) {
    this.lastSpokenText = (text || "").trim();
    let language = "en-IN";
    let audioUrl: string | undefined | null;
    let audioBase64: string | undefined | null;
    let agentId: string | undefined;
    let intent: string | undefined;
    let callback = onEnd;

    if (typeof languageOrOptions === "object" && languageOrOptions !== null) {
      language = languageOrOptions.language || "en-IN";
      audioUrl = languageOrOptions.audioUrl;
      audioBase64 = languageOrOptions.audioBase64;
      agentId = languageOrOptions.agentId;
      intent = languageOrOptions.intent;
    } else if (typeof languageOrOptions === "string") {
      language = languageOrOptions;
    } else if (typeof languageOrOptions === "function") {
      callback = languageOrOptions;
    }

    // 1. Direct audio URL or base64 provided (plays real cloned studio audio!)
    if (audioUrl) {
      await this.playAudio(audioUrl, callback);
      return;
    }
    if (audioBase64) {
      const src = `data:audio/wav;base64,${audioBase64}`;
      await this.playAudio(src, callback);
      return;
    }

    // 2. Fetch cloned voice TTS from backend
    try {
      const res = await fetch("/api/calling/runtime/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language, agentId, intent }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioUrl) {
          await this.playAudio(data.audioUrl, callback);
          return;
        } else if (data.audioBase64) {
          await this.playAudio(`data:audio/wav;base64,${data.audioBase64}`, callback);
          return;
        }
      }
    } catch (e) {
      console.warn("[AudioEngine] TTS endpoint error:", e);
    }

    // Fallback callback without robotic voice
    if (callback) callback();
    return;

    try {
      this.isSpeaking = true;
      const isEnglish = language.startsWith("en");
      const isMarathi = language.startsWith("mr");

      // Humanize text for natural pronunciation per language
      let cleanText = text
        .replace(/CallForge/gi, "Call Forge")
        .replace(/SwiftTel/gi, "Swift Tel")
        .replace(/AI/g, "A.I.")
        .trim();

      if (isEnglish) {
        cleanText = cleanText.replace(/₹/g, "Rupees ").replace(/(\d+)%/g, "$1 percent ");
      } else {
        cleanText = cleanText.replace(/₹/g, "रुपये ").replace(/(\d+)%/g, "$1 टक्के ");
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.94;
      utterance.pitch = 1.06; // Youthful, warm feminine pitch
      utterance.volume = 1.0;

      // Select best natural FEMALE voice matching language
      const voices = window.speechSynthesis.getVoices();
      let bestVoice: SpeechSynthesisVoice | undefined;

      const isMaleVoice = (v: SpeechSynthesisVoice) => {
        const lower = v.name.toLowerCase();
        return (
          lower.includes("ravi") ||
          lower.includes("david") ||
          lower.includes("mark") ||
          lower.includes("george") ||
          lower.includes("hemant") ||
          lower.includes("male") ||
          lower.includes("guy")
        );
      };

      if (isMarathi) {
        // Native Marathi voice if installed
        bestVoice =
          voices.find((v) => (v.lang === "mr-IN" || v.lang === "mr_IN" || v.lang.startsWith("mr")) && !isMaleVoice(v)) ||
          voices.find((v) => v.name.toLowerCase().includes("marathi") && !isMaleVoice(v));

        // If no Marathi voice installed in Windows, use Indian Hindi female voice (Kalpana/Google) which speaks Devanagari accurately
        if (!bestVoice) {
          bestVoice =
            voices.find((v) => (v.lang === "hi-IN" || v.lang === "hi_IN" || v.lang.startsWith("hi")) && (v.name.toLowerCase().includes("kalpana") || v.name.toLowerCase().includes("female") || !isMaleVoice(v))) ||
            voices.find((v) => v.lang.startsWith("hi") && !isMaleVoice(v));
        }
      } else if (isEnglish) {
        // Strictly pick a FEMALE English voice (NEVER pick Microsoft Ravi!)
        bestVoice =
          voices.find((v) => (v.lang === "en-IN" || v.lang === "en_IN") && (v.name.toLowerCase().includes("heera") || v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("neerja") || !isMaleVoice(v))) ||
          voices.find((v) => v.lang.startsWith("en") && (v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("jenny") || v.name.toLowerCase().includes("aria") || v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("samantha") || !isMaleVoice(v)));
      } else {
        // Hindi female voice (Kalpana or Google Hindi Female)
        bestVoice =
          voices.find((v) => (v.lang === "hi-IN" || v.lang === "hi_IN" || v.lang.startsWith("hi")) && (v.name.toLowerCase().includes("kalpana") || v.name.toLowerCase().includes("female") || !isMaleVoice(v))) ||
          voices.find((v) => v.lang.startsWith("hi") && !isMaleVoice(v));
      }

      if (!bestVoice) {
        bestVoice = voices.find((v) => !isMaleVoice(v)) || voices[0];
      }

      if (bestVoice) {
        utterance.voice = bestVoice;
        utterance.lang = bestVoice.lang;
      } else {
        utterance.lang = language;
      }

      utterance.onend = () => {
        this.isSpeaking = false;
        if (callback) callback();
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
        if (callback) callback();
      };

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("[AudioEngine] Speech error", e);
      this.isSpeaking = false;
      if (callback) callback();
    }
  }

  stopSpeaking() {
    this.isSpeaking = false;
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch {}
      this.currentAudioElement = null;
    }
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  // 6. Microphone access & audio analyser for live waveform
  async startMicrophone(): Promise<AnalyserNode | null> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return null;
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1,
        },
      });
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

  // 7. Speech Recognition for Two-Way Conversational Dialogue with Continuous Listening & Auto-Recovery
  private recognition: any = null;
  public isListeningActive = false;
  private silenceTimer: any = null;
  private accumulatedTranscript = "";

  isSpeechRecognitionSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  startSpeechRecognition(
    onResult: (transcript: string) => void,
    onError?: (err: any) => void,
    onEnd?: () => void,
    language: string = "hi-IN",
    onBargeIn?: () => void,
    onInterim?: (interimText: string) => void
  ): boolean {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.warn("[AudioEngine] Speech recognition not supported in this browser.");
      return false;
    }

    this.isListeningActive = true;
    this.accumulatedTranscript = "";

    const startInstance = () => {
      if (!this.isListeningActive || this.isSpeaking) return;

      try {
        if (this.recognition) {
          try {
            this.recognition.abort();
          } catch {}
          this.recognition = null;
        }

        const reco = new SpeechRecognitionClass();
        reco.continuous = true; // KEEP LISTENING! Never drop mic after a single breath!
        reco.interimResults = true;
        reco.lang = language || "hi-IN";

        reco.onstart = () => {
          console.log("[AudioEngine] Speech recognition active for", language);
        };

        reco.onspeechstart = () => {
          if (this.isSpeaking) {
            console.log("[AudioEngine] Barge-In detected! Customer interrupted AI.");
            this.stopSpeaking();
            if (onBargeIn) onBargeIn();
          }
        };

        reco.onresult = (event: any) => {
          let fullTranscript = "";
          let hasFinal = false;
          for (let i = 0; i < event.results.length; ++i) {
            const piece = event.results[i][0]?.transcript || "";
            fullTranscript += piece;
            if (event.results[i].isFinal) hasFinal = true;
          }

          const currentSpeech = fullTranscript.trim();
          if (currentSpeech) {
            // Anti-Echo Filter: Discard microphone transcription if it picked up the agent's own speech
            const now = Date.now();
            const isRecentEcho =
              (this.isSpeaking || now - this.lastSpokenEndTime < 1800) &&
              this.isAgentEcho(currentSpeech);

            if (isRecentEcho) {
              console.log("[AudioEngine] Self-echo suppressed:", currentSpeech);
              return;
            }

            if (this.isSpeaking) {
              this.stopSpeaking();
              if (onBargeIn) onBargeIn();
            }

            this.accumulatedTranscript = currentSpeech;

            if (onInterim) {
              onInterim(currentSpeech);
            }

            if (this.silenceTimer) clearTimeout(this.silenceTimer);

            // Natural conversational cadence: 850ms after final, 1300ms after interim (prevents cutting off caller)
            const delayMs = hasFinal ? 850 : 1300;
            this.silenceTimer = setTimeout(() => {
              if (this.accumulatedTranscript.trim() && this.isListeningActive) {
                const toSend = this.accumulatedTranscript.trim();
                const isEcho = this.isSpeaking && this.isAgentEcho(toSend);
                if (!isEcho) {
                  this.accumulatedTranscript = "";
                  this.stopSpeechRecognition();
                  onResult(toSend);
                } else {
                  console.log("[AudioEngine] Suppressed true echo during agent speech:", toSend);
                  this.accumulatedTranscript = "";
                }
              }
            }, delayMs);
          }
        };

        reco.onerror = (event: any) => {
          console.warn("[AudioEngine] Recognition event error:", event.error);
          if (event.error === "no-speech") {
            // Normal silence in Chrome, keep listening!
            return;
          }
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            this.isListeningActive = false;
            if (onError) onError(event);
            return;
          }
          // Transient errors (network, aborted): Auto re-arm if still connected!
          if (this.isListeningActive && !this.isSpeaking) {
            setTimeout(() => {
              if (this.isListeningActive && !this.isSpeaking) {
                startInstance();
              }
            }, 150);
          }
        };

        reco.onend = () => {
          // If listening is still active and agent is NOT speaking, auto-rearm recognition immediately!
          if (this.isListeningActive && !this.isSpeaking) {
            setTimeout(() => {
              if (this.isListeningActive && !this.isSpeaking) {
                startInstance();
              }
            }, 80);
          } else {
            if (onEnd) onEnd();
          }
        };

        reco.start();
        this.recognition = reco;
      } catch (e) {
        console.warn("[AudioEngine] Exception starting recognition instance", e);
        if (onError) onError(e);
      }
    };

    startInstance();
    return true;
  }

  stopSpeechRecognition() {
    this.isListeningActive = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
  }

  // 8. Server-Side Conversational Turn Engine Connector
  async sendTurnToServer(
    sessionId: string,
    userMessage: string,
    options?: {
      language?: string;
      dtmfDigit?: string;
      agentId?: string;
      customerName?: string;
      customerPhone?: string;
    }
  ): Promise<{
    replyText: string;
    toolsExecuted: Array<{ name: string; result: any }>;
    intent: string;
    shouldEndCall: boolean;
    language: string;
    audioUrl?: string;
    audioBase64?: string;
  }> {
    try {
      let res = await fetch("/api/calling/runtime/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage,
          language: options?.language || "hi-IN",
          dtmfDigit: options?.dtmfDigit,
          agentId: options?.agentId || "agent_aarogya_dental",
          customerName: options?.customerName,
          customerPhone: options?.customerPhone,
        }),
      });

      // Quick retry once if server was busy or momentarily re-starting
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 400));
        res = await fetch("/api/calling/runtime/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            userMessage,
            language: options?.language || "hi-IN",
            dtmfDigit: options?.dtmfDigit,
            agentId: options?.agentId || "agent_aarogya_dental",
            customerName: options?.customerName,
            customerPhone: options?.customerPhone,
          }),
        });
      }

      if (res.ok) {
        const data = await res.json();
        return {
          replyText: data.replyText,
          toolsExecuted: data.toolsExecuted || [],
          intent: data.intent || "general",
          shouldEndCall: !!data.shouldEndCall,
          language: data.language || options?.language || "hi-IN",
          audioUrl: data.audioUrl,
          audioBase64: data.audioBase64,
        };
      }
    } catch (e) {
      console.warn("[AudioEngine] Server turn error, falling back to local reasoning", e);
    }

    // Graceful offline fallback
    const reply = this.generateConversationalReply(userMessage, {
      agentName: options?.agentId,
      leadName: options?.customerName,
      language: options?.language || "en-IN",
    });
    return {
      replyText: reply,
      toolsExecuted: [],
      intent: "local_fallback",
      shouldEndCall: false,
      language: options?.language || "en-IN",
    };
  }

  // Advanced conversational AI brain for dynamic two-way customer dialogue
  generateConversationalReply(
    userSpeech: string,
    context?: {
      leadName?: string;
      agentName?: string;
      scriptText?: string;
      history?: string[];
      language?: string;
    }
  ): string {
    const text = userSpeech.trim();
    const lower = text.toLowerCase();
    const lang = (context?.language || "hi-IN").toLowerCase();
    const isMarathi = lang.includes("mr") || /[ऀ-ॿ]/.test(text) && (text.includes("आहे") || text.includes("करा") || text.includes("नाही"));
    const isHindi = !isMarathi && (lang.includes("hi") || /[ऀ-ॿ]/.test(text) || lower.includes("hai") || lower.includes("karo"));
    const isEnglish = !isMarathi && !isHindi;
    const namePrefix = context?.leadName ? `${context.leadName} ji, ` : "";

    const rawAgent = (context?.agentName || "").toLowerCase();
    const isBanking = rawAgent.includes("banking") || rawAgent.includes("tata") || rawAgent.includes("aarti");
    const isTelecom = rawAgent.includes("swifttel") || rawAgent.includes("simran") || rawAgent.includes("telecom");
    const isDental = !isBanking && !isTelecom; // Default strictly to Dental Clinic (Aarogya Dental Care)

    // =========================================================================
    // 1. DENTAL CLINIC PERSONA (PRIYA - AAROGYA DENTAL CARE) - STRICTLY ENFORCED
    // =========================================================================
    if (isDental) {
      // Rejection / End
      if (lower.includes("nahi chahiye") || lower.includes("not interested") || lower.includes("bye") || lower.includes("cut") || lower.includes("नको") || lower.includes("कापा")) {
        if (isMarathi) return `समजले ${namePrefix}. आरोग्य डेंटल केअरशी संपर्क केल्याबद्दल धन्यवाद. आपला दिवस शुभ जावो!`;
        if (isHindi) return `Theek hai ${namePrefix}, koi baat nahi. Aarogya Dental Care se judne ke liye shukriya, apna khayal rakhiye!`;
        return `Understood ${namePrefix}. Thank you for connecting with Aarogya Dental Care. Have a wonderful day ahead!`;
      }

      // Callback
      if (lower.includes("call me") || lower.includes("call back") || lower.includes("callback") || lower.includes("kal") || lower.includes("busy") || lower.includes("parso") || lower.includes("उद्या") || lower.includes("व्यस्त")) {
        if (isMarathi) return `नक्कीच ${namePrefix}! मी डॉ. शर्मा यांच्या क्लिनिकसाठी आपल्या कॉलबॅकची नोंद घेतली आहे. आमची टीम आपल्याला संपर्क करेल.`;
        if (isHindi) return `Ji bilkul ${namePrefix}! Maine Dr. Sharma ke clinic ke liye aapka callback note kar liya hai. Hamari team aapse jald hi rabta karegi.`;
        return `Certainly ${namePrefix}! I have noted down your callback request for Aarogya Dental Care. Our clinic coordinator will contact you shortly.`;
      }

      // WhatsApp / SMS / Address details
      if (lower.includes("whatsapp") || lower.includes("sms") || lower.includes("address") || lower.includes("location") || lower.includes("patta") || lower.includes("kahan") || lower.includes("कुठे") || lower.includes("पत्ता")) {
        if (isMarathi) return `आरोग्य डेंटल केअर क्लिनिक ऑफिस २०४, फॉर्च्युन प्लाझा, एफसी रोड, शिवाजी नगर, पुणे (गुड लक कॅफेजवळ) येथे आहे. संपूर्ण पत्ता WhatsApp वर पाठवला आहे.`;
        if (isHindi) return `Aarogya Dental Care clinic Office 204, Fortune Plaza, FC Road, Shivaji Nagar, Pune mein Goodluck Cafe ke paas hai. Maine details aapke WhatsApp par bhej di hain!`;
        return `Aarogya Dental Care is located at Office 204, Fortune Plaza, FC Road, Shivaji Nagar, Pune near Goodluck Cafe. Details have been shared via WhatsApp!`;
      }

      // Pricing / Fees / Charges / Cost
      if (lower.includes("fees") || lower.includes("fee") || lower.includes("price") || lower.includes("cost") || lower.includes("charge") || lower.includes("charges") || lower.includes("kitna") || lower.includes("kharcha") || lower.includes("किंमत") || lower.includes("फीस") || lower.includes("खर्च")) {
        if (isMarathi) return `आरोग्य डेंटल केअरमध्ये कन्सल्टेशन फी ₹४००, दात क्लिनिंग ₹१,२०० आणि रूट कॅनॉल ₹३,५०० पासून सुरू होते. आपण स्लॉट बुक करू इच्छिता का?`;
        if (isHindi) return `Aarogya Dental Care mein consultation fees ₹400, teeth cleaning ₹1,200 aur root canal ₹3,500 se shuru hota hai. Kya main aapka appointment book kar doon?`;
        return `At Aarogya Dental Care, consultation is ₹400, teeth cleaning is ₹1,200, and root canal treatments start at ₹3,500. Would you like to schedule an appointment?`;
      }

      // Appointment Booking / Slot
      if (lower.includes("appointment") || lower.includes("book") || lower.includes("slot") || lower.includes("milna") || lower.includes("doctor") || lower.includes("sharma") || lower.includes("अपॉइंटमेंट") || lower.includes("भेट")) {
        if (isMarathi) return `नक्कीच ${namePrefix}! डॉ. शर्मा यांच्याकडे उद्या सकाळी १०:३० वाजता वेळ उपलब्ध आहे. मी आपली अपॉइंटमेंट बुक करू का?`;
        if (isHindi) return `Ji bilkul ${namePrefix}! Dr. Sharma ke paas kal subah 10:30 AM ka slot uplabdh hai. Kya main aapka slot book kar doon?`;
        return `Certainly ${namePrefix}! Dr. Sharma has consultation slots available tomorrow morning at 10:30 AM. Shall I confirm your booking?`;
      }

      // Identity / Who are you
      if (lower.includes("who are you") || lower.includes("kaun ho") || lower.includes("naam") || lower.includes("robot") || lower.includes("ai") || lower.includes("कोण")) {
        if (isMarathi) return `मी प्रिया, आरोग्य डेंटल केअरची AI असिस्टंट आहे. मी डॉ. शर्मा यांच्या भेटीसाठी आणि दंत उपचारांसाठी आपल्या सेवेत आहे.`;
        if (isHindi) return `Main Priya hoon, Aarogya Dental Care clinic ki smart AI assistant. Main Dr. Sharma se appointment aur dental services mein aapki madad kar sakti hoon.`;
        return `I am Priya, the front desk AI assistant for Aarogya Dental Care. I am here to help you schedule consultations and answer clinic questions!`;
      }

      // Greetings
      if (lower.includes("hello") || lower.includes("hi") || lower.includes("namaste") || lower.includes("नमस्कार")) {
        if (isMarathi) return `नमस्कार ${namePrefix}! आरोग्य डेंटल केअर क्लिनिकमध्ये आपले स्वागत आहे. मी प्रिया, मी आपली काय मदत करू शकते?`;
        if (isHindi) return `Namaste ${namePrefix}! Aarogya Dental Care clinic mein aapka swagat hai. Main Priya bol rahi hoon, main aapki kya sahayata kar sakti hoon?`;
        return `Hello ${namePrefix}! Welcome to Aarogya Dental Care clinic. This is Priya, how may I assist you with your dental consultation today?`;
      }

      // Dental services (cleaning, root canal, pain, implant)
      if (lower.includes("dard") || lower.includes("pain") || lower.includes("daant") || lower.includes("cleaning") || lower.includes("root canal") || lower.includes("दात") || lower.includes("वेदना")) {
        if (isMarathi) return `दात दुखी किंवा उपचारांसाठी आपण लवकरात लवकर डॉ. शर्मा यांना दाखवून घ्यावे. मी आजसाठी आपली अपॉइंटमेंट नोंदवू का?`;
        if (isHindi) return `Daant dard ya treatment ke liye aap jald se jald Dr. Sharma se consult kar lein. Kya main aaj ke liye aapka slot check karoon?`;
        return `For toothache or dental treatment, I recommend consulting Senior Dentist Dr. Sharma as soon as possible. May I check available slots for today?`;
      }

      // Out-of-syllabus default for Dental Clinic
      if (isMarathi) return `मी समजू शकते ${namePrefix}, मी आरोग्य डेंटल केअर क्लिनिककडून बोलत आहे. काय मी आपल्याला डॉ. शर्मा यांच्या भेटीसाठी किंवा उपचारांबद्दल माहिती देऊ?`;
      if (isHindi) return `Main samajh sakti hoon ${namePrefix}, main Aarogya Dental Care clinic se Priya baat kar rahi hoon. Kya aapko Dr. Sharma se appointment ya kisi dental treatment ke baare mein jankari chahiye?`;
      return `I understand ${namePrefix}. I am calling from Aarogya Dental Care clinic. Would you like me to help you schedule a consultation with Dr. Sharma?`;
    }

    // =========================================================================
    // 2. BANKING PERSONA (AARTI - TATA SMARTFLO BANKING)
    // =========================================================================
    if (isBanking) {
      if (isMarathi) return `आपली उर्वरित कर्ज शिल्लक ₹५०,००० आहे आणि पुढील ईएमआय तारीख ०५ ऑक्टोबर २०२६ आहे.`;
      if (isHindi) return `Aapka bacha hua loan balance ₹50,000 hai aur agli EMI 05 October 2026 ko due hai. Tata Smartflo Banking mein sampark ke liye shukriya!`;
      return `Your outstanding loan balance is ₹50,000 with your next EMI scheduled for October 5th, 2026.`;
    }

    // =========================================================================
    // 3. TELECOM PERSONA (SIMRAN - SWIFTTEL 5G)
    // =========================================================================
    if (isMarathi) return `मी सिमरन बोलतेय स्विफ्टटेल ५G कडून. आमच्या वार्षिक ५G प्लॅनची माहिती हवी आहे का?`;
    if (isHindi) return `Main Simran hoon SwiftTel 5G se. Kya aap hamare 5G annual upgrade ke baare mein jaanna chahte hain?`;
    return `Hello! This is Simran from SwiftTel 5G. Would you like to know about our latest 5G annual upgrade?`;
  }
}

export const audioEngine = new CallAudioEngine();
