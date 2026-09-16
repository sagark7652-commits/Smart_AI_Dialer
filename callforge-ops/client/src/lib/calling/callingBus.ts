// Global Calling Event Bus
export interface CallRequest {
  phone: string;
  name?: string;
  company?: string;
  script?: string;
  source?: string;
}

type CallListener = (req: CallRequest) => void;

class CallingEventBus {
  private listeners: Set<CallListener> = new Set();

  subscribe(listener: CallListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  triggerCall(req: CallRequest) {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(req);
      } catch (err) {
        console.error("[CallingBus] Error notifying listener", err);
      }
    }
  }
}

export const callingBus = new CallingEventBus();
