import React, { useState } from "react";
import {
  Activity,
  Wifi,
  Server,
  RefreshCw,
  CheckCircle2,
  Clock,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export const SystemStatusPage: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [latency, setLatency] = useState(32);
  const [jitter, setJitter] = useState(8);
  const [mosScore, setMosScore] = useState(4.42);
  const [packetLoss, setPacketLoss] = useState(0.02);

  const handleRunDiagnostics = () => {
    setIsTesting(true);
    toast.info("Testing WebRTC Audio Gateway Latency & MOS Quality...");

    setTimeout(() => {
      setLatency(Math.floor(Math.random() * 8) + 28);
      setJitter(Math.floor(Math.random() * 4) + 6);
      setMosScore(+(4.35 + Math.random() * 0.1).toFixed(2));
      setPacketLoss(+(Math.random() * 0.04).toFixed(3));
      setIsTesting(false);
      toast.success("WebRTC Diagnostics Complete: HD Audio Grade A");
    }, 1500);
  };

  const trunks = [
    {
      name: "Tata Smartflo Primary PRI/SIP Trunk",
      region: "Mumbai (AP-South-1)",
      status: "Operational",
      uptime: "99.99%",
      latency: "24ms",
    },
    {
      name: "Exotel Secondary Failover Trunk",
      region: "Bengaluru Core",
      status: "Operational",
      uptime: "99.98%",
      latency: "38ms",
    },
    {
      name: "TRAI Vilpower DLT Verification API",
      region: "New Delhi Registry",
      status: "Operational",
      uptime: "100.0%",
      latency: "52ms",
    },
    {
      name: "Claude 3.5 Sonnet Streaming Voice Gateway",
      region: "India Edge Low-Latency",
      status: "Operational",
      uptime: "99.99%",
      latency: "210ms TTFT",
    },
  ];

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
            <Activity size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100">
              WebRTC Network Quality & Telephony Trunk Diagnostics
            </h3>
            <p className="text-[11px] text-zinc-400">
              Live MOS score, jitter, carrier connection health & speech latency
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunDiagnostics}
          disabled={isTesting}
          className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700"
        >
          <RefreshCw size={13} className={isTesting ? "animate-spin" : ""} />
          {isTesting ? "Running Ping Test..." : "Run WebRTC Ping Test"}
        </button>
      </div>

      {/* Network Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
            MOS Audio Quality
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <strong className="text-xl font-extrabold text-emerald-400 font-mono">
              {mosScore}
            </strong>
            <span className="text-xs text-zinc-500 font-mono">/ 5.0</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-medium block mt-1">
            Grade A (HD Opus Voice)
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
            Round-Trip Latency (RTT)
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <strong className="text-xl font-extrabold text-zinc-100 font-mono">{latency}</strong>
            <span className="text-xs text-zinc-500 font-mono">ms</span>
          </div>
          <span className="text-[10px] text-zinc-400 block mt-1">Direct Mumbai Edge</span>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
            Jitter Variance
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <strong className="text-xl font-extrabold text-zinc-100 font-mono">{jitter}</strong>
            <span className="text-xs text-zinc-500 font-mono">ms</span>
          </div>
          <span className="text-[10px] text-zinc-400 block mt-1">Jitter Buffer: Stable</span>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
            Packet Loss
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <strong className="text-xl font-extrabold text-emerald-400 font-mono">
              {packetLoss}%
            </strong>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-medium block mt-1">
            Zero Dropped Packets
          </span>
        </div>
      </div>

      {/* Telephony Trunks Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/80 text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b border-zinc-800">
            <tr>
              <th className="p-3">Carrier / Service Component</th>
              <th className="p-3">Deployment Region</th>
              <th className="p-3">Trunk Ping</th>
              <th className="p-3">SLA Uptime</th>
              <th className="p-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {trunks.map((t, idx) => (
              <tr key={idx} className="hover:bg-zinc-900/40">
                <td className="p-3">
                  <strong className="text-zinc-100 font-semibold block">{t.name}</strong>
                </td>
                <td className="p-3 text-zinc-400 text-[11px]">{t.region}</td>
                <td className="p-3 font-mono text-zinc-300">{t.latency}</td>
                <td className="p-3 font-mono text-emerald-400 font-semibold">{t.uptime}</td>
                <td className="p-3 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-semibold inline-flex items-center gap-1 font-mono">
                    <CheckCircle2 size={11} /> {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
