/**
 * Intelligent Callback Intent & Relative Time Parser
 * Handles English, Hindi, and Hinglish phrasing for callback scheduling.
 * Examples:
 * - "call me in next two days" -> +2 days
 * - "after 2 days" / "do din baad call karo" -> +2 days
 * - "after three days" / "teen din baad" -> +3 days
 * - "tomorrow" / "kal call karna" -> +1 day
 * - "after 1 hour" / "ek ghante baad" -> +1 hour
 * - "in 2 minutes" / "do minute baad" -> +2 minutes
 */

export interface ParsedCallbackRequest {
  isCallbackRequested: boolean;
  delayMs: number;
  scheduledAt: string; // ISO date string
  friendlyTextHi: string;
  friendlyTextEn: string;
  reason?: string;
}

export function parseCallbackIntent(text: string): ParsedCallbackRequest {
  const lower = text.toLowerCase().trim();

  // Basic check for callback or later contact intent
  const callbackTriggers = [
    "call me",
    "call karna",
    "call karo",
    "phone karna",
    "phone karo",
    "baat karna",
    "baat karenge",
    "baad me",
    "baad mein",
    "later",
    "callback",
    "call back",
    "busy hoon",
    "busy am",
    "meeting me hoon",
    "meeting mein",
    "in meeting",
    "driving",
    "kal",
    "tomorrow",
    "parso",
    "next day",
    "next week",
    "do din",
    "teen din",
    "char din",
    "two days",
    "three days",
    "four days",
    "2 days",
    "3 days",
    "4 days",
    "5 days",
    "1 hour",
    "ek ghanta",
    "ghante",
    "minute",
  ];

  const hasTrigger = callbackTriggers.some((trigger) => lower.includes(trigger));
  if (!hasTrigger) {
    return {
      isCallbackRequested: false,
      delayMs: 0,
      scheduledAt: new Date().toISOString(),
      friendlyTextHi: "",
      friendlyTextEn: "",
    };
  }

  const now = Date.now();
  let delayMs = 2 * 24 * 60 * 60 * 1000; // default 2 days if general callback requested
  let friendlyTextHi = "2 din baad";
  let friendlyTextEn = "in 2 days";

  // Check for specific durations
  if (lower.includes("3 days") || lower.includes("three days") || lower.includes("teen din") || lower.includes("3 din")) {
    delayMs = 3 * 24 * 60 * 60 * 1000;
    friendlyTextHi = "3 din baad";
    friendlyTextEn = "in 3 days";
  } else if (
    lower.includes("2 days") ||
    lower.includes("two days") ||
    lower.includes("do din") ||
    lower.includes("2 din") ||
    lower.includes("next two days")
  ) {
    delayMs = 2 * 24 * 60 * 60 * 1000;
    friendlyTextHi = "2 din baad";
    friendlyTextEn = "in 2 days";
  } else if (lower.includes("4 days") || lower.includes("four days") || lower.includes("char din")) {
    delayMs = 4 * 24 * 60 * 60 * 1000;
    friendlyTextHi = "4 din baad";
    friendlyTextEn = "in 4 days";
  } else if (lower.includes("5 days") || lower.includes("five days") || lower.includes("paanch din")) {
    delayMs = 5 * 24 * 60 * 60 * 1000;
    friendlyTextHi = "5 din baad";
    friendlyTextEn = "in 5 days";
  } else if (lower.includes("parso") || lower.includes("day after tomorrow")) {
    delayMs = 2 * 24 * 60 * 60 * 1000;
    friendlyTextHi = "parso";
    friendlyTextEn = "day after tomorrow";
  } else if (lower.includes("kal") || lower.includes("tomorrow") || lower.includes("next day")) {
    delayMs = 24 * 60 * 60 * 1000;
    friendlyTextHi = "kal";
    friendlyTextEn = "tomorrow";
  } else if (lower.includes("week") || lower.includes("hafte") || lower.includes("next week")) {
    delayMs = 7 * 24 * 60 * 60 * 1000;
    friendlyTextHi = "agle hafte";
    friendlyTextEn = "next week";
  } else if (lower.includes("hour") || lower.includes("ghante") || lower.includes("1 hour")) {
    delayMs = 60 * 60 * 1000;
    friendlyTextHi = "1 ghante baad";
    friendlyTextEn = "in 1 hour";
  } else if (lower.includes("2 min") || lower.includes("two min") || lower.includes("do minute")) {
    // Quick test mode: 2 minutes
    delayMs = 2 * 60 * 1000;
    friendlyTextHi = "2 minute baad";
    friendlyTextEn = "in 2 minutes";
  }

  const scheduledDate = new Date(now + delayMs);

  return {
    isCallbackRequested: true,
    delayMs,
    scheduledAt: scheduledDate.toISOString(),
    friendlyTextHi,
    friendlyTextEn,
    reason: `Customer requested callback ${friendlyTextEn} (${text})`,
  };
}
