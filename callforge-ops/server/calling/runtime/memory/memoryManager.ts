import { AgentMemory, AgentSession, LLMMessage } from "../types";

export class AgentMemoryManager {
  initMemory(customerPhone: string, customerName?: string): AgentMemory {
    return {
      customerName: customerName || "Valued Customer",
      phone: customerPhone,
      verifiedKYC: false,
      sentimentTrend: ["neutral"],
      extractedEntities: {},
      callSummary: "",
    };
  }

  updateFromTurn(session: AgentSession, userUtterance: string, _aiResponse: string) {
    const lower = userUtterance.toLowerCase();

    // Sentiment tracking
    if (lower.includes("thank") || lower.includes("great") || lower.includes("good") || lower.includes("yes")) {
      session.memory.sentimentTrend.push("positive");
    } else if (lower.includes("not interested") || lower.includes("bad") || lower.includes("angry") || lower.includes("stop")) {
      session.memory.sentimentTrend.push("negative");
    } else {
      session.memory.sentimentTrend.push("neutral");
    }

    // Entity extraction heuristics
    const phoneMatch = userUtterance.match(/(\+91|0)?[6-9]\d{9}/);
    if (phoneMatch) {
      session.memory.extractedEntities.altPhone = phoneMatch[0];
    }

    const loanMatch = userUtterance.match(/LN-[A-Z0-9-]+/i);
    if (loanMatch) {
      session.memory.accountNumber = loanMatch[0].toUpperCase();
    }

    // Rolling compact summary
    const turnCount = session.messages.filter((m: LLMMessage) => m.role === "user").length;
    session.memory.callSummary = `Call in progress. Total ${turnCount} conversational turns completed. Last topic: "${userUtterance.slice(0, 40)}..."`;
  }
}

export const agentMemoryManager = new AgentMemoryManager();
