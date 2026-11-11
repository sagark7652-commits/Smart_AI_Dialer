/**
 * Serverless AI Calling Runtime Handler for Vercel (/api/calling/runtime/*).
 * Mirrors CallForge Ops local runtime with strict language lock, female Marathi
 * Aarogya Dental Care training, Groq Qwen/Llama reasoning, and ElevenLabs voices.
 */

const PERSONAS = {
  agent_swifttel_5g: {
    id: "agent_swifttel_5g",
    name: "Simran - SwiftTel 5G Specialist",
    company: "SwiftTel 5G",
    roleTitle: "Promotions & Customer Relationship Executive",
    description: "Exciting 5G annual upgrade (₹1,999, 2.5GB/day, OTT bundle, WhatsApp/SMS fulfillment)",
    supportedLanguages: [
      { code: "en-IN", label: "English (Indian)" },
      { code: "hi-IN", label: "Hindi (हिंदी / Hinglish)" },
      { code: "mr-IN", label: "Marathi (मराठी)" },
    ],
    systemPrompt: `You are Simran, a warm, polite female AI telecaller from SwiftTel 5G.
Offer: ₹1,999 annual 5G plan (365 days, 2.5GB/day data, unlimited calls, Disney+ Hotstar & SonyLIV).
Rules:
1. Keep replies to 1-2 short natural spoken sentences.
2. NEVER repeat "Certainly! I am here to assist you" or re-introduce yourself mid-call.
3. STRICT LANGUAGE LOCK: Speak 100% in the selected language (en-IN, hi-IN, or mr-IN).
4. FEMALE GRAMMAR: Always use feminine verbs in Hindi/Marathi (मी बोलतेय, मी करू शकते, main kar sakti hoon).`,
  },
  agent_aarogya_dental: {
    id: "agent_aarogya_dental",
    name: "Priya - Aarogya Dental Care",
    company: "Aarogya Dental Care",
    roleTitle: "Front Desk Assistant & Clinic Coordinator",
    description: "Clinic appointments, Dr. Sharma consultation, cleaning & root canal pricing, clinic directions",
    supportedLanguages: [
      { code: "hi-IN", label: "Hindi (हिंदी / Hinglish)" },
      { code: "en-IN", label: "English (Indian)" },
      { code: "mr-IN", label: "Marathi (मराठी)" },
    ],
    systemPrompt: `You are Priya, a warm female AI Front Desk Assistant for Aarogya Dental Care & Implant Center, Office 204, Fortune Plaza, FC Road, Shivaji Nagar, Pune (near Goodluck Cafe, opposite Metro Pillar 42).
Clinic Facts:
- Doctor: Senior Dentist Dr. Sharma (BDS, MDS), 15+ years experience.
- Timings: Mon-Sat 9:00 AM - 8:30 PM; Sun 10:00 AM - 2:00 PM (emergency only).
- Fees: Consultation ₹400, Teeth Cleaning ₹1,200, Root Canal (RCT) ₹3,500+, Dental Implants ₹25,000+.
- Payments: UPI, Cards, Cash. Free 2W/4W parking & elevator access.
Rules:
1. FEMALE GRAMMAR (Marathi स्त्रीलिंगी): Use मी बोलतेय, मी मदत करू शकते, मी नोंद करते — NEVER बोलतो/करतो/शकतो.
2. STRICT ANTI-INTRODUCTION: The greeting was already spoken. NEVER greet again or say "Certainly! I am here to assist you".
3. STRICT LANGUAGE LOCK: Respond 100% in the caller's selected language with zero language mixing.
4. Keep responses concise (1-2 natural spoken sentences).`,
  },
  agent_tata_banking_01: {
    id: "agent_tata_banking_01",
    name: "Aarti - Tata Smartflo Banking Specialist",
    company: "Tata Smartflo Banking",
    roleTitle: "Senior Customer Care Specialist",
    description: "Loan balances, EMI schedule, payment links, human supervisor transfer",
    supportedLanguages: [
      { code: "hi-IN", label: "Hindi (हिंदी / Hinglish)" },
      { code: "en-IN", label: "English (Indian)" },
      { code: "mr-IN", label: "Marathi (मराठी)" },
    ],
    systemPrompt: `You are Aarti, a polite female AI Customer Care Specialist for Tata Smartflo Banking.
Rules:
1. Respond concisely in 1-2 natural spoken sentences.
2. STRICT LANGUAGE LOCK: Speak strictly in the chosen language (en-IN, hi-IN, or mr-IN).
3. NEVER repeat canned filler like "Certainly! I am here to assist you". Always answer directly with feminine grammar.`,
  },
};

function normalizeLang(language) {
  const l = String(language || "hi-IN").toLowerCase();
  if (l.startsWith("mr") || l.includes("marathi")) return "mr-IN";
  if (l.startsWith("en") || l.includes("english")) return "en-IN";
  return "hi-IN";
}

function getPersona(agentId) {
  if (agentId && PERSONAS[agentId]) return PERSONAS[agentId];
  const lower = String(agentId || "").toLowerCase();
  if (lower.includes("aarogya") || lower.includes("priya") || lower.includes("dental")) {
    return PERSONAS.agent_aarogya_dental;
  }
  if (lower.includes("banking") || lower.includes("aarti") || lower.includes("tata")) {
    return PERSONAS.agent_tata_banking_01;
  }
  return PERSONAS.agent_swifttel_5g;
}

function buildInitialGreeting(persona, lang, customerName, customGreeting) {
  if (customGreeting) return customGreeting;
  const custTitle = customerName ? `${customerName} ji` : "Sir";
  if (persona.id === "agent_aarogya_dental") {
    if (lang === "mr-IN") {
      return "नमस्कार! आरोग्य डेंटल केअरमध्ये आपले स्वागत आहे. मी प्रिया बोलतेय, क्लिनिक अपॉइंटमेंटबद्दल मी संपर्क केला आहे. मी आपली काय मदत करू शकते?";
    }
    if (lang === "en-IN") {
      return `Hello ${custTitle}, welcome to Aarogya Dental Care! I am Priya calling regarding your dental checkup and appointment. How may I help you today?`;
    }
    return `Namaste ${custTitle}! Welcome to Aarogya Dental Care. Main Priya bol rahi hoon, clinic appointment ke regarding. Batayiye, main aapki kya sahayata kar sakti hoon?`;
  }
  if (persona.id === "agent_swifttel_5g") {
    if (lang === "mr-IN") {
      return "नमस्कार! मी सिमरन बोलतेय स्विफ्टटेल ५G कडून. आमच्याकडे आपल्यासाठी एक विशेष ५G वार्षिक ऑफर आहे. आपण २ मिनिटे बोलू शकता का?";
    }
    if (lang === "hi-IN") {
      return "Hello Sir, Namaste! Main Simran baat kar rahi hoon SwiftTel 5G se. Hamare paas aapke liye ek exciting 5G plan update hai. Kya aapse 2 minute baat ho sakti hai?";
    }
    return "Hello! This is Simran from SwiftTel 5G. We have an exciting 5G plan update for you today. Do you have a minute?";
  }
  if (lang === "mr-IN") {
    return "नमस्कार! मी आरती बोलतेय टाटा स्मार्टफ्लो बँकिंग सेवेकडून. आपल्या खात्याच्या सेवेबद्दल मी संपर्क केला आहे. आपण २ मिनिटे बोलू शकता का?";
  }
  if (lang === "en-IN") {
    return `Hello ${custTitle}, this is Aarti calling from Tata Smartflo Banking regarding your account services. Do you have a couple of minutes?`;
  }
  return `Hello ${custTitle}, Namaste! Main Aarti baat kar rahi hoon Tata Smartflo Banking se. Kya abhi aapse 2 minute baat ho sakti hai?`;
}

function getElevenLabsVoiceId(lang) {
  if (lang === "mr-IN") return process.env.ELEVENLABS_VOICE_ID_MR || "dSEhEXLzhnZEytnJ2rRy";
  if (lang === "en-IN") return process.env.ELEVENLABS_VOICE_ID_EN || "ZUrEGyu8GFMwnHbvLhv2";
  return process.env.ELEVENLABS_VOICE_ID_HI || "RABOvaPec1ymXz02oDQi";
}

function cleanSpeechText(text, lang) {
  return String(text || "")
    .trim()
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/₹\s*([0-9,]+)/g, lang === "en-IN" ? "$1 rupees" : "$1 रुपये")
    .replace(/\s+/g, " ")
    .trim();
}

async function synthesizeElevenLabsDataUri(text, lang) {
  const apiKey = process.env.ELEVENLABS_API_KEY || "";
  const cleanText = cleanSpeechText(text, lang);
  if (!apiKey || !cleanText) return null;

  const voiceId = getElevenLabsVoiceId(lang);
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
      signal: AbortSignal.timeout(9000),
    });

    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 256) return null;
    return `data:audio/mpeg;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function generateLLMReply(persona, lang, history, userMessage) {
  const groqKey = process.env.GROQ_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const apiKey = groqKey || openaiKey;
  const endpoint = groqKey
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = groqKey
    ? process.env.GROQ_MODEL || "qwen/qwen3-32b"
    : process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (apiKey) {
    try {
      const langDirective =
        lang === "mr-IN"
          ? "Respond strictly in Marathi (मराठी) using female verbs."
          : lang === "en-IN"
          ? "Respond strictly in polished Indian English."
          : "Respond strictly in natural polite Hindi/Hinglish using female verbs.";

      const messages = [
        { role: "system", content: `${persona.systemPrompt}\n${langDirective}` },
        ...history.slice(-6),
        { role: "user", content: userMessage },
      ];

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 160,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content || "";
        const cleaned = cleanSpeechText(raw, lang);
        if (cleaned) return cleaned;
      }
    } catch {
      // Fall through to deterministic domain response below
    }
  }

  return buildDeterministicReply(persona, lang, userMessage);
}

function buildDeterministicReply(persona, lang, userMessage) {
  const q = String(userMessage || "").toLowerCase();
  if (persona.id === "agent_aarogya_dental") {
    if (q.includes("clean") || q.includes("स्वच्छ") || q.includes("सफाई") || q.includes("fee") || q.includes("price") || q.includes("खर्च") || q.includes("शुल्क")) {
      if (lang === "mr-IN") {
        return "आरोग्य डेंटल केअरमध्ये कन्सल्टेशन शुल्क ₹४०० आणि दात स्वच्छ करण्याचे शुल्क ₹१,२०० आहे, तर रूट कॅनॉल ₹३,५०० पासून सुरू होते. मी डॉ. शर्मा यांची अपॉइंटमेंट बुक करू का?";
      }
      if (lang === "en-IN") {
        return "At Aarogya Dental Care, Dr. Sharma's consultation fee is ₹400, teeth cleaning is ₹1,200, and painless root canal starts at ₹3,500. Would you like me to book an appointment?";
      }
      return "Aarogya Dental Care mein Dr. Sharma ki consultation ₹400, teeth cleaning ₹1,200 aur painless root canal ₹3,500 se shuru hota hai. Kya main aapki appointment book kar doon?";
    }
    if (lang === "mr-IN") {
      return "डॉ. शर्मा आज सकाळी १०:३०, दुपारी १२:०० आणि संध्याकाळी ६:०० वाजता उपलब्ध आहेत. मी यापैकी कोणती वेळ आपल्यासाठी निश्चित करू?";
    }
    if (lang === "en-IN") {
      return "Dr. Sharma has slots open today at 10:30 AM, 12:00 PM, and 6:00 PM at our FC Road, Shivaji Nagar clinic. Which time works best for you?";
    }
    return "Dr. Sharma ke paas aaj subah 10:30, dopahar 12:00 aur shaam 6:00 baje slots khali hain. Aap kaunsa time pasand karenge?";
  }

  if (lang === "mr-IN") {
    return "आपल्या प्रश्नाबद्दल धन्यवाद. मी आपल्याला याबाबत सर्व माहिती देऊ शकते—कृपया आपली आवश्यकता सांगा म्हणजे मी पुढील मदत करते.";
  }
  if (lang === "en-IN") {
    return "Thank you for sharing that. Could you let me know what specific detail or schedule you prefer so I can finalize it right away?";
  }
  return "Bilkul, main aapki ismein turant madad kar sakti hoon. Batayiye aapko kaunsi jankari ya slot chahiye?";
}

export async function handleRuntimeRoute(path, req, res, store, body) {
  if (!store.runtimeSessions) {
    store.runtimeSessions = new Map();
  }

  if (path === "runtime/personas") {
    const personas = Object.values(PERSONAS).map(({ systemPrompt, ...publicFields }) => publicFields);
    return res.status(200).json({ success: true, personas });
  }

  if (path === "runtime/config") {
    return res.status(200).json({
      success: true,
      llmProvider: process.env.GROQ_API_KEY ? "groq" : process.env.OPENAI_API_KEY ? "openai" : "deterministic",
      ttsProvider: process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "browser_neural",
      active: true,
    });
  }

  if (path === "runtime/rag/docs") {
    return res.status(200).json({
      success: true,
      docs: [
        { id: "doc-aarogya-mr", title: "Aarogya Dental Care Pune (Marathi & Pricing KB)", personaId: "agent_aarogya_dental" },
        { id: "doc-swifttel-5g", title: "SwiftTel ₹1,999 Annual 5G Plan", personaId: "agent_swifttel_5g" },
      ],
    });
  }

  if (path === "runtime/session/create" && req.method === "POST") {
    const persona = getPersona(body.agentId);
    const lang = normalizeLang(body.language || persona.supportedLanguages?.[0]?.code);
    const sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const callId = `call_${Math.random().toString(36).slice(2, 10)}`;
    const initialGreeting = buildInitialGreeting(persona, lang, body.customerName, body.customGreeting);

    store.runtimeSessions.set(sessionId, {
      sessionId,
      callId,
      agentId: persona.id,
      language: lang,
      customerName: body.customerName || "Rajesh Varma",
      customerPhone: body.customerPhone || "+91 98201 55432",
      messages: [{ role: "assistant", content: initialGreeting }],
      status: "in_conversation",
    });

    const initialGreetingAudioUrl = await synthesizeElevenLabsDataUri(initialGreeting, lang);
    return res.status(201).json({
      success: true,
      sessionId,
      callId,
      agent: { id: persona.id, name: persona.name, roleTitle: persona.roleTitle, language: lang },
      initialGreeting,
      initialGreetingAudioUrl,
      status: "in_conversation",
    });
  }

  if (path === "runtime/session/end" && req.method === "POST") {
    if (body.sessionId) store.runtimeSessions.delete(body.sessionId);
    store.cdrs.unshift({
      id: `cdr-${Date.now()}`,
      customerName: body.customerName || "Customer",
      customerPhone: body.customerPhone || "+91 98201 55432",
      agentName: body.agentName || "AI Calling Agent",
      campaign: "Live Interactive Conversational Call",
      duration: "01:00",
      durationSeconds: Number(body.durationSeconds) || 30,
      status: "Completed",
      disposition: "Completed",
      sentiment: "Positive",
      qaScore: 95,
      createdAt: new Date().toISOString(),
    });
    return res.status(200).json({ success: true, status: "ended", sessionId: body.sessionId });
  }

  if (path === "runtime/turn" && req.method === "POST") {
    const sessionId = body.sessionId || `sess_${Date.now().toString(36)}`;
    let session = store.runtimeSessions.get(sessionId);
    const persona = getPersona(body.agentId || session?.agentId);
    const lang = normalizeLang(body.language || session?.language);
    if (!session) {
      session = { sessionId, agentId: persona.id, language: lang, messages: [] };
      store.runtimeSessions.set(sessionId, session);
    }

    const effectiveMsg = String(body.userMessage || body.query || "").trim();
    const replyText = await generateLLMReply(persona, lang, session.messages, effectiveMsg);
    session.messages.push({ role: "user", content: effectiveMsg }, { role: "assistant", content: replyText });
    if (session.messages.length > 20) session.messages = session.messages.slice(-12);

    const audioUrl = await synthesizeElevenLabsDataUri(replyText, lang);
    return res.status(200).json({
      success: true,
      sessionId,
      userTranscript: effectiveMsg,
      replyText,
      toolsExecuted: [],
      ragSnippetsUsed: [],
      intent: "conversational_response",
      sessionStatus: "in_conversation",
      shouldEndCall: false,
      language: lang,
      audioUrl,
    });
  }

  if (path === "runtime/tts" && req.method === "POST") {
    const lang = normalizeLang(body.language);
    const audioUrl = await synthesizeElevenLabsDataUri(body.text || "", lang);
    return res.status(200).json({ success: Boolean(audioUrl), audioUrl });
  }

  return null;
}
