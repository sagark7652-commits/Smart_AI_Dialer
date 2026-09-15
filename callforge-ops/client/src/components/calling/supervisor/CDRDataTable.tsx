import React, { useState } from "react";
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

export const SAMPLE_CDR_DATA: CDRRecord[] = [
  {
    id: "CDR-98214",
    time: "Today, 17:15:20",
    customerName: "Anjali Sharma",
    customerPhone: "+91 98765 14482",
    agentName: "Asha (AI Voice Agent)",
    campaign: "Festive season follow-up",
    duration: "04:32",
    disposition: "Interested",
    cost: "₹3.80",
    qaScore: 92,
    hasRecording: true,
    recordingUrl: "https://actions.google.com/sounds/v1/ambiences/office_cubicle_background.ogg",
    transcript: [
      {
        speaker: "Asha (AI)",
        text: "Namaste Anjali ji. This is Asha calling on a recorded line from CallForge regarding your enquiry.",
        time: "00:02",
      },
      {
        speaker: "Customer",
        text: "Haan Asha ji, hum festive season ke liye bulk automated calling setup dekh rahe the.",
        time: "00:12",
      },
      {
        speaker: "Asha (AI)",
        text: "Bahut badhiya. Hamara festive package 40 concurrent AI lines support karta hai with zero server setup.",
        time: "00:24",
      },
      {
        speaker: "Customer",
        text: "Great, please schedule a demo for tomorrow 11 AM.",
        time: "00:45",
      },
    ],
  },
  {
    id: "CDR-98213",
    time: "Today, 16:58:10",
    customerName: "Rakesh Kumar",
    customerPhone: "+91 98110 29310",
    agentName: "Kabir (Renewal Specialist)",
    campaign: "Enterprise renewal desk",
    duration: "02:18",
    disposition: "Callback",
    cost: "₹1.90",
    qaScore: 71,
    hasRecording: true,
    recordingUrl: "https://actions.google.com/sounds/v1/ambiences/office_cubicle_background.ogg",
    transcript: [
      {
        speaker: "Kabir",
        text: "Hello Mr. Kumar, calling regarding your enterprise license renewal due this month.",
        time: "00:04",
      },
      {
        speaker: "Customer",
        text: "I am currently in a meeting, please call me back on Friday.",
        time: "00:15",
      },
    ],
  },
  {
    id: "CDR-98212",
    time: "Today, 16:42:04",
    customerName: "Priya Menon",
    customerPhone: "+91 98470 82216",
    agentName: "Asha (AI Voice Agent)",
    campaign: "Festive season follow-up",
    duration: "01:04",
    disposition: "Interested",
    cost: "₹0.95",
    qaScore: 86,
    hasRecording: true,
    recordingUrl: "https://actions.google.com/sounds/v1/ambiences/office_cubicle_background.ogg",
  },
  {
    id: "CDR-98211",
    time: "Today, 16:21:44",
    customerName: "Vikram Shah",
    customerPhone: "+91 98203 55180",
    agentName: "Meera (Demo Concierge)",
    campaign: "Festive season follow-up",
    duration: "00:48",
    disposition: "Not Interested",
    cost: "₹0.48",
    qaScore: 80,
    hasRecording: true,
  },
  {
    id: "CDR-98210",
    time: "Today, 15:55:30",
    customerName: "Amitabh Sen",
    customerPhone: "+91 98990 48210",
    agentName: "Asha (AI Voice Agent)",
    campaign: "Festive season follow-up",
    duration: "00:32",
    disposition: "DNC",
    cost: "₹0.32",
    qaScore: 94,
    hasRecording: true,
  },
];

interface CDRDataTableProps {
  onSelectCallForAudio?: (record: CDRRecord) => void;
  onOpenQAScorecard?: (record: CDRRecord) => void;
}

export const CDRDataTable: React.FC<CDRDataTableProps> = ({
  onSelectCallForAudio,
  onOpenQAScorecard,
}) => {
  const [data, setData] = useState<CDRRecord[]>(SAMPLE_CDR_DATA);
  const [query, setQuery] = useState("");
  const [dispoFilter, setDispoFilter] = useState("All");

  const filtered = data.filter((item) => {
    if (dispoFilter !== "All" && item.disposition !== dispoFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        item.customerName.toLowerCase().includes(q) ||
        item.customerPhone.includes(q) ||
        item.agentName.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
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
              {filtered.map((item) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
