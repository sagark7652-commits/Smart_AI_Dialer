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

  // 7. Speech Recognition for Two-Way Conversational Dialogue
  private recognition: any = null;

  isSpeechRecognitionSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  startSpeechRecognition(
    onResult: (transcript: string) => void,
    onError?: (err: any) => void,
    onEnd?: () => void
  ): boolean {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.warn("[AudioEngine] Speech recognition not supported in this browser.");
      return false;
    }

    try {
      this.stopSpeechRecognition();
      const reco = new SpeechRecognitionClass();
      reco.continuous = false;
      reco.interimResults = false;
      // Use hi-IN with fallback so both Hindi and Indian English are captured smoothly
      reco.lang = "hi-IN";

      reco.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript || "";
        if (transcript) {
          onResult(transcript);
        }
      };

      reco.onerror = (event: any) => {
        if (onError) onError(event);
      };

      reco.onend = () => {
        if (onEnd) onEnd();
      };

      reco.start();
      this.recognition = reco;
      return true;
    } catch (e) {
      console.warn("[AudioEngine] Error starting speech recognition", e);
      if (onError) onError(e);
      return false;
    }
  }

  stopSpeechRecognition() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
  }

  // Advanced conversational AI brain for dynamic two-way customer dialogue
  generateConversationalReply(
    userSpeech: string,
    context?: {
      leadName?: string;
      agentName?: string;
      scriptText?: string;
      history?: string[];
    }
  ): string {
    const text = userSpeech.trim();
    const lower = text.toLowerCase();
    const namePrefix = context?.leadName ? `${context.leadName} ji, ` : "";

    // 1. Rejection / Negative / Not interested
    if (
      lower.includes("nahi chahiye") ||
      lower.includes("no") ||
      lower.includes("not interested") ||
      lower.includes("zarurat nahi") ||
      lower.includes("zaroorat nahi") ||
      lower.includes("interest nahi") ||
      lower.includes("band karo") ||
      lower.includes("faltu") ||
      lower.includes("cut karo") ||
      lower.includes("phone kato") ||
      lower.includes("kato") ||
      lower.includes("spam")
    ) {
      return `Theek hai ${namePrefix}koi baat nahi. Main aapka preference note kar leti hoon aur aapka number safe list me update kar rahi hoon taaki aage se aapko pareshani na ho. Apna keemti samay dene ke liye shukriya, aapka din shubh rahe!`;
    }

    // 2. Greetings / Salutations / "Hello", "Kaise ho"
    if (
      lower.includes("hello") ||
      lower.includes("namaste") ||
      lower.includes("hi") ||
      lower.includes("hey") ||
      lower.includes("kaise ho") ||
      lower.includes("kya haal") ||
      lower.includes("sunai") ||
      lower.includes("awaz aa rahi") ||
      lower.includes("bol raha hoon") ||
      lower.includes("bol rahi hoon")
    ) {
      return `Namaste ${namePrefix}! Main CallForge AI Calling floor se bol rahi hoon. Main bilkul badhiya hoon, aap bataiye aap kaise hain? Hum India ke businesses ke liye smart automated AI calling solution provide karte hain. Kya aap iske baare me janna chahenge?`;
    }

    // 3. Offers / Deals / Discounts
    if (
      lower.includes("offer") ||
      lower.includes("discount") ||
      lower.includes("deal") ||
      lower.includes("scheme") ||
      lower.includes("fayda") ||
      lower.includes("benefit") ||
      lower.includes("kya de rahe ho") ||
      lower.includes("festive") ||
      lower.includes("bachat") ||
      lower.includes("sasta")
    ) {
      return `Ji ${namePrefix}hamare annual cloud calling pack par flat 20% festive discount chal raha hai. Iske sath aapko 5,000 free calling minutes aur direct TRAI-approved DLT caller ID registration bilkul complimentary milta hai. Kya aap iska 5 minute ka live demo dekhna chahenge?`;
    }

    // 4. Pricing / Cost / Rates
    if (
      lower.includes("price") ||
      lower.includes("rate") ||
      lower.includes("cost") ||
      lower.includes("kharcha") ||
      lower.includes("paisa") ||
      lower.includes("paise") ||
      lower.includes("rupaye") ||
      lower.includes("charge") ||
      lower.includes("kitna lagega") ||
      lower.includes("kitne ka hai") ||
      lower.includes("budget") ||
      lower.includes("monthly") ||
      lower.includes("charges")
    ) {
      return `CallForge ka tariff rate sirf 60 paise prati minute se shuru hota hai jisme zero setup fees aur zero maintenance charges hain. Concurrency lines aur bulk volume par aur bhi attractive custom pricing milti hai. Aap jitna use karenge sirf utna hi pay karna hota hai.`;
    }

    // 5. Identity / Who are you / Why called
    if (
      lower.includes("kaun ho") ||
      lower.includes("who are you") ||
      lower.includes("kaha se") ||
      lower.includes("kiska phone") ||
      lower.includes("kaha se bol rahe") ||
      lower.includes("naam kya hai") ||
      lower.includes("kyu phone kiya") ||
      lower.includes("kyu call kiya") ||
      lower.includes("kisliye") ||
      lower.includes("what company")
    ) {
      return `Main CallForge Enterprise Voice System se baat kar rahi hoon. Hum companies ke liye customer outbound sales, lead qualification aur payment follow-up calls ko AI agents ke through automate karte hain taaki aapka samay aur manpower bache.`;
    }

    // 6. How it works / Technology / Features
    if (
      lower.includes("kaise kaam") ||
      lower.includes("kaise hota") ||
      lower.includes("how it works") ||
      lower.includes("feature") ||
      lower.includes("kya karta hai") ||
      lower.includes("software") ||
      lower.includes("system") ||
      lower.includes("dialer") ||
      lower.includes("bulk") ||
      lower.includes("leads") ||
      lower.includes("excel")
    ) {
      return `Ye platform use karna behad aasan hai! Aap bas apni leads ki Excel ya CSV file dashboard me upload karte hain. Hamara AI system simultaneously thousands of customers ko human-like natural voice me call karke pitch deliver karta hai aur customer ke har sawaal ka live jawab deta hai.`;
    }

    // 7. Language Support
    if (
      lower.includes("hindi") ||
      lower.includes("english") ||
      lower.includes("hinglish") ||
      lower.includes("language") ||
      lower.includes("bhasha") ||
      lower.includes("marathi") ||
      lower.includes("tamil") ||
      lower.includes("telugu") ||
      lower.includes("kannada") ||
      lower.includes("gujarati")
    ) {
      return `Ji haan, bilkul! Hamara AI agent Hindi, English, Hinglish, Marathi, Tamil, Telugu, Kannada aur Gujarati sabhi regional languages me bina kisi delay ke natural human accent me baat kar sakta hai.`;
    }

    // 8. Demo / Trial / Testing
    if (
      lower.includes("demo") ||
      lower.includes("trial") ||
      lower.includes("test") ||
      lower.includes("dikhao") ||
      lower.includes("dekhna hai") ||
      lower.includes("try") ||
      lower.includes("sample") ||
      lower.includes("karo")
    ) {
      return `Bilkul ${namePrefix}! Hum aapke sath ek interactive screen-share demo schedule kar sakte hain jisme aap live custom script test kar payenge. Kya kal subah 11 baje ya dopahar 3 baje ka samay aapke liye suitable rahega?`;
    }

    // 9. Busy / Call back later
    if (
      lower.includes("busy") ||
      lower.includes("baad me") ||
      lower.includes("meeting") ||
      lower.includes("driving") ||
      lower.includes("drive") ||
      lower.includes("kal call") ||
      lower.includes("shaam ko") ||
      lower.includes("later") ||
      lower.includes("time nahi")
    ) {
      return `Samajh gayi ${namePrefix}, aap abhi busy lag rahe hain. Main aapka callback note kar leti hoon aur aapko suvidhajanak samay par call karungi. Have a productive day ahead!`;
    }

    // 10. WhatsApp / Email / Send Details
    if (
      lower.includes("whatsapp") ||
      lower.includes("mail") ||
      lower.includes("email") ||
      lower.includes("bhejo") ||
      lower.includes("bhej do") ||
      lower.includes("send") ||
      lower.includes("brochure") ||
      lower.includes("catalog") ||
      lower.includes("details")
    ) {
      return `Zaroor! Main CallForge product overview, pricing card aur live demo links turant aapke WhatsApp aur registered email par share kar rahi hoon. Aap waha se directly access kar sakte hain.`;
    }

    // 11. Are you AI or real human?
    if (
      lower.includes("ai ho") ||
      lower.includes("robot") ||
      lower.includes("human") ||
      lower.includes("insan") ||
      lower.includes("asli") ||
      lower.includes("real") ||
      lower.includes("computer")
    ) {
      return `Main CallForge ki real-time AI synthetic voice agent hoon! Mere piche advanced neural language models kaam karte hain, jo natural tone me baat karke aapke har sawaal ka pal bhar me satik jawab de sakte hain.`;
    }

    // 12. Agreement / Positive / "Haan batao", "Theek hai"
    if (
      lower.includes("haan") ||
      lower.includes("ha") ||
      lower.includes("batao") ||
      lower.includes("boliye") ||
      lower.includes("theek hai") ||
      lower.includes("sahi hai") ||
      lower.includes("achaa") ||
      lower.includes("okay") ||
      lower.includes("ok") ||
      lower.includes("sure") ||
      lower.includes("yes") ||
      lower.includes("aur")
    ) {
      return `Bahut badhiya ${namePrefix}! CallForge se companies ki customer reach 10x tezi se badhti hai aur telecalling cost 70% kam ho jati hai. Kya main aapke company name ke sath ek trial portal create kar doon?`;
    }

    // 13. Dynamic contextual fallback addressing user's input directly
    return `Ji bilkul ${namePrefix}main aapki baat samajh gayi. "${text.slice(0, 40)}" ke baare me CallForge solution aapko complete flexibility deta hai. Kya aap chahenge ki hamare sales specialist aapse 5 minute me connect karein ya hum trial demo activate karein?`;
  }
}

export const audioEngine = new CallAudioEngine();
