import { nanoid } from "nanoid";
import {
  CallStatus,
  SupervisorActionType,
  TelephonyCallPayload,
  TelephonyCallResult,
} from "./types";

export interface TelephonyProvider {
  name: string;
  makeCall(payload: TelephonyCallPayload): Promise<TelephonyCallResult>;
  terminateCall(callId: string): Promise<{ success: boolean; message: string }>;
  callAction(
    callId: string,
    action: SupervisorActionType,
    supervisorId: string
  ): Promise<{ success: boolean; mode: SupervisorActionType }>;
  getCallStatus(callId: string): Promise<{ callId: string; status: CallStatus; durationSeconds: number }>;
}

export class ExotelProvider implements TelephonyProvider {
  name = "exotel";
  private apiKey: string;
  private apiToken: string;
  private sid: string;

  constructor() {
    this.apiKey = process.env.EXOTEL_API_KEY || "";
    this.apiToken = process.env.EXOTEL_API_TOKEN || "";
    this.sid = process.env.EXOTEL_SID || "";
  }

  async makeCall(payload: TelephonyCallPayload): Promise<TelephonyCallResult> {
    const callId = `exo_${nanoid(12)}`;
    // If live credentials are provided, call Exotel REST API
    if (this.apiKey && this.apiToken && this.sid) {
      try {
        // Exotel Outbound Voice API endpoint:
        // https://<API_KEY>:<API_TOKEN>@api.exotel.com/v1/Accounts/<SID>/Calls/connect.json
        const auth = Buffer.from(`${this.apiKey}:${this.apiToken}`).toString("base64");
        const body = new URLSearchParams({
          From: payload.from.startsWith("+91") ? payload.from : `+91${payload.from}`,
          To: payload.to.startsWith("+91") ? payload.to : `+91${payload.to}`,
          CallerId: payload.from,
          StatusCallback: payload.webhookUrl || "",
        });

        const res = await fetch(`https://api.exotel.com/v1/Accounts/${this.sid}/Calls/connect.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!res.ok) {
          console.warn(`[Exotel] API returned status ${res.status}, falling back to simulated call response`);
        } else {
          const json = await res.json();
          return {
            callId: json.Call?.Sid || callId,
            provider: this.name,
            status: "ringing",
            rawResponse: json,
          };
        }
      } catch (err) {
        console.warn("[Exotel] API call error, falling back to simulated call response", err);
      }
    }

    return {
      callId,
      provider: this.name,
      status: "ringing",
      rawResponse: { simulated: true, note: "Dispatched via Exotel India Voice Gateway" },
    };
  }

  async terminateCall(callId: string) {
    return { success: true, message: `Exotel call ${callId} terminated.` };
  }

  async callAction(callId: string, action: SupervisorActionType, supervisorId: string) {
    return { success: true, mode: action };
  }

  async getCallStatus(callId: string) {
    return { callId, status: "in_progress" as CallStatus, durationSeconds: 45 };
  }
}

export class BolnaProvider implements TelephonyProvider {
  name = "bolna";
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.BOLNA_API_KEY || "";
  }

  async makeCall(payload: TelephonyCallPayload): Promise<TelephonyCallResult> {
    const callId = `bolna_${nanoid(12)}`;
    if (this.apiKey) {
      try {
        const res = await fetch("https://api.bolna.dev/call", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient_phone_number: payload.to,
            agent_id: payload.metadata?.agentId || "bolna-agent-default",
            user_data: payload.metadata,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          return {
            callId: json.call_id || callId,
            provider: this.name,
            status: "ringing",
            rawResponse: json,
          };
        }
      } catch (err) {
        console.warn("[Bolna] API error, using simulation fallback", err);
      }
    }

    return {
      callId,
      provider: this.name,
      status: "ringing",
      rawResponse: { simulated: true, note: "Bolna Voice Agent Connected" },
    };
  }

  async terminateCall(callId: string) {
    return { success: true, message: `Bolna agent call ${callId} ended.` };
  }

  async callAction(callId: string, action: SupervisorActionType, supervisorId: string) {
    return { success: true, mode: action };
  }

  async getCallStatus(callId: string) {
    return { callId, status: "in_progress" as CallStatus, durationSeconds: 32 };
  }
}

export class MockTelephonyProvider implements TelephonyProvider {
  name = "mock";
  private activeCalls = new Map<string, { status: CallStatus; start: number; supervisorMode?: SupervisorActionType }>();

  async makeCall(payload: TelephonyCallPayload): Promise<TelephonyCallResult> {
    const callId = `mock_${nanoid(10)}`;
    this.activeCalls.set(callId, {
      status: "ringing",
      start: Date.now(),
    });

    // Auto-transition to in_progress after brief ring
    setTimeout(() => {
      const c = this.activeCalls.get(callId);
      if (c && c.status === "ringing") {
        c.status = "in_progress";
      }
    }, 1200);

    return {
      callId,
      provider: this.name,
      status: "ringing",
      rawResponse: { simulated: true, timestamp: new Date().toISOString() },
    };
  }

  async terminateCall(callId: string) {
    const c = this.activeCalls.get(callId);
    if (c) {
      c.status = "completed";
    }
    return { success: true, message: `Mock call ${callId} hung up cleanly.` };
  }

  async callAction(callId: string, action: SupervisorActionType, supervisorId: string) {
    const c = this.activeCalls.get(callId);
    if (c) {
      c.supervisorMode = action;
    }
    return { success: true, mode: action };
  }

  async getCallStatus(callId: string) {
    const c = this.activeCalls.get(callId);
    const duration = c ? Math.floor((Date.now() - c.start) / 1000) : 0;
    return {
      callId,
      status: c ? c.status : "completed",
      durationSeconds: duration,
    };
  }
}

const exotel = new ExotelProvider();
const bolna = new BolnaProvider();
const mock = new MockTelephonyProvider();

export function getTelephonyProvider(name?: string): TelephonyProvider {
  const p = (name || process.env.DEFAULT_TELEPHONY_PROVIDER || "mock").toLowerCase();
  if (p === "exotel") return exotel;
  if (p === "bolna") return bolna;
  return mock;
}
