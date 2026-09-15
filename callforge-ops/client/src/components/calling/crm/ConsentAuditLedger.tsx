import React, { useState } from "react";
import { ShieldCheck, Download, Search, CheckCircle2, ShieldBan, FileText } from "lucide-react";
import { toast } from "sonner";

export interface ConsentRecord {
  id: string;
  phone: string;
  name: string;
  source: string;
  timestamp: string;
  ipAddress: string;
  dltReference: string;
  status: "Verified Opt-in" | "DNC Scrub Blocked";
}

const CONSENT_DATA: ConsentRecord[] = [
  {
    id: "CNS-48901",
    phone: "+91 98203 11482",
    name: "Aarav Mehta",
    source: "Web Inquiry Form (OTP Verified)",
    timestamp: "15 Sep 2026, 14:22 IST",
    ipAddress: "103.21.144.92",
    dltReference: "DLT-PE-1401552890014",
    status: "Verified Opt-in",
  },
  {
    id: "CNS-48902",
    phone: "+91 98110 49301",
    name: "Pooja Sharma",
    source: "Meta Lead Ad (Consent Checkbox)",
    timestamp: "15 Sep 2026, 13:45 IST",
    ipAddress: "49.36.12.18",
    dltReference: "DLT-PE-1401552890014",
    status: "Verified Opt-in",
  },
  {
    id: "CNS-48903",
    phone: "+91 98450 72190",
    name: "Karan Johar",
    source: "Inbound Callback Request",
    timestamp: "15 Sep 2026, 11:10 IST",
    ipAddress: "117.198.88.2",
    dltReference: "DLT-PE-1401552890014",
    status: "Verified Opt-in",
  },
  {
    id: "CNS-48904",
    phone: "+91 98990 48210",
    name: "Amitabh Sen",
    source: "Import List (Scrubbed Against DNC)",
    timestamp: "15 Sep 2026, 09:30 IST",
    ipAddress: "System Scrub",
    dltReference: "DLT-SCRUB-MATCH-FAIL",
    status: "DNC Scrub Blocked",
  },
];

export const ConsentAuditLedger: React.FC = () => {
  const [data, setData] = useState<ConsentRecord[]>(CONSENT_DATA);
  const [search, setSearch] = useState("");

  const filtered = data.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search) ||
      d.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = [
      "Consent ID",
      "Mobile Number",
      "Lead Name",
      "Opt-In Source",
      "Timestamp (IST)",
      "IP Address",
      "DLT Reference",
      "TRAI Status",
    ];
    const rows = filtered.map((r) => [
      r.id,
      r.phone,
      `"${r.name}"`,
      `"${r.source}"`,
      `"${r.timestamp}"`,
      r.ipAddress,
      r.dltReference,
      r.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TRAI_Consent_Audit_Proof_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("TRAI Statutory Consent Ledger Exported to CSV");
  };

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100">TRAI Statutory Consent & Audit Ledger</h3>
            <p className="text-[11px] text-zinc-400">
              Immutable consent evidence & National DNC scrub records for telecom regulator inspection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs">
            <Search size={13} className="text-zinc-500 mr-1.5" />
            <input
              type="text"
              placeholder="Search phone or consent ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-zinc-200 placeholder-zinc-500 focus:outline-none w-44 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/70"
          >
            <Download size={13} /> Export to CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/80 text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b border-zinc-800">
            <tr>
              <th className="p-3">Consent ID</th>
              <th className="p-3">Mobile (+91)</th>
              <th className="p-3">Lead Name</th>
              <th className="p-3">Opt-in Source</th>
              <th className="p-3">Timestamp (IST)</th>
              <th className="p-3">DLT Reference</th>
              <th className="p-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-zinc-900/40">
                <td className="p-3 font-mono text-zinc-400 text-[11px]">{row.id}</td>
                <td className="p-3 font-mono font-semibold text-zinc-100">{row.phone}</td>
                <td className="p-3 font-medium">{row.name}</td>
                <td className="p-3 text-zinc-400 text-[11px]">{row.source}</td>
                <td className="p-3 text-zinc-400 font-mono text-[11px]">{row.timestamp}</td>
                <td className="p-3 font-mono text-[10px] text-zinc-500">{row.dltReference}</td>
                <td className="p-3 text-right">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 font-mono ${
                      row.status === "Verified Opt-in"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : "bg-rose-950 text-rose-300 border border-rose-800"
                    }`}
                  >
                    {row.status === "Verified Opt-in" ? (
                      <CheckCircle2 size={11} />
                    ) : (
                      <ShieldBan size={11} />
                    )}
                    {row.status}
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
