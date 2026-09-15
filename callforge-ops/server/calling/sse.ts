import { Response } from "express";
import { ActiveCall, AgentState } from "./types";

export interface WallboardSnapshot {
  timestamp: string;
  activeCalls: ActiveCall[];
  agents: Array<{
    id: string;
    name: string;
    avatar: string;
    state: AgentState;
    timeInStateSeconds: number;
    currentCallId?: string;
  }>;
  queueStats: {
    waitingCalls: number;
    longestWaitSeconds: number;
    availableAgents: number;
    busyAgents: number;
  };
}

class CallingEventBroker {
  private clients: Set<Response> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.sendRaw(":keep-alive\n\n");
    }, 15000);
  }

  registerClient(res: Response, initialSnapshot?: WallboardSnapshot) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering (Nginx)
    res.flushHeaders?.();

    this.clients.add(res);

    // Send initial connection greeting
    res.write(`event: connected\ndata: ${JSON.stringify({ message: "SSE connected to CallForge live feed", timestamp: new Date().toISOString() })}\n\n`);

    if (initialSnapshot) {
      res.write(`event: wallboard_snapshot\ndata: ${JSON.stringify(initialSnapshot)}\n\n`);
    }

    res.on("close", () => {
      this.clients.delete(res);
      res.end();
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  private sendRaw(payload: string) {
    for (const client of Array.from(this.clients)) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  broadcast(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.sendRaw(payload);
  }

  broadcastWallboard(snapshot: WallboardSnapshot) {
    this.broadcast("wallboard_update", snapshot);
  }

  broadcastCallUpdate(call: ActiveCall) {
    this.broadcast("call_update", call);
  }

  broadcastAgentStatus(agentId: string, state: AgentState, name?: string) {
    this.broadcast("agent_status", {
      agentId,
      name,
      state,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastSentimentAlert(callId: string, alert: { customerPhone: string; sentiment: string; note: string }) {
    this.broadcast("sentiment_alert", {
      callId,
      ...alert,
      timestamp: new Date().toISOString(),
    });
  }
}

export const eventBroker = new CallingEventBroker();
