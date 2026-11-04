import { AgentSession, ToolDefinition } from "../types";
import { persistentStore } from "../../../storage/persistentStore";
import { parseCallbackIntent } from "../callbackParser";

export const BUILTIN_CALLBACK_TOOLS: ToolDefinition[] = [
  {
    name: "schedule_callback",
    description: "Schedules an automated callback reminder for this customer when they request to be called in 2-3 days, tomorrow, or at a later time.",
    parameters: {
      type: "object",
      properties: {
        delay_days: { type: "number", description: "Number of days after which to call back (e.g. 2, 3)" },
        preferred_time: { type: "string", description: "Description of when to call back (e.g. 'in 2 days', 'after 3 days', 'kal shaam')" },
        reason: { type: "string", description: "Reason for callback requested by customer" },
      },
      required: [],
    },
    execute: async (args: Record<string, any>, context: AgentSession) => {
      const preferred = args.preferred_time || (args.delay_days ? `${args.delay_days} days` : "2 days");
      const parsed = parseCallbackIntent(preferred);

      const delayDays = args.delay_days || Math.round(parsed.delayMs / (24 * 60 * 60 * 1000)) || 2;
      const scheduledAt = parsed.delayMs > 0 ? parsed.scheduledAt : new Date(Date.now() + delayDays * 86400000).toISOString();
      const customerName = context.memory.customerName || "Customer";
      const phone = context.customerPhone;

      const callback = persistentStore.addScheduledCallback({
        customerName,
        customerPhone: phone,
        scheduledAt,
        reason: args.reason || `Customer requested callback in ${delayDays} days`,
        requestedBy: "customer",
        notes: `Automated callback scheduled by AI Voice Assistant for ${customerName}.`,
      });

      const lang = context.agentConfig.language || "en-IN";
      let friendlyText = `${delayDays} days later`;
      let readback = `Certainly ${customerName}! I have scheduled a callback reminder for ${delayDays} days later. Our team will reach back out to you then. Thank you for your time, have a wonderful day!`;

      if (lang === "mr-IN") {
        friendlyText = `${delayDays} दिवसांनी`;
        readback = `नक्कीच ${customerName} जी! मी आपल्यासाठी ${delayDays} दिवसांनी कॉलबॅक रिमाइंडर सेट केले आहे. आमची टीम आपल्याला पुन्हा संपर्क करेल. वेळ दिल्याबद्दल धन्यवाद, आपला दिवस शुभ जावो!`;
      } else if (lang === "hi-IN") {
        friendlyText = parsed.friendlyTextHi || `${delayDays} din baad`;
        readback = `Ji bilkul ${customerName} ji, maine aapka callback reminder ${friendlyText} ke liye note kar liya hai. Hamari team aapko connect karegi. Apna keemti samay dene ke liye shukriya, aapka din shubh rahe!`;
      }

      return {
        success: true,
        callbackId: callback.id,
        scheduledAt,
        friendlyText,
        message: `Callback scheduled for ${customerName} on ${new Date(scheduledAt).toLocaleString("en-IN")}.`,
        confirmation_readback: readback,
      };
    },
  },
];
