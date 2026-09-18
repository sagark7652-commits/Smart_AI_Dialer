import React, { useState, useEffect } from "react";
import { Shield, Clock, Search, Filter, CheckCircle2, User, Key, RefreshCw } from "lucide-react";

export interface AuditLog {
  id: string;
  action: string;
  user: string;
  ip: string;
  timestamp: string;
  details: string;
  category: "billing" | "security" | "carrier" | "campaign" | "system";
}

export const AuditLogsUI: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchLogs = () => {
    fetch("/api/calling/admin/audit-logs")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.logs) {
          setLogs(data.logs);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter((log) => {
    const matchesCat = selectedCategory === "all" || log.category === selectedCategory;
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.user.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "security":
        return "bg-rose-950/70 border-rose-800 text-rose-300";
      case "billing":
        return "bg-emerald-950/70 border-emerald-800 text-emerald-300";
      case "carrier":
        return "bg-cyan-950/70 border-cyan-800 text-cyan-300";
      case "campaign":
        return "bg-violet-950/70 border-violet-800 text-violet-300";
      default:
        return "bg-zinc-900 border-zinc-800 text-zinc-400";
    }
  };

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
            <Shield size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100">Security Audit Trail & Action Logs</h3>
            <p className="text-[11px] text-zinc-400">
              Immutable ledger of administrative actions, role permissions and trunk alterations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="security">Security & Roles</option>
            <option value="billing">Billing & Wallet</option>
            <option value="carrier">Carrier & Telephony</option>
            <option value="campaign">Campaign Control</option>
          </select>

          <button
            type="button"
            onClick={fetchLogs}
            className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/80 text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b border-zinc-800">
            <tr>
              <th className="p-3">Action</th>
              <th className="p-3">Category</th>
              <th className="p-3">Operator / Actor</th>
              <th className="p-3">Audit Details</th>
              <th className="p-3">IP Address</th>
              <th className="p-3 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-zinc-900/40 transition-colors">
                <td className="p-3 font-semibold text-zinc-200">{log.action}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase font-semibold ${getCategoryBadge(
                      log.category
                    )}`}
                  >
                    {log.category}
                  </span>
                </td>
                <td className="p-3 text-zinc-300 text-[11px]">{log.user}</td>
                <td className="p-3 text-zinc-400 text-[11px] leading-relaxed">{log.details}</td>
                <td className="p-3 font-mono text-zinc-500 text-[10px]">{log.ip}</td>
                <td className="p-3 text-right font-mono text-[10px] text-zinc-400 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
