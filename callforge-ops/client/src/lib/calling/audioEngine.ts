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

  // 5. Speak with AI Voice via Web Speech API (Strictly FEMALE persona voice with Language Lock)
  speakAgentMessage(text: string, languageOrOnEnd?: string | (() => void), onEnd?: () => void) {
    let language = "en-IN";
    let callback = onEnd;
    if (typeof languageOrOnEnd === "function") {
      callback = languageOrOnEnd;
    } else if (typeof languageOrOnEnd === "string") {
      language = languageOrOnEnd;
    }

    if (!("speechSynthesis" in window)) {
      if (callback) callback();
      return;
    }

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

  // 7. Speech Recognition for Two-Way Conversational Dialogue with Barge-In Support
  private recognition: any = null;

  isSpeechRecognitionSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  startSpeechRecognition(
    onResult: (transcript: string) => void,
    onError?: (err: any) => void,
    onEnd?: () => void,
    language: string = "hi-IN",
    onBargeIn?: () => void
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
      reco.interimResults = true;
      reco.lang = language || "hi-IN";

      reco.onstart = () => {
        // Recognition started
      };

      reco.onspeechstart = () => {
        // Customer started speaking! If AI is currently talking, trigger BARGE-IN!
        if (this.isSpeaking) {
          console.log("[AudioEngine] Barge-In detected! Customer interrupted AI.");
          this.stopSpeaking();
          if (onBargeIn) onBargeIn();
        }
      };

      reco.onresult = (event: any) => {
        // If barge-in happened
        if (this.isSpeaking) {
          this.stopSpeaking();
          if (onBargeIn) onBargeIn();
        }

        const isFinal = event.results[event.results.length - 1]?.isFinal;
        const transcript = event.results[event.results.length - 1]?.[0]?.transcript || "";
        if (isFinal && transcript.trim()) {
          onResult(transcript.trim());
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
  }> {
    try {
      const res = await fetch("/api/calling/runtime/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage,
          language: options?.language || "en-IN",
          dtmfDigit: options?.dtmfDigit,
          agentId: options?.agentId,
          customerName: options?.customerName,
          customerPhone: options?.customerPhone,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          replyText: data.replyText,
          toolsExecuted: data.toolsExecuted || [],
          intent: data.intent || "general",
          shouldEndCall: !!data.shouldEndCall,
          language: data.language || options?.language || "en-IN",
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
    const lang = (context?.language || "en-IN").toLowerCase();
    const isMarathi = lang.includes("mr");
    const isHindi = lang.includes("hi");
    const isEnglish = !isMarathi && !isHindi;
    const namePrefix = context?.leadName ? `${context.leadName} ji, ` : "";

    // 1. Activation Intent
    if (
      lower.includes("activate") ||
      lower.includes("activation") ||
      lower.includes("confirm") ||
      lower.includes("kar do") ||
      lower.includes("chalu kar do") ||
      lower.includes("shuru karo") ||
      lower.includes("le lo") ||
      lower.includes("agree") ||
      lower.includes("subscribe") ||
      lower.includes("yes activate") ||
      lower.includes("ॲक्टिव्हेट") ||
      lower.includes("सुरू करा") ||
      lower.includes("चालू करा") ||
      lower.includes("active kara")
    ) {
      if (isMarathi) {
        return `उत्तम ${namePrefix}! मी आपल्या स्विफ्टटेल ५G वार्षिक प्लॅनचे ॲक्टिव्हेशन सुरू केले आहे. कन्फर्मेशन मेसेज आपल्या नोंदणीकृत नंबरवर पाठवला आहे.`;
      } else if (isHindi) {
        return `Bahut badhiya ${namePrefix}! Maine aapka SwiftTel 5G annual upgrade activate karne ka process start kar diya hai. Confirmation details aapke registered number par bhej di gayi hain.`;
      }
      return `Excellent ${namePrefix}! I have confirmed and initiated the activation of your SwiftTel 5G annual upgrade. The activation confirmation has been sent to your registered mobile number.`;
    }

    // 2. Callback Intent
    const isCallback =
      lower.includes("call me") ||
      lower.includes("call back") ||
      lower.includes("callback") ||
      lower.includes("call karna") ||
      lower.includes("call karo") ||
      lower.includes("later") ||
      lower.includes("busy") ||
      lower.includes("meeting") ||
      lower.includes("driving") ||
      lower.includes("tomorrow") ||
      lower.includes("two days") ||
      lower.includes("2 days") ||
      lower.includes("3 days") ||
      lower.includes("three days") ||
      lower.includes("do din") ||
      lower.includes("teen din") ||
      lower.includes("kal") ||
      lower.includes("parso") ||
      lower.includes("फोन करा") ||
      lower.includes("कॉल करा") ||
      lower.includes("दोन दिवसांनी") ||
      lower.includes("तीन दिवसांनी") ||
      lower.includes("उद्या") ||
      lower.includes("व्यस्त") ||
      lower.includes("वेळ नाही") ||
      lower.includes("don divasani");

    if (isCallback) {
      let delayDays = 2;
      let timingStr = "in 2 days";
      if (lower.includes("3") || lower.includes("three") || lower.includes("teen") || lower.includes("तीन")) {
        delayDays = 3;
        timingStr = "in 3 days";
      } else if (lower.includes("kal") || lower.includes("tomorrow") || lower.includes("उद्या") || lower.includes("udya")) {
        delayDays = 1;
        timingStr = "tomorrow";
      }

      // Automatically dispatch background callback registration to API
      try {
        fetch("/api/calling/callbacks/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: context?.leadName || "Valued Customer",
            customerPhone: "+91 98201 55432",
            delayDays,
            preferredTime: timingStr,
            reason: `Customer requested callback on call: ${text}`,
          }),
        }).catch(() => {});
      } catch {}

      if (isMarathi) {
        return `नक्कीच ${namePrefix}! मी आपल्यासाठी ${delayDays === 1 ? "उद्यासाठी" : `${delayDays} दिवसांनी`} कॉलबॅक रिमाइंडर सेट केले आहे. आमची टीम आपल्याला संपर्क करेल. धन्यवाद, आपला दिवस शुभ जावो!`;
      } else if (isHindi) {
        return `Ji bilkul ${namePrefix}! Maine aapka callback reminder ${delayDays === 1 ? "kal" : `${delayDays} din baad`} ke liye note kar liya hai. Hamari team aapko connect karegi. Apna keemti samay dene ke liye shukriya!`;
      }
      return `Certainly ${namePrefix}! I have noted down your callback reminder for ${timingStr}. Our team will reach back out to you then. Thank you for your time, have a wonderful day!`;
    }

    // 3. Rejection / Negative / Not interested
    if (
      lower.includes("nahi chahiye") ||
      lower.includes("not interested") ||
      lower.includes("zarurat nahi") ||
      lower.includes("band karo") ||
      lower.includes("kato") ||
      lower.includes("bye") ||
      lower.includes("cut") ||
      lower.includes("नको") ||
      lower.includes("गरज नाही") ||
      lower.includes("कापा")
    ) {
      if (isMarathi) {
        return `समजले ${namePrefix}. आपला बहुमूल्य वेळ दिल्याबद्दल मनापासून धन्यवाद. आपला दिवस आनंदात जावो!`;
      } else if (isHindi) {
        return `Theek hai ${namePrefix}, koi baat nahi. Apna keemti samay dene ke liye shukriya, aapka din shubh rahe!`;
      }
      return `Understood ${namePrefix}. Thank you so much for your valuable time today. Have a wonderful day ahead!`;
    }

    // 4. Send Details via WhatsApp / SMS
    if (
      lower.includes("whatsapp") ||
      lower.includes("sms") ||
      lower.includes("details") ||
      lower.includes("send") ||
      lower.includes("bhejo") ||
      lower.includes("bhej do") ||
      lower.includes("माहिती पाठवा") ||
      lower.includes("pathva") ||
      lower.includes("तपशील")
    ) {
      const channel = lower.includes("sms") ? "SMS" : "WhatsApp";
      if (isMarathi) {
        return `मी स्विफ्टटेल ५G वार्षिक प्लॅनचे संपूर्ण तपशील आपल्या नंबरवर ${channel} द्वारे पाठवले आहेत. कृपया तपासा!`;
      } else if (isHindi) {
        return `Maine SwiftTel 5G plan ki poori details aapke number par ${channel} ke madhyam se bhej di hain. Please check kar lijiye!`;
      }
      return `I have sent the complete 5G annual plan details directly to your registered number via ${channel}. Please check your messages!`;
    }

    // 5. Pricing / Cost / Rates
    if (
      lower.includes("price") ||
      lower.includes("cost") ||
      lower.includes("rate") ||
      lower.includes("charges") ||
      lower.includes("how much") ||
      lower.includes("1999") ||
      lower.includes("kitna") ||
      lower.includes("kharcha") ||
      lower.includes("paisa") ||
      lower.includes("rupaye") ||
      lower.includes("किंमत") ||
      lower.includes("दर") ||
      lower.includes("खर्च") ||
      lower.includes("kimat") ||
      lower.includes("kitit")
    ) {
      if (isMarathi) {
        return `स्विफ्टटेल ५G वार्षिक प्लॅन ची किंमत पूर्ण ३६५ दिवसांसाठी फक्त ₹१,९९९ आहे ज्यामध्ये दररोज २.५ GB डेटा आणि अमर्यादित कॉलिंग मिळते.`;
      } else if (isHindi) {
        return `SwiftTel 5G annual plan ki keemat pooray 365 dino ke liye sirf ₹1,999 hai, jisme daily 2.5 GB high-speed 5G data aur unlimited calls shamil hain.`;
      }
      return `The SwiftTel 5G annual plan costs ₹1,999 for 365 days and includes 2.5 GB daily high-speed 5G data, unlimited calls, and OTT subscriptions.`;
    }

    // 6. Plan / 5G Benefits
    if (
      lower.includes("plan") ||
      lower.includes("5g") ||
      lower.includes("offer") ||
      lower.includes("data") ||
      lower.includes("benefit") ||
      lower.includes("speed") ||
      lower.includes("validity") ||
      lower.includes("माहिती") ||
      lower.includes("प्लॅन") ||
      lower.includes("ऑफर")
    ) {
      if (isMarathi) {
        return `आमचा वार्षिक प्लॅन दररोज २.५ GB ५G डेटा, अमर्यादित कॉलिंग आणि डिस्ने+ हॉटस्टार व सोनीलिव्हचे OTT फायदे ₹१,९९९ मध्ये देतो. आपण हा सुरू करू इच्छिता?`;
      } else if (isHindi) {
        return `Hamara annual plan aapko 2.5 GB daily 5G data, unlimited calls aur Disney+ Hotstar aur SonyLIV ke OTT benefits sirf ₹1,999 mein deta hai.`;
      }
      return `Our annual plan offers 2.5 GB of daily 5G data, truly unlimited voice calls, and OTT entertainment benefits like Disney+ Hotstar and SonyLIV for ₹1,999.`;
    }

    // 7. Identity / "Who are you" / "AI or Human"
    if (
      lower.includes("who are you") ||
      lower.includes("your name") ||
      lower.includes("robot") ||
      lower.includes("ai") ||
      lower.includes("human") ||
      lower.includes("kaun ho") ||
      lower.includes("naam kya") ||
      lower.includes("तुम्ही कोण") ||
      lower.includes("रोबोट") ||
      lower.includes("माणूस")
    ) {
      if (isMarathi) {
        return `मी सिमरन, स्विफ्टटेल ५G ची प्रगत AI व्हॉइस स्पेशलिस्ट आहे. आपला वेळ वाचवून त्वरित माहिती देण्यासाठी मी उपलब्ध आहे!`;
      } else if (isHindi) {
        return `Main Simran hoon, SwiftTel 5G ki smart AI voice specialist. Main aapko turant network updates aur plans mein help karne ke liye call kar rahi hoon.`;
      }
      return `I am Simran, an advanced AI Voice Specialist for SwiftTel 5G. I am here to assist you with quick plan upgrades and customer support!`;
    }

    // 8. Dental context (Priya)
    const isDentalContext =
      (context?.agentName && (context.agentName.includes("Priya") || context.agentName.includes("Dental") || context.agentName.includes("Aarogya"))) ||
      lower.includes("dental") ||
      lower.includes("aarogya") ||
      lower.includes("cleaning") ||
      lower.includes("root canal") ||
      lower.includes("teeth") ||
      lower.includes("sharma");

    if (isDentalContext) {
      if (lower.includes("cleaning") || lower.includes("root canal") || lower.includes("charges")) {
        if (isMarathi) {
          return `आरोग्य डेंटल केअरमध्ये दात स्वच्छ करण्याचे शुल्क ₹१,२०० आणि रूट कॅनॉल ₹३,५०० पासून सुरू होते.`;
        } else if (isHindi) {
          return `Aarogya Dental Care mein teeth cleaning ₹1,200 hai aur root canal treatment ₹3,500 se shuru hota hai.`;
        }
        return `At Aarogya Dental Care, teeth cleaning is ₹1,200 and root canal treatments start at ₹3,500 with Dr. Sharma.`;
      }
      if (lower.includes("appointment") || lower.includes("booking") || lower.includes("slot")) {
        if (isMarathi) {
          return `डॉ. शर्मा यांच्याकडे उद्या सकाळी १०:३० वाजता वेळ उपलब्ध आहे. मी आपली अपॉइंटमेंट बुक करू का?`;
        } else if (isHindi) {
          return `Dr. Sharma ke paas kal subah 10:30 AM ka slot uplabdh hai. Kya main aapka slot book kar doon?`;
        }
        return `Dr. Sharma has consultation slots available tomorrow at 10:30 AM. Shall I confirm your appointment?`;
      }
    }

    // 9. Banking context (Aarti)
    const isBankingContext =
      (context?.agentName && (context.agentName.includes("Aarti") || context.agentName.includes("Banking") || context.agentName.includes("Tata"))) ||
      lower.includes("loan") ||
      lower.includes("emi") ||
      lower.includes("balance");

    if (isBankingContext) {
      if (isMarathi) {
        return `आपली उर्वरित कर्ज शिल्लक ₹५०,००० आहे आणि पुढील ईएमआय तारीख ०५ ऑक्टोबर २०२६ आहे.`;
      } else if (isHindi) {
        return `Aapka bacha hua loan balance ₹50,000 hai aur agli EMI 05 October 2026 ko due hai.`;
      }
      return `Your outstanding loan balance is ₹50,000 and the upcoming EMI is scheduled for October 5th, 2026.`;
    }

    // 10. Greetings ("Hello", "Hi")
    if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey") || lower.includes("namaste") || lower.includes("नमस्कार")) {
      if (isMarathi) {
        return `नमस्कार ${namePrefix}! मी सिमरन बोलतेय स्विफ्टटेल ५G कडून. आमच्याकडे आपल्यासाठी एक विशेष ५G ऑफर आहे. मी आपल्याला माहिती देऊ का?`;
      } else if (isHindi) {
        return `Namaste ${namePrefix}! Main Simran baat kar rahi hoon SwiftTel 5G se. Hamare paas aapke liye ek shandar 5G annual offer hai. Kya main iski jankari de sakti hoon?`;
      }
      return `Hello ${namePrefix}! This is Simran from SwiftTel 5G. We have an exciting 5G annual plan upgrade for you today. Would you like to hear about it?`;
    }

    // 11. Out-of-Syllabus / Random / General Chit-Chat (Polite Boundary & Redirection)
    if (isMarathi) {
      return `मी समजू शकते ${namePrefix}, पण सध्या मी स्विफ्टटेल ५G स्पेशलिस्ट म्हणून आपल्या मोबाईल नेटवर्क व प्लॅन अपग्रेडसाठी बोलत आहे. मी आपल्याला या ५G प्लॅनची माहिती देऊ का?`;
    } else if (isHindi) {
      return `Main samajh sakti hoon ${namePrefix}, parantu abhi main SwiftTel 5G promotions team se judee hoon aur aapko 5G plan upgrade mein madad kar sakti hoon. Kya main aapko iske fayde bata sakti hoon?`;
    }
    return `I understand what you're asking ${namePrefix}, but as your SwiftTel 5G specialist today, I am dedicated to helping you with your mobile network and plan upgrade. Would you like me to share details about our high-speed 5G annual plan?`;
  }
}

export const audioEngine = new CallAudioEngine();
