import { LLMCompletionOptions, LLMCompletionResult, LLMMessage, LLMProvider, ToolDefinition } from "../types";

export class LocalLLMProvider implements LLMProvider {
  name = "local_llm";
  private endpoint: string;
  private model: string;
  private apiKey: string;

  constructor(endpoint?: string, model?: string, apiKey?: string) {
    // Auto-detect Groq or OpenAI or HuggingFace
    const groqKey = process.env.GROQ_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    const hfKey = process.env.HUGGINGFACE_API_KEY;

    if (groqKey && !openAiKey) {
      this.endpoint = "https://api.groq.com/openai/v1/chat/completions";
      this.model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
      this.apiKey = groqKey;
    } else if (hfKey && !openAiKey) {
      this.endpoint = "https://router.huggingface.co/hf-inference/v1/chat/completions";
      this.model = process.env.HUGGINGFACE_LLM_MODEL || "meta-llama/Llama-3.1-8B-Instruct";
      this.apiKey = hfKey;
    } else {
      this.endpoint = endpoint || process.env.LOCAL_LLM_ENDPOINT || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions";
      this.model = model || process.env.LOCAL_LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
      this.apiKey = apiKey || openAiKey || "";
    }
  }

  async generate(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const { messages, tools, temperature = 0.2, maxTokens = 140, language = "en-IN" } = options;

    const lang = (language || "en-IN").toLowerCase();
    const isMarathi = lang.includes("mr");
    const isHindi = lang.includes("hi");
    const isEnglish = !isMarathi && !isHindi;

    // 1. Try Cloud LLM API if valid API key is present
    if (this.apiKey && this.apiKey.trim().length > 5) {
      try {
        const formattedTools = tools?.map((t: ToolDefinition) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));

        const body: Record<string, any> = {
          model: this.model,
          messages: messages.map((m: LLMMessage) => ({
            role: m.role,
            content: m.content,
            name: m.name,
            tool_call_id: m.tool_call_id,
            tool_calls: m.tool_calls,
          })),
          temperature,
          max_tokens: maxTokens,
        };

        if (formattedTools && formattedTools.length > 0) {
          body.tools = formattedTools;
          body.tool_choice = "auto";
        }

        const res = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const choice = data.choices?.[0];
          const msg = choice?.message;

          const toolCalls = msg?.tool_calls?.map((tc: any) => {
            let parsedArgs = {};
            try {
              parsedArgs = JSON.parse(tc.function.arguments);
            } catch {
              parsedArgs = {};
            }
            return {
              id: tc.id,
              name: tc.function.name,
              arguments: parsedArgs,
            };
          });

          if (msg?.content || (toolCalls && toolCalls.length > 0)) {
            return {
              text: msg?.content || "",
              toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
              finishReason: choice?.finish_reason || "stop",
              usage: data.usage,
            };
          }
        }
      } catch (err) {
        console.warn("[LocalLLMProvider] Cloud LLM error, using intelligent triple-language engine:", err);
      }
    }

    // 2. High-Precision Triple-Language Conversational Engine (English, Hindi, Marathi)
    const lastUserMsg = messages.filter((m: LLMMessage) => m.role === "user").pop()?.content.toLowerCase() || "";

    // ------------------------------------------------------------------------
    // INTENT 1: PLAN ACTIVATION & CONFIRMATION
    // ------------------------------------------------------------------------
    const isActivationIntent =
      lastUserMsg.includes("activate") ||
      lastUserMsg.includes("activation") ||
      lastUserMsg.includes("start plan") ||
      lastUserMsg.includes("confirm plan") ||
      lastUserMsg.includes("kar do") ||
      lastUserMsg.includes("chalu kar do") ||
      lastUserMsg.includes("shuru karo") ||
      lastUserMsg.includes("lena hai") ||
      lastUserMsg.includes("le lo") ||
      lastUserMsg.includes("agree") ||
      lastUserMsg.includes("subscribe") ||
      lastUserMsg.includes("yes activate") ||
      lastUserMsg.includes("ॲक्टिव्हेट") ||
      lastUserMsg.includes("सुरू करा") ||
      lastUserMsg.includes("चालू करा") ||
      lastUserMsg.includes("active kara") ||
      lastUserMsg.includes("ghyaycha ahe");

    if (isActivationIntent) {
      const reply = isMarathi
        ? "उत्तम! मी आपला स्विफ्टटेल ५G वार्षिक प्लॅन ॲक्टिव्हेट करण्याची प्रक्रिया सुरू केली आहे. ऑर्डर कन्फर्मेशन व पावती आपल्या नंबरवर पाठवली आहे."
        : isHindi
        ? "Bahut badhiya! Maine aapka SwiftTel 5G annual upgrade activate karne ki request submit kar di hai. Confirmation details aapke mobile par bhej di gayi hain."
        : "Excellent! I have confirmed and initiated the activation of your SwiftTel 5G annual upgrade. The activation confirmation and receipt have been dispatched to your mobile number.";

      return {
        text: reply,
        toolCalls: [
          {
            id: "call_tool_activate_plan",
            name: "confirm_plan_activation",
            arguments: { planId: "swifttel_annual_1999", deliveryMode: "whatsapp" },
          },
        ],
        finishReason: "tool_calls",
      };
    }

    // ------------------------------------------------------------------------
    // INTENT 2: CALLBACKS & TIMING REMINDERS
    // ------------------------------------------------------------------------
    const isCallbackIntent =
      lastUserMsg.includes("call me") ||
      lastUserMsg.includes("call back") ||
      lastUserMsg.includes("callback") ||
      lastUserMsg.includes("later") ||
      lastUserMsg.includes("busy") ||
      lastUserMsg.includes("meeting") ||
      lastUserMsg.includes("driving") ||
      lastUserMsg.includes("tomorrow") ||
      lastUserMsg.includes("two days") ||
      lastUserMsg.includes("2 days") ||
      lastUserMsg.includes("3 days") ||
      lastUserMsg.includes("three days") ||
      lastUserMsg.includes("do din") ||
      lastUserMsg.includes("teen din") ||
      lastUserMsg.includes("kal") ||
      lastUserMsg.includes("parso") ||
      lastUserMsg.includes("call karna") ||
      lastUserMsg.includes("call karo") ||
      lastUserMsg.includes("phone karna") ||
      lastUserMsg.includes("phone karo") ||
      lastUserMsg.includes("फोन करा") ||
      lastUserMsg.includes("कॉल करा") ||
      lastUserMsg.includes("दोन दिवसांनी") ||
      lastUserMsg.includes("तीन दिवसांनी") ||
      lastUserMsg.includes("उद्या") ||
      lastUserMsg.includes("नंतर") ||
      lastUserMsg.includes("व्यस्त") ||
      lastUserMsg.includes("वेळ नाही") ||
      lastUserMsg.includes("don divasani") ||
      lastUserMsg.includes("udya") ||
      lastUserMsg.includes("nantar");

    if (isCallbackIntent) {
      const delayDays =
        lastUserMsg.includes("3") || lastUserMsg.includes("three") || lastUserMsg.includes("teen") || lastUserMsg.includes("तीन")
          ? 3
          : lastUserMsg.includes("kal") || lastUserMsg.includes("tomorrow") || lastUserMsg.includes("उद्या") || lastUserMsg.includes("udya")
          ? 1
          : 2;

      let reply = `Certainly! I have scheduled a callback reminder for you in ${delayDays === 1 ? "tomorrow" : `${delayDays} days`}. Our team will connect with you then. Have a wonderful day!`;
      if (isMarathi) {
        reply = `नक्कीच! मी आपल्यासाठी ${delayDays === 1 ? "उद्यासाठी" : `${delayDays} दिवसांनी`} कॉलबॅक रिमाइंडर सेट केले आहे. आमची टीम आपल्याला संपर्क करेल. धन्यवाद, आपला दिवस शुभ जावो!`;
      } else if (isHindi) {
        reply = `Ji bilkul! Maine aapka callback reminder ${delayDays === 1 ? "kal" : `${delayDays} din baad`} ke liye note kar liya hai. Hamari team aapko connect karegi. Shukriya, aapka din shubh rahe!`;
      }

      return {
        text: reply,
        toolCalls: [
          {
            id: "call_tool_callback",
            name: "schedule_callback",
            arguments: { delay_days: delayDays, preferred_time: `${delayDays} days later` },
          },
        ],
        finishReason: "tool_calls",
      };
    }

    // ------------------------------------------------------------------------
    // INTENT 3: DENTAL CLINIC (Aarogya Dental Care Queries)
    // Checked before generic price to prevent "cleaning charge" colliding with 5G price
    // ------------------------------------------------------------------------
    const isDentalIntent =
      lastUserMsg.includes("cleaning") ||
      lastUserMsg.includes("root canal") ||
      lastUserMsg.includes("rct") ||
      lastUserMsg.includes("teeth") ||
      lastUserMsg.includes("tooth") ||
      lastUserMsg.includes("dant") ||
      lastUserMsg.includes("दात") ||
      lastUserMsg.includes("sharma") ||
      lastUserMsg.includes("aarogya") ||
      lastUserMsg.includes("डॉ. शर्मा") ||
      (lastUserMsg.includes("appointment") && !lastUserMsg.includes("5g"));

    if (isDentalIntent) {
      if (lastUserMsg.includes("appointment") || lastUserMsg.includes("book") || lastUserMsg.includes("slot") || lastUserMsg.includes("अपॉइंटमेंट")) {
        let reply = "Dr. Sharma has consultation slots available tomorrow at 10:30 AM and 3:30 PM. Shall I confirm your booking?";
        if (isMarathi) {
          reply = "डॉ. शर्मा यांच्याकडे उद्या सकाळी १०:३० आणि दुपारी ३:३० वाजता वेळ उपलब्ध आहे. मी आपली अपॉइंटमेंट बुक करू का?";
        } else if (isHindi) {
          reply = "Dr. Sharma ke paas kal subah 10:30 AM aur dopahar 3:30 PM ke slots uplabdh hain. Kya main aapka slot book kar doon?";
        }
        return {
          text: reply,
          toolCalls: [
            {
              id: "call_tool_book_appt",
              name: "book_appointment",
              arguments: { date: "tomorrow", timeSlot: "10:30 AM", treatmentType: "Consultation" },
            },
          ],
          finishReason: "tool_calls",
        };
      }

      let reply = "At Aarogya Dental Care, teeth cleaning is ₹1,200 and painless root canal treatments start from ₹3,500 with Dr. Sharma.";
      if (isMarathi) {
        reply = "आरोग्य डेंटल केअरमध्ये दात स्वच्छ करण्याचे शुल्क ₹१,२०० आणि रूट कॅनॉल उपचार ₹३,५०० पासून सुरू होतात. डॉ. शर्मा यांची अपॉइंटमेंट हवी आहे का?";
      } else if (isHindi) {
        reply = "Aarogya Dental Care mein teeth cleaning ₹1,200 hai aur painless root canal treatment ₹3,500 se shuru hota hai.";
      }
      return { text: reply, finishReason: "stop" };
    }

    // ------------------------------------------------------------------------
    // INTENT 4: TATA BANKING & LOANS
    // Checked before generic price to prevent "balance" colliding with 5G price
    // ------------------------------------------------------------------------
    const isBankingIntent =
      lastUserMsg.includes("loan") ||
      lastUserMsg.includes("balance") ||
      lastUserMsg.includes("emi") ||
      lastUserMsg.includes("कर्ज") ||
      lastUserMsg.includes("शिल्लक") ||
      lastUserMsg.includes("tata smartflo") ||
      lastUserMsg.includes("outstanding");

    if (isBankingIntent) {
      if (lastUserMsg.includes("emi") || lastUserMsg.includes("due")) {
        let reply = "Your upcoming EMI of ₹4,850 is scheduled for 05-Oct-2026.";
        if (isMarathi) {
          reply = "आपला पुढील ईएमआय ₹४,८५० चा असून तो ०५ ऑक्टोबर २०२६ रोजी देय आहे.";
        } else if (isHindi) {
          reply = "Aapki agli EMI ₹4,850 ki 05 October 2026 ko due hai.";
        }
        return {
          text: reply,
          toolCalls: [
            {
              id: "call_tool_emi",
              name: "fetch_emi_schedule",
              arguments: { loanId: "LN-TATA-8831" },
            },
          ],
          finishReason: "tool_calls",
        };
      }

      let reply = "Your current outstanding loan balance is ₹50,000.";
      if (isMarathi) {
        reply = "आपली उर्वरित कर्ज शिल्लक ₹५०,००० आहे. पुढील माहिती हवी आहे का?";
      } else if (isHindi) {
        reply = "Aapka vartaman loan balance ₹50,000 hai.";
      }
      return {
        text: reply,
        toolCalls: [
          {
            id: "call_tool_balance",
            name: "fetch_loan_account_balance",
            arguments: { loanId: "LN-TATA-8831" },
          },
        ],
        finishReason: "tool_calls",
      };
    }

    // ------------------------------------------------------------------------
    // INTENT 5: SEND PLAN DETAILS (WhatsApp / SMS)
    // ------------------------------------------------------------------------
    const isSendDetailsIntent =
      lastUserMsg.includes("whatsapp") ||
      lastUserMsg.includes("sms") ||
      lastUserMsg.includes("details") ||
      lastUserMsg.includes("send") ||
      lastUserMsg.includes("share") ||
      lastUserMsg.includes("message") ||
      lastUserMsg.includes("bhejo") ||
      lastUserMsg.includes("bhej do") ||
      lastUserMsg.includes("pathva") ||
      lastUserMsg.includes("माहिती पाठवा") ||
      lastUserMsg.includes("तपशील") ||
      lastUserMsg.includes("मेसेज करा");

    if (isSendDetailsIntent) {
      const channel = lastUserMsg.includes("sms") ? "sms" : "whatsapp";
      let reply = `I have sent the complete 5G annual plan details directly to your registered number via ${channel.toUpperCase()}. Please check your messages!`;
      if (isMarathi) {
        reply = `मी स्विफ्टटेल ५G प्लॅनचे संपूर्ण तपशील आपल्या नंबरवर ${channel.toUpperCase()} द्वारे पाठवले आहेत. कृपया तपासा!`;
      } else if (isHindi) {
        reply = `Maine SwiftTel 5G plan ki poori details aapke registered number par ${channel.toUpperCase()} se bhej di hain. Please check kar lijiye!`;
      }

      return {
        text: reply,
        toolCalls: [
          {
            id: "call_tool_send_details",
            name: "send_plan_details",
            arguments: { channel, planName: "SwiftTel 5G Annual Plan ₹1,999" },
          },
        ],
        finishReason: "tool_calls",
      };
    }

    // ------------------------------------------------------------------------
    // INTENT 6: PRICING & TARIFFS
    // ------------------------------------------------------------------------
    const isPriceIntent =
      lastUserMsg.includes("price") ||
      lastUserMsg.includes("cost") ||
      lastUserMsg.includes("rate") ||
      lastUserMsg.includes("charges") ||
      lastUserMsg.includes("rupees") ||
      lastUserMsg.includes("how much") ||
      lastUserMsg.includes("1999") ||
      lastUserMsg.includes("kitna") ||
      lastUserMsg.includes("kharcha") ||
      lastUserMsg.includes("paisa") ||
      lastUserMsg.includes("rupaye") ||
      lastUserMsg.includes("किंमत") ||
      lastUserMsg.includes("दर") ||
      lastUserMsg.includes("खर्च") ||
      lastUserMsg.includes("रुपये") ||
      lastUserMsg.includes("kimat") ||
      lastUserMsg.includes("kitit");

    if (isPriceIntent) {
      let reply = "The SwiftTel 5G annual plan costs ₹1,999 for a full 365 days, which includes 2.5 GB high-speed daily 5G data, unlimited calls, and OTT subscriptions.";
      if (isMarathi) {
        reply = "स्विफ्टटेल ५G वार्षिक प्लॅन ची किंमत पूर्ण ३६५ दिवसांसाठी फक्त ₹१,९९९ आहे ज्यामध्ये दररोज २.५ GB हाय-स्पीड ५G डेटा, मोफत कॉलिंग आणि OTT मिळतात.";
      } else if (isHindi) {
        reply = "SwiftTel 5G annual plan ki keemat pooray 365 dino ke liye sirf ₹1,999 hai, jisme daily 2.5 GB 5G data, unlimited calls aur OTT apps shamil hain.";
      }

      return {
        text: reply,
        finishReason: "stop",
      };
    }

    // ------------------------------------------------------------------------
    // INTENT 7: PLAN OVERVIEW & 5G DATA BENEFITS
    // ------------------------------------------------------------------------
    const isPlanIntent =
      lastUserMsg.includes("plan") ||
      lastUserMsg.includes("5g") ||
      lastUserMsg.includes("offer") ||
      lastUserMsg.includes("data") ||
      lastUserMsg.includes("benefit") ||
      lastUserMsg.includes("speed") ||
      lastUserMsg.includes("validity") ||
      lastUserMsg.includes("tell me") ||
      lastUserMsg.includes("jankari") ||
      lastUserMsg.includes("माहिती") ||
      lastUserMsg.includes("प्लॅन") ||
      lastUserMsg.includes("ऑफर") ||
      lastUserMsg.includes("सांगा");

    if (isPlanIntent) {
      let reply = "Our annual plan offers 2.5 GB of daily 5G data, truly unlimited voice calls, and OTT entertainment benefits like Disney+ Hotstar and SonyLIV for ₹1,999.";
      if (isMarathi) {
        reply = "आमचा वार्षिक प्लॅन दररोज २.५ GB ५G डेटा, अमर्यादित कॉलिंग आणि डिस्ने+ हॉटस्टार व सोनीलिव्हचे OTT फायदे ₹१,९९९ मध्ये देतो. आपण हा प्लॅन सुरू करू इच्छिता?";
      } else if (isHindi) {
        reply = "Hamara annual plan aapko 2.5 GB daily 5G data, unlimited calls aur Disney+ Hotstar aur SonyLIV ke OTT benefits sirf ₹1,999 mein provide karta hai.";
      }

      return {
        text: reply,
        finishReason: "stop",
      };
    }

    // ------------------------------------------------------------------------
    // INTENT 8: IDENTITY / ARE YOU AI OR HUMAN?
    // ------------------------------------------------------------------------
    const isIdentityIntent =
      lastUserMsg.includes("who are you") ||
      lastUserMsg.includes("your name") ||
      lastUserMsg.includes("robot") ||
      lastUserMsg.includes("ai") ||
      lastUserMsg.includes("human") ||
      lastUserMsg.includes("kaun ho") ||
      lastUserMsg.includes("naam kya") ||
      lastUserMsg.includes("insaan") ||
      lastUserMsg.includes("तुम्ही कोण") ||
      lastUserMsg.includes("रोबोट") ||
      lastUserMsg.includes("माणूस");

    if (isIdentityIntent) {
      let reply = "I am Simran, an advanced AI Voice Specialist for SwiftTel 5G. I am here to assist you with quick plan upgrades and customer support!";
      if (isMarathi) {
        reply = "मी सिमरन, स्विफ्टटेल ५G ची प्रगत AI व्हॉइस स्पेशलिस्ट आहे. आपला वेळ वाचवून त्वरित माहिती व मदत देण्यासाठी मी उपलब्ध आहे!";
      } else if (isHindi) {
        reply = "Main Simran hoon, SwiftTel 5G ki AI voice specialist. Main aapko turant network updates aur plans mein help karne ke liye yahan hoon.";
      }

      return {
        text: reply,
        finishReason: "stop",
      };
    }

    // ------------------------------------------------------------------------
    // INTENT 9: REJECTION / NOT INTERESTED / HANGUP
    // ------------------------------------------------------------------------
    const isRejectionIntent =
      lastUserMsg.includes("not interested") ||
      lastUserMsg.includes("no need") ||
      lastUserMsg.includes("don't want") ||
      lastUserMsg.includes("nahi chahiye") ||
      lastUserMsg.includes("zarurat nahi") ||
      lastUserMsg.includes("mat karo") ||
      lastUserMsg.includes("bye") ||
      lastUserMsg.includes("cut") ||
      lastUserMsg.includes("kato") ||
      lastUserMsg.includes("नको") ||
      lastUserMsg.includes("गरज नाही") ||
      lastUserMsg.includes("कापा");

    if (isRejectionIntent) {
      let reply = "Understood. Thank you so much for your valuable time today. Have a wonderful day ahead!";
      if (isMarathi) {
        reply = "समजले. आपला बहुमूल्य वेळ दिल्याबद्दल मनापासून धन्यवाद. आपला दिवस आनंदात जावो!";
      } else if (isHindi) {
        reply = "Koi baat nahi. Apna keemti samay dene ke liye bahut shukriya. Aapka din shubh rahe!";
      }

      return {
        text: reply,
        toolCalls: [
          {
            id: "call_tool_hangup",
            name: "hangup_call",
            arguments: { reason: "customer_not_interested" },
          },
        ],
        finishReason: "stop",
      };
    }

    // ------------------------------------------------------------------------
    // INTENT 10: OUT-OF-SYLLABUS / RANDOM / OFF-TOPIC HANDLING (Gentle Redirection)
    // ------------------------------------------------------------------------
    let outOfSyllabusReply = "I understand what you're asking, but as your SwiftTel 5G specialist, I am dedicated to helping you with your network upgrade and services today. Would you like me to share details about our high-speed 5G annual plan?";
    if (isMarathi) {
      outOfSyllabusReply = "मी समजू शकते, पण सध्या मी स्विफ्टटेल ५G स्पेशलिस्ट म्हणून आपल्या मोबाईल नेटवर्क व प्लॅन अपग्रेडसाठी बोलत आहे. मी आपल्याला या ५G ऑफरचे फायदे सांगू का?";
    } else if (isHindi) {
      outOfSyllabusReply = "Main samajh sakti hoon, lekin abhi main SwiftTel 5G specialist ke roop mein aapke mobile plan upgrade ke liye judee hoon. Kya aap hamare 5G unlimited plan ki jankari lena chahenge?";
    }

    return {
      text: outOfSyllabusReply,
      finishReason: "stop",
    };
  }
}
