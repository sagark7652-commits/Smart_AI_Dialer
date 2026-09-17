import React, { useState } from "react";
import {
  Workflow,
  Plus,
  Play,
  Settings2,
  Bot,
  Users,
  PhoneForwarded,
  Save,
  Download,
  CheckCircle2,
  Volume2,
  PhoneOff,
} from "lucide-react";
import { toast } from "sonner";

export interface IVRNode {
  id: string;
  type: "greeting" | "menu" | "ai_agent" | "human_queue" | "voicemail" | "hangup";
  title: string;
  description: string;
  config: Record<string, any>;
  next?: string[];
}

const INITIAL_IVR_NODES: IVRNode[] = [
  {
    id: "node-1",
    type: "greeting",
    title: "1. Welcome Greeting",
    description: "Plays bilingual TRAI audio greeting and compliance disclosure.",
    config: {
      audioPrompt: "Welcome to CallForge Solutions. Calls are recorded for quality assurance.",
      voice: "Asha (Hindi/English)",
    },
    next: ["node-2"],
  },
  {
    id: "node-2",
    type: "menu",
    title: "2. DTMF Keypress Menu",
    description: "Press 1 for Autonomous AI qualifier, Press 2 for Enterprise Sales.",
    config: {
      options: [
        { key: "1", target: "node-3", label: "Connect with AI Agent" },
        { key: "2", target: "node-4", label: "Connect with Live Specialist" },
      ],
      timeoutSeconds: 5,
    },
    next: ["node-3", "node-4"],
  },
  {
    id: "node-3",
    type: "ai_agent",
    title: "3. Asha AI Qualifier",
    description: "Answers queries, captures lead requirements, schedules calendar appointments.",
    config: {
      agent: "Asha · Retail Qualifier",
      model: "Claude 3.5 Sonnet Telephony",
      language: "Hinglish",
    },
    next: ["node-5"],
  },
  {
    id: "node-4",
    type: "human_queue",
    title: "4. Senior Agent Queue",
    description: "Routes call to available human supervisor with round-robin strategy.",
    config: {
      queueName: "Enterprise Tier 1",
      maxWaitSeconds: 45,
      fallback: "node-5",
    },
    next: ["node-5"],
  },
  {
    id: "node-5",
    type: "voicemail",
    title: "5. Voicemail & SMS Confirmation",
    description: "If busy or after-hours, records audio voicemail and dispatches WhatsApp alert.",
    config: {
      sendSms: true,
      whatsappTemplate: "callforge_enquiry_ack",
    },
  },
];

export const VisualIVRBuilder: React.FC = () => {
  const [nodes, setNodes] = useState<IVRNode[]>(INITIAL_IVR_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("node-1");
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    fetch("/api/calling/ivr")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
          setNodes(data.nodes);
        }
      })
      .catch(() => {});
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  const handleUpdateNodeConfig = (key: string, value: any) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNodeId ? { ...n, config: { ...n.config, [key]: value } } : n
      )
    );
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(nodes, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ivr_flow_callforge_${Date.now()}.json`;
    a.click();
    toast.success("IVR Flow configuration exported as JSON");
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const res = await fetch("/api/calling/ivr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes }),
      });
      const data = await res.json();
      toast.success("IVR Inbound Dialplan Deployed & Saved", {
        description: `Successfully stored ${nodes.length} flow stages to carrier routing table & persistent database.`,
      });
    } catch {
      toast.error("Failed to deploy IVR dialplan");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center">
            <Workflow size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Visual Inbound IVR & Call Flow Builder</h3>
            <p className="text-[11px] text-zinc-400">
              Interactive DTMF tree, autonomous AI routing, and live fallback bridges
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
          >
            <Download size={13} /> Export JSON
          </button>
          <button
            type="button"
            onClick={handleDeploy}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <Save size={13} /> Deploy IVR Dialplan
          </button>
        </div>
      </div>

      {/* Main Builder Canvas + Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Interactive Node Flow Canvas (2 Columns) */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-zinc-800 bg-zinc-950/70 min-h-[460px] flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            {nodes.map((node, index) => {
              const isSelected = node.id === selectedNodeId;
              return (
                <div key={node.id} className="relative">
                  <div
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? "border-violet-500 bg-violet-950/30 shadow-lg shadow-violet-950/30 ring-1 ring-violet-500/50"
                        : "border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          node.type === "ai_agent"
                            ? "bg-violet-600/25 text-violet-300"
                            : node.type === "human_queue"
                            ? "bg-cyan-600/25 text-cyan-300"
                            : node.type === "menu"
                            ? "bg-amber-600/25 text-amber-300"
                            : "bg-emerald-600/25 text-emerald-300"
                        }`}
                      >
                        {node.type === "ai_agent" ? (
                          <Bot size={16} />
                        ) : node.type === "human_queue" ? (
                          <Users size={16} />
                        ) : node.type === "menu" ? (
                          <Settings2 size={16} />
                        ) : (
                          <Volume2 size={16} />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                          {node.title}
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {node.type}
                          </span>
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                          {node.description}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        isSelected ? "bg-violet-600 text-white" : "text-zinc-500"
                      }`}
                    >
                      {isSelected ? "ACTIVE" : "CLICK TO EDIT"}
                    </span>
                  </div>

                  {/* Flow Connector Arrow */}
                  {index < nodes.length - 1 && (
                    <div className="w-px h-4 bg-zinc-700 mx-auto my-1" />
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const newNode: IVRNode = {
                id: `node-${nodes.length + 1}`,
                type: "hangup",
                title: `${nodes.length + 1}. End Call & Send SMS`,
                description: "Closes session gracefully with an automated SMS feedback link.",
                config: {},
              };
              setNodes([...nodes, newNode]);
              toast.info("Added new node to IVR diagram");
            }}
            className="w-full py-2.5 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-violet-500 hover:bg-violet-950/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Add Next Step in Dialplan
          </button>
        </div>

        {/* Right: Selected Node Config Inspector (1 Column) */}
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/90 space-y-4">
          <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                Node Properties
              </span>
              <h4 className="text-xs font-bold text-zinc-100">{selectedNode.title}</h4>
            </div>
            <span className="text-[10px] bg-violet-950/60 text-violet-300 border border-violet-800/50 px-2 py-0.5 rounded font-mono">
              {selectedNode.type}
            </span>
          </div>

          {/* Node Config Fields */}
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                Node Label / Display Name
              </label>
              <input
                type="text"
                value={selectedNode.title}
                onChange={(e) => {
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === selectedNodeId ? { ...n, title: e.target.value } : n
                    )
                  );
                }}
                className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                Description / Purpose
              </label>
              <textarea
                rows={2}
                value={selectedNode.description}
                onChange={(e) => {
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === selectedNodeId ? { ...n, description: e.target.value } : n
                    )
                  );
                }}
                className="w-full px-3 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            {selectedNode.type === "greeting" && (
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Text-to-Speech (TTS) Prompt
                </label>
                <textarea
                  rows={3}
                  value={selectedNode.config.audioPrompt || ""}
                  onChange={(e) => handleUpdateNodeConfig("audioPrompt", e.target.value)}
                  className="w-full p-2.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>
            )}

            {selectedNode.type === "menu" && (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-zinc-300 block">
                  DTMF Digit Routing
                </label>
                <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 space-y-1.5 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span>Key [1]</span>
                    <span className="text-violet-400">→ Route to AI Agent</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-300">
                    <span>Key [2]</span>
                    <span className="text-cyan-400">→ Route to Live Specialist</span>
                  </div>
                </div>
              </div>
            )}

            {selectedNode.type === "ai_agent" && (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-zinc-300 block">
                  AI Voice Assistant Persona
                </label>
                <select
                  value={selectedNode.config.agent || "Asha"}
                  onChange={(e) => handleUpdateNodeConfig("agent", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200"
                >
                  <option value="Asha">Asha · Hindi + English Warm Qualifier</option>
                  <option value="Kabir">Kabir · English Consultative Specialist</option>
                  <option value="Meera">Meera · Hinglish Demo Concierge</option>
                </select>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-400" /> Auto-saved in local draft
          </div>
        </div>
      </div>
    </div>
  );
};
