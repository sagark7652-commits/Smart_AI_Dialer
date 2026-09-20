import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Download,
  Play,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Headphones,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

export interface CDRRecord {
  id: string;
  time: string;
  customerName: string;
  customerPhone: string;
  agentName: string;
  campaign: string;
  duration: string;
  disposition: string;
  cost: string; // e.g. "₹2.40"
  qaScore: number;
  hasRecording: boolean;
  recordingUrl?: string;
  transcript?: Array<{ speaker: string; text: string; time: string }>;
}

export const SAMPLE_CDR_DATA: CDRRecord[] = [];

interface CDRDataTableProps {
  onSelectCallForAudio?: (record: CDRRecord) => void;
  onOpenQAScorecard?: (record: CDRRecord) => void;
}

export const CDRDataTable: React.FC<CDRDataTableProps> = ({
  onSelectCallForAudio,
  onOpenQAScorecard,
}) => {
  const [data, setData] = useState<CDRRecord[]>([]);

  useEffect(() => {
    fetch("/api/calling/cdrs")
      .then((res) => res.json())
      .then((resData) => {
        if (resData && Array.isArray(resData.cdrs)) {
          setData(
            resData.cdrs.map((c: any) => ({
              id: c.id || c.callId,
              time: c.createdAt
                ? new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "Recently",
              customerName: c.customerName,
              customerPhone: c.customerPhone,
              agentName: c.agentName || "AI Voice",
              campaign: c.campaign || "Outbound Dial",
              duration:
                typeof c.durationSeconds === "number"
                  ? `${Math.floor(c.durationSeconds / 60)
                      .toString()
                      .padStart(2, "0")}:${(c.durationSeconds % 60).toString().padStart(2, "0")}`
                  : c.duration || "00:00",
              disposition: c.disposition || c.status || "Completed",
              cost: `₹${(c.costInr || 0).toFixed(2)}`,
              qaScore: c.qaScore || 90,
              hasRecording: !!c.recordingUrl,
              recordingUrl: c.recordingUrl,
              transcript: c.transcript
                ? [{ speaker: "System", text: c.transcript, time: "00:01" }]
                : undefined,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);
  const [query, setQuery] = useState("");
  const [dispoFilter, setDispoFilter] = useState("All");

  const filtered = data.filter((item) => {
    if (dispoFilter !== "All" && item.disposition !== dispoFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        String(item?.customerName || "").toLowerCase().includes(q) ||
        String(item?.customerPhone || "").includes(q) ||
        String(item?.agentName || "").toLowerCase().includes(q) ||
        String(item?.id || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCSV = () => {
    const headers = [
      "CDR ID",
      "Time",
      "Customer Name",
      "Customer Phone",
      "Agent",
      "Campaign",
      "Duration",
      "Disposition",
      "Cost",
      "QA Score",
    ];
    const rows = filtered.map((r) => [
      r.id,
      r.time,
      `"${r.customerName}"`,
      r.customerPhone,
      `"${r.agentName}"`,
      `"${r.campaign}"`,
      r.duration,
      r.disposition,
      r.cost,
      r.qaScore,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cdr_records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CDR data exported to CSV successfully");
  };

  return (
    <div className="space-y-3">
      {/* Search & Filter Bar */}
      <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs flex-1 max-w-sm">
            <Search size={14} className="text-zinc-500 mr-2" />
            <input
              type="text"
              placeholder="Search by CDR ID, Name, Phone, or Agent..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent text-zinc-200 placeholder-zinc-500 focus:outline-none w-full text-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs">
            <Filter size={13} className="text-zinc-500" />
            <select
              value={dispoFilter}
              onChange={(e) => setDispoFilter(e.target.value)}
              className="bg-transparent text-zinc-300 focus:outline-none text-xs"
            >
              <option value="All">All Dispositions</option>
              <option value="Interested">Interested</option>
              <option value="Callback">Callback</option>
              <option value="Not Interested">Not Interested</option>
              <option value="DNC">DNC Scrub</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono">
            {filtered.length} of {data.length} records
          </span>
          <button
            type="button"
            onClick={exportCSV}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
          >
            <Download size={13} /> Export CDR
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/90 text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="p-3">CDR ID</th>
                <th className="p-3">Customer / Lead</th>
                <th className="p-3">Agent & Campaign</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Cost (INR)</th>
                <th className="p-3">Disposition</th>
                <th className="p-3">AI QA</th>
                <th className="p-3 text-right">Recording</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <FileText size={28} className="mx-auto text-zinc-600 mb-2" />
                    <p className="text-xs font-semibold text-zinc-300">No call records found</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Calls placed via softphone or campaigns will appear here in real time.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="p-3 font-mono font-medium text-zinc-400 text-[11px]">{item.id}</td>
                  <td className="p-3">
                    <strong className="text-zinc-100 font-semibold block">{item.customerName}</strong>
                    <span className="text-[11px] text-zinc-400 font-mono">{item.customerPhone}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-zinc-200 block">{item.agentName}</span>
                    <span className="text-[10px] text-violet-400">{item.campaign}</span>
                  </td>
                  <td className="p-3 font-mono text-zinc-200">{item.duration}</td>
                  <td className="p-3 font-mono font-semibold text-zinc-300">{item.cost}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-block font-mono ${
                        item.disposition === "Interested"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : item.disposition === "Callback"
                          ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                          : item.disposition === "DNC"
                          ? "bg-rose-950 text-rose-300 border border-rose-800"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {item.disposition}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => onOpenQAScorecard?.(item)}
                      className="flex items-center gap-1 font-mono font-bold text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      <span>{item.qaScore}%</span>
                      <ShieldCheck size={12} />
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectCallForAudio?.(item)}
                      title="Play call recording & read synchronized transcript"
                      className="px-2.5 py-1 rounded-md bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play size={11} className="fill-violet-300" /> Audio & Transcript
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
