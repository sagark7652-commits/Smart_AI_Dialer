import { nanoid } from "nanoid";
import {
  AgentPersonaConfig,
  AgentSession,
  LLMMessage,
  LLMProvider,
  STTProvider,
  ToolDefinition,
  TTSProvider,
  VADProvider,
} from "./types";
import { SileroVADProvider } from "./vad/sileroVAD";
import { UnifiedAdaptiveSTTProvider } from "./stt/sttProviders";
import { UnifiedAdaptiveTTSProvider } from "./tts/ttsProviders";
import { LocalLLMProvider } from "./llm/llmProviders";
import { BUILTIN_BANKING_TOOLS } from "./tools/bankingTools";
import { BUILTIN_DENTAL_TOOLS } from "./tools/dentalTools";
import { BUILTIN_CALLBACK_TOOLS } from "./tools/callbackTools";
import { BUILTIN_TELECOM_TOOLS } from "./tools/telecomTools";
import { localKnowledgeBase } from "./rag/localKnowledgeBase";
import { agentMemoryManager } from "./memory/memoryManager";

export const SWIFTTEL_5G_PERSONA: AgentPersonaConfig = {
  id: "agent_swifttel_5g",
  name: "Simran - SwiftTel 5G Specialist",
  roleTitle: "Promotions & Customer Relationship Executive",
  language: "en-IN",
  voiceId: "a1e4199c-8c88-4608-8491-33da880e63b8",
  ttsProvider: "openai",
  sttProvider: "whisper_local",
  llmProvider: "openai_compatible",
  vadSensitivity: 0.65,
  bargeInEnabled: true,
  maxTurnDurationMs: 8000,
  systemPrompt: `You are Simran, a cheerful, natural, polite, and genuinely intelligent young female AI telecaller from SwiftTel 5G.
Objective: Offer the customer the new SwiftTel 5G annual upgrade (₹1,999 for 365 days, 2.5 GB daily high-speed 5G data, unlimited calls, OTT bundle: Disney+ Hotstar & SonyLIV).

Conversational Rules:
1. Speak naturally like a real human female telecaller having a live phone conversation.
2. Keep each response concise (1-2 sentences max). NEVER output long monologues.
3. STRICT LANGUAGE LOCK:
   - When speaking English: Speak ONLY in polished, warm English. NEVER mix Hindi words (do not say "Ji bilkul", "karenge", etc.) or Marathi words.
   - When speaking Hindi: Speak in polite, conversational Hindi/Hinglish (आप register).
   - When speaking Marathi: Speak in authentic, fluent Marathi (मराठी).
4. Listen and respond dynamically to what the customer actually says:
   - If they ask price: Annual plan is ₹1,999 for 365 days.
   - If they ask data/benefits: 2.5 GB daily 5G data, unlimited calls, OTT bundle.
   - If they ask to send details: Ask WhatsApp or SMS, then invoke send_plan_details.
   - If they want to activate / agree: Immediately invoke confirm_plan_activation tool.
   - If they ask to call back (e.g. in 2 days, tomorrow, busy): Invoke schedule_callback tool in the caller's language.
   - If they ask off-topic or out-of-syllabus questions: Gently and politely acknowledge in the caller's language and steer back to SwiftTel 5G.
   - If not interested: Be polite, thank them for their time, and close gracefully.`,
};

export const PRIYA_AAROGYA_PERSONA: AgentPersonaConfig = {
  id: "agent_aarogya_dental",
  name: "Priya - Aarogya Dental Care",
  roleTitle: "Front Desk Assistant & Clinic Coordinator",
  language: "hi-IN",
  voiceId: "hi_in_priya",
  ttsProvider: "openai",
  sttProvider: "whisper_local",
  llmProvider: "openai_compatible",
  vadSensitivity: 0.65,
  bargeInEnabled: true,
  maxTurnDurationMs: 8000,
  systemPrompt: `You are Priya, a warm, polite, and helpful female AI Front Desk Assistant for Aarogya Dental Care & Implant Center in Shivaji Nagar, Pune.

STRICT GENDER MANDATE (FEMALE):
- You are strictly FEMALE (स्त्रीलिंगी).
- When speaking Marathi, you MUST ALWAYS use female grammatical verb forms:
  * Use 'मी बोलतेय' or 'मी बोलते' (NEVER use 'बोलतो').
  * Use 'मी मदत करू शकते' (NEVER use 'करू शकतो').
  * Use 'मी सांगू शकते' (NEVER use 'सांगू शकतो').
  * Use 'मी नोंदवून घेते' or 'मी नोंद करते' (NEVER use 'नोंदवून घेतो').
  * Use 'मी विचारते' (NEVER use 'विचारतो').
  * Use 'मी समजू शकते' (NEVER use 'समजू शकतो').
  NEVER use masculine verb inflections (बोलतो, करतो, सांगतो, शकतो).

STRICT ANTI-INTRODUCTION RULE:
- The phone call has ALREADY started and the initial greeting has already been delivered.
- You must NEVER introduce yourself again (do NOT say "Namaste", "Hello", "नमस्कार", "मी प्रिया", "Main Priya", "Aarogya Dental Care mein swagat" or introduce your clinic).
- Answer the customer's question directly, clearly, and concisely in 1-2 spoken sentences!

Rules:
1. STRICT LANGUAGE LOCK: Speak strictly in the caller's chosen language (English, Hindi, or Marathi). Do not mix languages.
2. Keep each response concise (1-2 short sentences) suitable for a real telephone call.
3. Help patients with consultation timings, booking appointments with Dr. Sharma, services (root canals ₹3,500, cleaning ₹1,200, implants), and clinic directions near Goodluck Cafe.
4. Use the check_availability and book_appointment tools whenever the caller asks for appointment slots or requests a booking.
5. If the customer requests to call back in 2-3 days or tomorrow, use schedule_callback tool.`,
};

export const DEFAULT_AGENT_PERSONA: AgentPersonaConfig = PRIYA_AAROGYA_PERSONA;

export const TATA_BANKING_PERSONA: AgentPersonaConfig = {
  id: "agent_tata_banking_01",
  name: "Aarti - Tata Smartflo Banking Specialist",
  roleTitle: "Senior Customer Care Specialist",
  language: "hi-IN",
  voiceId: "hi_in_aditi",
  ttsProvider: "kokoro_piper",
  sttProvider: "whisper_local",
  llmProvider: "local_llm",
  vadSensitivity: 0.65,
  bargeInEnabled: true,
  maxTurnDurationMs: 8000,
  systemPrompt: `You are Aarti, an empathetic, polite, and efficient female AI voice assistant calling on behalf of Tata Smartflo / CallForge Banking Services.
Statutory Compliance Rule: Disclose that you are an automated assistant on a recorded line when greeted.
STRICT LANGUAGE LOCK: Speak strictly in the caller's language (English, Hindi, or Marathi) without mixing languages.
Speak in concise, conversational sentences (1-2 sentences per turn).
Use the available tools whenever the customer inquires about loan balances, EMI dates, payment links, callbacks, or human transfers.`,
};

export const AVAILABLE_PERSONAS: Record<string, AgentPersonaConfig> = {
  [SWIFTTEL_5G_PERSONA.id]: SWIFTTEL_5G_PERSONA,
  [PRIYA_AAROGYA_PERSONA.id]: PRIYA_AAROGYA_PERSONA,
  [DEFAULT_AGENT_PERSONA.id]: DEFAULT_AGENT_PERSONA,
  "swifttel": SWIFTTEL_5G_PERSONA,
  "simran": SWIFTTEL_5G_PERSONA,
  "priya": PRIYA_AAROGYA_PERSONA,
  "aarogya": PRIYA_AAROGYA_PERSONA,
  "aarti": DEFAULT_AGENT_PERSONA,
  "banking": DEFAULT_AGENT_PERSONA,
};

export class AgentRuntime {
  private sessions: Map<string, AgentSession> = new Map();
  private vad: VADProvider;
  private stt: STTProvider;
  private llm: LLMProvider;
  private tts: TTSProvider;
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(customProviders?: {
    vad?: VADProvider;
    stt?: STTProvider;
    llm?: LLMProvider;
    tts?: TTSProvider;
  }) {
    this.vad = customProviders?.vad || new SileroVADProvider();
    this.stt = customProviders?.stt || new UnifiedAdaptiveSTTProvider();
    this.llm = customProviders?.llm || new LocalLLMProvider();
    this.tts = customProviders?.tts || new UnifiedAdaptiveTTSProvider();

    // Register banking tools
    for (const tool of BUILTIN_BANKING_TOOLS) {
      this.tools.set(tool.name, tool);
    }
    // Register dental clinic tools
    for (const tool of BUILTIN_DENTAL_TOOLS) {
      this.tools.set(tool.name, tool);
    }
    // Register automated callback reminder tools
    for (const tool of BUILTIN_CALLBACK_TOOLS) {
      this.tools.set(tool.name, tool);
    }
    // Register telecom tools
    for (const tool of BUILTIN_TELECOM_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  createSession(options: {
    callId?: string;
    customerPhone: string;
    customerName?: string;
    companyName?: string;
    agentName?: string;
    callObjective?: string;
    language?: "en-IN" | "hi-IN" | "mr-IN" | string;
    isCallbackFollowup?: boolean;
    carrier?: "tata_smartflo" | "twilio" | "exotel" | "mock";
    persona?: Partial<AgentPersonaConfig>;
    customGreeting?: string;
  }): AgentSession {
    const sessionId = `sess_${nanoid(12)}`;
    const callId = options.callId || `call_${nanoid(10)}`;
    const persona: AgentPersonaConfig = {
      ...DEFAULT_AGENT_PERSONA,
      ...options.persona,
    };
    if (options.language) {
      persona.language = options.language as any;
    }

    const company = options.companyName || (persona.id === "agent_swifttel_5g" ? "SwiftTel 5G" : persona.id === "agent_aarogya_dental" ? "Aarogya Dental Care" : "CallForge Operations");
    const agent = options.agentName || persona.name.split(" ")[0] || "Priya";
    const custTitle = options.customerName ? `${options.customerName} ji` : "Sir";
    const objective = options.callObjective || (persona.id === "agent_swifttel_5g" ? "exciting 5G plan update" : "dental consultation & appointment");
    const lang = options.language || persona.language || "hi-IN";

    let initialGreeting = options.customGreeting;
    if (!initialGreeting) {
      if (options.isCallbackFollowup) {
        if (lang === "mr-IN") {
          initialGreeting = `नमस्कार! मी ${agent} बोलतेय ${company} कडून. आपण कॉलबॅकची विनंती केली होती, म्हणून मी संपर्क केला आहे. आपण २ मिनिटे बोलू शकता का?`;
        } else if (lang === "en-IN") {
          initialGreeting = `Hello ${custTitle}! This is ${agent} calling back from ${company} as requested earlier. Do you have 2 minutes to talk now?`;
        } else {
          initialGreeting = `Hello ${custTitle}, Namaste! Main ${agent} baat kar rahi hoon ${company} se. Aapne pehle callback request kiya tha, isliye maine aapko connect kiya hai. Kya abhi aapse 2 minute baat ho sakti hai?`;
        }
      } else if (persona.id === "agent_swifttel_5g") {
        if (lang === "mr-IN") {
          initialGreeting = `नमस्कार! मी सिमरन बोलतेय स्विफ्टटेल ५G कडून. आमच्याकडे आपल्यासाठी एक विशेष ५G वार्षिक ऑफर आहे. आपण २ मिनिटे बोलू शकता का?`;
        } else if (lang === "hi-IN") {
          initialGreeting = `Hello Sir, Namaste! Main Simran baat kar rahi hoon SwiftTel 5G se. Hamare paas aapke liye ek exciting 5G plan update hai. Kya aapse 2 minute baat ho sakti hai?`;
        } else {
          initialGreeting = `Hello! This is Simran from SwiftTel 5G. We have an exciting 5G plan update for you today. Do you have a minute?`;
        }
      } else if (persona.id === "agent_aarogya_dental") {
        if (lang === "mr-IN") {
          initialGreeting = `नमस्कार! आरोग्य डेंटल केअरमध्ये आपले स्वागत आहे. मी प्रिया बोलतेय, क्लिनिक अपॉइंटमेंटबद्दल मी संपर्क केला आहे. मी आपली काय मदत करू शकते?`;
        } else if (lang === "en-IN") {
          initialGreeting = `Hello ${custTitle}, welcome to Aarogya Dental Care! I am Priya calling regarding your dental checkup and appointment. How may I assist you today?`;
        } else {
          initialGreeting = `Namaste ${custTitle}! Welcome to Aarogya Dental Care. Main Priya bol rahi hoon, clinic appointment ke regarding. Batayiye, main aapki kya sahayata kar sakti hoon?`;
        }
      } else {
        if (lang === "mr-IN") {
          initialGreeting = `नमस्कार! मी ${agent} बोलतेय टाटा स्मार्टफ्लो बँकिंग सेवेकडून. आपल्या खात्याच्या सेवेबद्दल मी संपर्क केला आहे. आपण २ मिनिटे बोलू शकता का?`;
        } else if (lang === "en-IN") {
          initialGreeting = `Hello ${custTitle}, this is ${agent} calling from ${company} regarding your account services. Do you have a couple of minutes?`;
        } else {
          initialGreeting = `Hello ${custTitle}, Namaste! Main ${agent} baat kar rahi hoon ${company} se, ${objective} ke regarding maine connect kiya tha. Kya abhi aapse 2 minute baat karne ka sahi samay hai?`;
        }
      }
    }

    const session: AgentSession = {
      sessionId,
      callId,
      carrier: options.carrier || "tata_smartflo",
      customerPhone: options.customerPhone,
      agentConfig: persona,
      startedAt: Date.now(),
      status: "in_conversation",
      memory: agentMemoryManager.initMemory(options.customerPhone, options.customerName),
      messages: [
        {
          role: "system",
          content: `${persona.systemPrompt}\nCompany: ${company}\nAgent Name: ${agent}\nCustomer Name: ${options.customerName || "Customer"}\nCustomer Phone: ${options.customerPhone}\nCall Objective: ${objective}\nInstructions: If the customer asks to call back in 2-3 days, tomorrow, or later, use the schedule_callback tool to set a reminder and politely acknowledge.`,
        },
        {
          role: "assistant",
          content: initialGreeting,
        },
      ],
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  endSession(sessionId: string, reason: string = "normal_hangup"): AgentSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = "completed";
      session.endedAt = Date.now();
      session.terminationReason = reason;
    }
    return session;
  }

  /**
   * Complete Voice AI Turn:
   * Audio Chunk -> VAD -> STT -> RAG Search -> Memory -> LLM + Tools -> TTS -> Output Audio Buffer
   */
  async processAudioTurn(
    sessionId: string,
    rawAudioBuffer: Buffer
  ): Promise<{
    userTranscript: string;
    aiResponseText: string;
    audioOutput: Buffer;
    format: "wav" | "pcm" | "mulaw";
    toolsExecuted: Array<{ name: string; result: any }>;
    ragSnippetsUsed: string[];
    isBargeIn: boolean;
    sessionStatus: AgentSession["status"];
    latencyBreakdown: { vadMs: number; sttMs: number; llmMs: number; ttsMs: number; totalMs: number };
  }> {
    const session = this.sessions.get(sessionId) || this.createSession({ customerPhone: "+91 98201 12345" });
    const startAll = Date.now();

    // 1. VAD & Barge-in detection
    const t0 = Date.now();
    const vadEvent = await this.vad.processAudioChunk(rawAudioBuffer);
    const vadMs = Date.now() - t0;

    // 2. Speech-to-Text (STT)
    const t1 = Date.now();
    const sttResult = await this.stt.transcribe(rawAudioBuffer, { language: session.agentConfig.language });
    const sttMs = Date.now() - t1;
    const userText = sttResult.text || "Namaste, mujhe loan balance check karna hai.";

    session.messages.push({ role: "user", content: userText });

    // 3. Local RAG Retrieval
    const ragMatches = localKnowledgeBase.search(userText, 2, session.agentConfig.id);
    const ragSnippets = ragMatches.map((m) => `[Policy Knowledge: ${m.doc.title}] ${m.doc.content}`);

    let contextualSystemPrompt = `${session.agentConfig.systemPrompt}\nCustomer: ${session.memory.customerName} (${session.customerPhone})`;
    if (ragSnippets.length > 0) {
      contextualSystemPrompt += `\nRelevant Banking Guidelines:\n${ragSnippets.join("\n")}`;
    }

    const messagesToSend: LLMMessage[] = [
      { role: "system", content: contextualSystemPrompt },
      ...session.messages.slice(-8), // Keep recent conversational context
    ];

    // 4. LLM Generation + Tool Calling
    const t2 = Date.now();
    const availableToolsList = Array.from(this.tools.values());
    const llmRes = await this.llm.generate({
      messages: messagesToSend,
      tools: availableToolsList,
      temperature: 0.2,
      maxTokens: 100,
    });
    const llmMs = Date.now() - t2;

    const toolsExecuted: Array<{ name: string; result: any }> = [];
    let finalAssistantReply = llmRes.text;

    // Handle tool execution loop
    if (llmRes.toolCalls && llmRes.toolCalls.length > 0) {
      for (const tc of llmRes.toolCalls) {
        const toolDef = this.tools.get(tc.name);
        if (toolDef) {
          const outcome = await toolDef.execute(tc.arguments, session);
          toolsExecuted.push({ name: tc.name, result: outcome });

          if (!finalAssistantReply || finalAssistantReply.trim().length === 0) {
            if (tc.name === "fetch_loan_account_balance") {
              finalAssistantReply = `Your current loan balance is ₹${outcome.balanceInr?.toLocaleString("en-IN") || "50,000"}.`;
            } else if (tc.name === "fetch_emi_schedule") {
              finalAssistantReply = `Your upcoming EMI of ₹${outcome.emiAmountInr?.toLocaleString("en-IN") || "4,850"} is scheduled for ${outcome.nextDueDate || "05-Oct-2026"}.`;
            } else if (tc.name === "transfer_to_human_agent") {
              finalAssistantReply = "I am transferring you to a senior specialist now. Please stay connected.";
            } else if (tc.name === "hangup_call") {
              finalAssistantReply = "Thank you for contacting CallForge. Have a great day ahead. Namaste.";
            }
          }
        }
      }
    }

    if (!finalAssistantReply) {
      finalAssistantReply = "Ji bilkul, main CallForge AI assistant aapki poori madad ke liye yahan hoon.";
    }

    session.messages.push({ role: "assistant", content: finalAssistantReply });

    // Update Memory
    agentMemoryManager.updateFromTurn(session, userText, finalAssistantReply);

    // 5. Text-to-Speech (TTS)
    const t3 = Date.now();
    const ttsResult = await this.tts.synthesize(finalAssistantReply, {
      voice: session.agentConfig.voiceId,
      language: session.agentConfig.language,
    });
    const ttsMs = Date.now() - t3;

    // Graceful recovery: If TTS fails after retries, escalate to human supervisor rather than streaming corrupted/synthetic noise
    if (ttsResult.success === false && ttsResult.audioBuffer.length === 0) {
      console.warn(`[AgentRuntime] Speech synthesis unavailable for session ${session.sessionId}. Initiating graceful transfer to specialist.`);
      session.status = "transfer_pending";
      session.transferTarget = "support";
    }

    const totalMs = Date.now() - startAll;

    return {
      userTranscript: userText,
      aiResponseText: finalAssistantReply,
      audioOutput: ttsResult.audioBuffer,
      format: ttsResult.format,
      toolsExecuted,
      ragSnippetsUsed: ragSnippets,
      isBargeIn: vadEvent.isBargeIn || false,
      sessionStatus: session.status,
      latencyBreakdown: { vadMs, sttMs, llmMs, ttsMs, totalMs },
    };
  }

  /**
   * Process a text or speech-transcribed turn dynamically using the LLM & Tools:
   * Handles multi-turn memory, RAG retrieval, intent classification, DTMF digits, and tool calling.
   */
  async processTextTurn(
    sessionId: string,
    userText: string,
    options?: {
      language?: string;
      dtmfDigit?: string;
      customerPhone?: string;
      customerName?: string;
      agentId?: string;
    }
  ): Promise<{
    userTranscript: string;
    aiResponseText: string;
    toolsExecuted: Array<{ name: string; result: any }>;
    ragSnippetsUsed: string[];
    intent: string;
    sessionStatus: AgentSession["status"];
    shouldEndCall: boolean;
    language: string;
  }> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      const persona = (options?.agentId && AVAILABLE_PERSONAS[options.agentId]) ? AVAILABLE_PERSONAS[options.agentId] : PRIYA_AAROGYA_PERSONA;
      session = this.createSession({
        customerPhone: options?.customerPhone || "+91 98201 55432",
        customerName: options?.customerName || "Customer",
        language: options?.language || "hi-IN",
        persona,
      });
      // Update session map with the requested sessionId if passed
      this.sessions.set(sessionId, session);
    }

    if (options?.language) {
      session.agentConfig.language = options.language as any;
    }

    const currentLang = session.agentConfig.language || "hi-IN";
    let effectiveUserText = userText ? userText.trim() : "";
    const toolsExecuted: Array<{ name: string; result: any }> = [];
    let intent = "general_conversation";
    let shouldEndCall = false;

    // Handle DTMF Keypad Actions
    if (options?.dtmfDigit) {
      const digit = options.dtmfDigit.trim();
      if (digit === "1") {
        effectiveUserText = "[DTMF 1 Pressed: Customer confirmed offer/booking]";
        intent = "dtmf_confirmed";
        if (session.agentConfig.id === "agent_swifttel_5g") {
          const activateTool = this.tools.get("confirm_plan_activation");
          if (activateTool) {
            const outcome = await activateTool.execute({ customerPhone: session.customerPhone, customerName: session.memory.customerName }, session);
            toolsExecuted.push({ name: "confirm_plan_activation", result: outcome });
          }
        }
      } else if (digit === "2") {
        effectiveUserText = "[DTMF 2 Pressed: Customer requested callback in 2 days]";
        intent = "dtmf_callback";
        const cbTool = this.tools.get("schedule_callback");
        if (cbTool) {
          const outcome = await cbTool.execute({ delayDays: 2, preferredTime: "2 din baad", customerPhone: session.customerPhone, customerName: session.memory.customerName }, session);
          toolsExecuted.push({ name: "schedule_callback", result: outcome });
        }
      } else if (digit === "9") {
        effectiveUserText = "[DTMF 9 Pressed: Customer requested transfer to human agent]";
        intent = "dtmf_transfer";
        session.status = "transfer_pending";
        session.transferTarget = "senior_specialist";
      }
    }

    // Record user message into multi-turn memory
    session.messages.push({ role: "user", content: effectiveUserText });

    // Local RAG Knowledge Retrieval
    const ragMatches = localKnowledgeBase.search(effectiveUserText, 3, session.agentConfig.id);
    const ragSnippets = ragMatches.map((m) => `[Knowledge: ${m.doc.title}] ${m.doc.content}`);

    // Strict Language & Gender Enforcement
    let langInstruction = "CRITICAL LANGUAGE RULE: Speak strictly in conversational Hindi (Hinglish). Do NOT use Marathi words.";
    if (currentLang === "mr-IN") {
      langInstruction = `CRITICAL MARATHI LANGUAGE & FEMALE GENDER RULES:
- Speak 100% strictly in polite, authentic Marathi (शुद्ध व नम्र मराठी). Do NOT mix Hindi or English sentences.
- GENDER MANDATE (FEMALE): You are Priya, a young FEMALE assistant. All first-person verbs and self-references MUST be feminine:
  * Say 'मी बोलतेय' or 'मी बोलते' (NEVER say 'बोलतो').
  * Say 'मी मदत करू शकते' (NEVER say 'करू शकतो').
  * Say 'मी सांगू शकते' (NEVER say 'सांगू शकतो').
  * Say 'मी नोंदवून घेते' or 'मी नोंद करते' (NEVER say 'नोंदवून घेतो').
  * Say 'मी विचारते' (NEVER say 'विचारतो').
  * Say 'मी समजते' (NEVER say 'समजतो').
  NEVER use male inflections (बोलतो, करतो, सांगतो, शकतो).
- STRICT NO-INTRODUCTION RULE: The phone call is already ongoing. The greeting is already finished. DO NOT say "नमस्कार", "मी प्रिया", "आरोग्य डेंटल केअरमध्ये आपले स्वागत आहे" or introduce yourself again. Directly answer the user's question in 1-2 short spoken sentences!`;
    } else if (currentLang === "en-IN") {
      langInstruction = "CRITICAL LANGUAGE RULE: Speak 100% strictly in professional, natural Indian English. NEVER utter Hindi words (do NOT say 'Ji bilkul', 'Haan', 'shukriya', 'karegi', etc.) or Marathi words.";
    }

    const contextualSystemPrompt = `${session.agentConfig.systemPrompt}
${langInstruction}
Customer: ${session.memory.customerName || "Customer"} (${session.customerPhone})
${ragSnippets.length > 0 ? `Relevant Product & Knowledge Context:\n${ragSnippets.join("\n")}` : ""}
Rules:
- DYNAMIC AI REASONING: You are an intelligent voice AI assistant with full cognitive freedom. Reason about and answer any question dynamically, intelligently, and contextually in 1-2 natural spoken sentences. Do NOT be limited to fixed scripts.
- ANTI-REPETITION: Strictly do NOT repeat the same sentences, phrases, or greetings you said previously. Advance the dialogue naturally.
- STRICT LANGUAGE LOCK: Answer ONLY in the designated language (${currentLang}).
- STRICT NO-INTRODUCTION RULE: Do NOT say "Namaste", "Hello", "नमस्कार", "मी प्रिया", "Main Priya", or give an introduction in ongoing turns. Answer the question directly.
- Answer the customer's direct question first, then offer relevant next steps.
${session.agentConfig.id === "agent_aarogya_dental"
  ? "- PERSONA LOCK: You are Priya from Aarogya Dental Care ONLY. NEVER mention telecom, SIM, 5G, recharge, or banking.\n- If customer inquires about appointment or slots, use check_availability or book_appointment tool.\n- If customer mentions fees, doctor timings, cleaning, or root canal, explain clinic dental services clearly."
  : session.agentConfig.id === "agent_swifttel_5g"
  ? "- PERSONA LOCK: You are Simran from SwiftTel 5G.\n- If customer wants to activate or confirms agreement, invoke confirm_plan_activation tool.\n- If customer requests details via WhatsApp or SMS, use send_plan_details tool."
  : "- PERSONA LOCK: You are Aarti from Tata Smartflo Banking.\n- If customer inquires about balance or EMI, use fetch_loan_account_balance or send_payment_link."}
- If customer says "call after 2 days", "busy", "tomorrow", use schedule_callback tool.
- OUT-OF-SYLLABUS & OFF-TOPIC QUESTIONS: You have full general AI intelligence. Answer any out-of-syllabus, general knowledge, or casual question smartly, warmly, and concisely in 1 sentence using your general knowledge, and then gracefully bring the conversation back to how you can help them at the clinic.
- If customer says "no / not interested / bye", politely close and finish.`;

    const messagesToSend: LLMMessage[] = [
      { role: "system", content: contextualSystemPrompt },
      ...session.messages.slice(-5), // Keep recent conversational context while saving tokens
    ];

    // LLM Reasoning & Tool Calling: Strictly expose only tools belonging to this persona!
    const isDental = session.agentConfig.id === "agent_aarogya_dental";
    const isTelecom = session.agentConfig.id === "agent_swifttel_5g";
    const isBanking = session.agentConfig.id === "agent_tata_banking_01";

    const availableToolsList = Array.from(this.tools.values()).filter((t) => {
      if (t.name === "schedule_callback") return true;
      if (isDental) return t.name === "check_availability" || t.name === "book_appointment";
      if (isTelecom) return t.name === "confirm_plan_activation" || t.name === "send_plan_details";
      if (isBanking) return t.name === "fetch_loan_account_balance" || t.name === "send_payment_link";
      return true;
    });
    const llmRes = await this.llm.generate({
      messages: messagesToSend,
      tools: availableToolsList,
      temperature: 0.3,
      maxTokens: 150,
      language: currentLang,
    });

    let finalAssistantReply = llmRes.text ? llmRes.text.trim() : "";
    if ((llmRes as any).intent && !options?.dtmfDigit) {
      intent = (llmRes as any).intent;
    }

    // Execute Tool Calls if requested by the LLM
    if (llmRes.toolCalls && llmRes.toolCalls.length > 0) {
      for (const tc of llmRes.toolCalls) {
        const toolDef = this.tools.get(tc.name);
        if (toolDef) {
          const outcome = await toolDef.execute(tc.arguments, session);
          toolsExecuted.push({ name: tc.name, result: outcome });

          if (tc.name === "schedule_callback") {
            if (!options?.dtmfDigit) {
              intent = "callback_scheduled";
            }
            if (!finalAssistantReply) {
              finalAssistantReply = currentLang === "mr-IN"
                ? `नक्कीच! मी तुमची कॉलबॅकची वेळ नोंदवून घेतली आहे. आमची टीम तुम्हाला संपर्क करेल. धन्यवाद!`
                : currentLang === "en-IN"
                ? `Certainly! I have scheduled a callback as requested. Our team will reach out to you then. Have a wonderful day!`
                : `Ji bilkul! Maine aapka callback reminder note kar liya hai. Hamari team aapko connect karegi. Shukriya!`;
            }
          } else if (tc.name === "send_plan_details") {
            intent = "plan_details_sent";
            if (!finalAssistantReply) {
              finalAssistantReply = currentLang === "mr-IN"
                ? `मी प्लॅनचे सर्व तपशील तुमच्या WhatsApp वर पाठवले आहेत. कृपया तपासा.`
                : currentLang === "en-IN"
                ? `I have sent the complete 5G plan details to your registered number. Please check your messages!`
                : `Maine 5G plan ki poori details aapke number par bhej di hain. Please check kar lijiye!`;
            }
          } else if (tc.name === "book_appointment") {
            intent = "appointment_confirmed";
            if (!finalAssistantReply) {
              finalAssistantReply = currentLang === "mr-IN"
                ? `तुमची अपॉइंटमेंट यशस्वीरित्या बुक झाली आहे. लवकरच भेटूया!`
                : currentLang === "en-IN"
                ? `Your appointment with Dr. Sharma has been successfully confirmed. We look forward to seeing you!`
                : `Aapki appointment Dr. Sharma ke saath confirm ho gayi hai. Thank you!`;
            }
          } else if (tc.name === "confirm_plan_activation") {
            intent = "plan_activated";
            if (!finalAssistantReply) {
              finalAssistantReply = currentLang === "mr-IN"
                ? `उत्तम! आपला स्विफ्टटेल ५G वार्षिक प्लॅन ॲक्टिव्हेट केला आहे. सर्व माहिती आपल्या मोबाईलवर पाठवली आहे.`
                : currentLang === "hi-IN"
                ? `Bahut badhiya! Aapka SwiftTel 5G annual upgrade activate kar diya gaya hai. Confirmation bhej diya gaya hai.`
                : `Your SwiftTel 5G annual upgrade has been confirmed! Activation details have been sent to your registered mobile number.`;
            }
          }
        }
      }
    }

    // Default fallback if LLM returned empty text
    if (!finalAssistantReply) {
      if (currentLang === "mr-IN") {
        finalAssistantReply = "होय, मी तुम्हाला पूर्ण मदत करण्यासाठी येथे आहे. आपण काय जाणून घेऊ इच्छिता?";
      } else if (currentLang === "en-IN") {
        finalAssistantReply = "Certainly, I am here to assist you. Could you please let me know what you would like to know?";
      } else {
        finalAssistantReply = "Ji bilkul, main aapki poori madad ke liye yahan hoon. Aap kya jaanna chahenge?";
      }
    }

    // Intent & Termination Detection
    const lowerUser = effectiveUserText.toLowerCase();
    if (
      lowerUser.includes("bye") ||
      lowerUser.includes("alvida") ||
      lowerUser.includes("nahi chahiye") ||
      lowerUser.includes("not interested") ||
      lowerUser.includes("kato") ||
      lowerUser.includes("rakh raha hoon")
    ) {
      shouldEndCall = true;
      intent = "call_terminated";
    }

    // Save Assistant reply into conversational session history
    session.messages.push({ role: "assistant", content: finalAssistantReply });

    // Update session memory
    agentMemoryManager.updateFromTurn(session, effectiveUserText, finalAssistantReply);

    return {
      userTranscript: effectiveUserText,
      aiResponseText: finalAssistantReply,
      toolsExecuted,
      ragSnippetsUsed: ragSnippets,
      intent,
      agentId: session.agentConfig.id,
      sessionStatus: session.status,
      shouldEndCall,
      language: currentLang,
    };
  }
}

export const agentRuntime = new AgentRuntime();
