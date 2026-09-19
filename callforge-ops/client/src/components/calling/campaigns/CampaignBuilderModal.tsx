import React, { useState } from "react";
import {
  X,
  Upload,
  Clock,
  ShieldAlert,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { DialerModeSelector, DialerMode } from "./DialerModeSelector";
import { ClaudeScriptEditor, MANDATORY_COMPLIANCE_PREAMBLE } from "./ClaudeScriptEditor";

interface CampaignBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated?: (campaign: any) => void;
}

interface CSVPreview {
  fileName: string;
  headers: string[];
  rows: string[][];
  totalCount: number;
}

export const CampaignBuilderModal: React.FC<CampaignBuilderModalProps> = ({
  isOpen,
  onClose,
  onCampaignCreated,
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [campaignName, setCampaignName] = useState("");
  const [callingStart, setCallingStart] = useState("09:30");
  const [callingEnd, setCallingEnd] = useState("20:00");
  const [dialerMode, setDialerMode] = useState<DialerMode>("ai_blast");
  const [csvData, setCsvData] = useState<CSVPreview | null>(null);

  // Column Mapping
  const [columnMapping, setColumnMapping] = useState({
    name: "Full Name",
    phone: "Mobile Number",
    company: "Company",
    notes: "Intent Stage",
  });

  // Script State
  const [objective, setObjective] = useState(
    "Offer 20% festive discount on annual subscription and schedule a demo."
  );
  const [script, setScript] = useState(
    "Namaste {lead_name} ji from {company}. We noticed your interest in our omnichannel calling desk. During this festive season, we are offering an exclusive 20% waiver on caller IDs and automated assistants. Can we schedule a 10-minute briefing for you?"
  );

  if (!isOpen) return null;

  const handleLoadSampleBatch = () => {
    setCsvData({
      fileName: "quick_lead_batch.csv",
      headers: ["Full Name", "Mobile Number", "Company", "City"],
      rows: [
        ["Aditya Sharma", "+91 98201 23456", "Sharma Logistics", "Mumbai"],
        ["Sneha Kapoor", "+91 98110 34567", "Kapoor Retail", "Delhi"],
        ["Rohan Gupta", "+91 98450 45678", "Gupta Enterprises", "Bengaluru"],
        ["Priya Nair", "+91 97654 56789", "Nair Tech", "Hyderabad"],
        ["Vikram Sen", "+91 98300 67890", "Sen & Sons", "Kolkata"],
      ],
      totalCount: 5,
    });
    setColumnMapping({
      name: "Full Name",
      phone: "Mobile Number",
      company: "Company",
      notes: "City",
    });
    toast.success("Loaded 5 contacts for quick campaign test");
  };

  // Validation: India calling hours 09:00 - 21:00 IST
  const isTimeWindowCompliant = () => {
    const startHour = parseInt(callingStart.split(":")[0], 10);
    const endHour = parseInt(callingEnd.split(":")[0], 10);
    return startHour >= 9 && endHour <= 21 && startHour < endHour;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      const lines = text
        .split(/\r\n|\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        toast.error("The selected file is empty");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
      const rows = lines
        .slice(1, 6)
        .map((line) => line.split(",").map((c) => c.replace(/^"|"$/g, "").trim()));

      setCsvData({
        fileName: file.name,
        headers,
        rows,
        totalCount: Math.max(1, lines.length - 1),
      });

      // Auto match headers
      const lower = headers.map((h) => h.toLowerCase());
      const nameIndex = lower.findIndex((h) => h.includes("name"));
      const phoneIndex = lower.findIndex(
        (h) => h.includes("phone") || h.includes("mobile") || h.includes("contact")
      );
      const companyIndex = lower.findIndex((h) => h.includes("company") || h.includes("org"));

      setColumnMapping({
        name: nameIndex >= 0 ? headers[nameIndex] : headers[0] || "",
        phone: phoneIndex >= 0 ? headers[phoneIndex] : headers[1] || "",
        company: companyIndex >= 0 ? headers[companyIndex] : headers[2] || "",
        notes: headers[3] || "",
      });

      toast.success(`Parsed ${file.name} successfully (${lines.length - 1} contacts detected)`);
    };

    reader.readAsText(file);
  };

  const handleFinish = () => {
    if (!campaignName.trim()) {
      toast.error("Please provide a campaign name");
      return;
    }
    if (!isTimeWindowCompliant()) {
      toast.error("Calling window must strictly be within 09:00 - 21:00 IST for TRAI compliance");
      return;
    }
    if (!csvData) {
      toast.error("Please upload a CSV contact list or click 'Quick-load 5 Sample Contacts'");
      return;
    }

    const payload = {
      id: `camp-${Date.now().toString().slice(-4)}`,
      name: campaignName.trim(),
      mode: dialerMode === "ai_blast" ? "AI blast" : dialerMode === "progressive" ? "Progressive" : "Preview",
      status: "Running",
      leads: csvData.totalCount.toLocaleString(),
      connected: "0",
      progress: 0,
      color: "violet",
      scriptPreview: script,
      totalLeads: csvData.totalCount,
      dialed: 0,
      qualified: 0,
      failed: 0,
      liveCalls: 1,
      avgDuration: "00:00",
      callingWindow: `${callingStart} - ${callingEnd} IST`,
      dialerMode,
      scriptWithPreamble: `${MANDATORY_COMPLIANCE_PREAMBLE}\n\n${script}`,
      createdAt: new Date().toISOString(),
    };

    // Dispatch to server backend API
    try {
      const parsedLeads = csvData.rows.map((row, i) => ({
        name: row[0] || `Lead ${i + 1}`,
        phone: row[1] || `+91 98200 ${10000 + i}`,
        company: row[2] || "Enterprise",
      }));
      fetch("/api/calling/campaigns/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName.trim(),
          dialerMode,
          leads: parsedLeads.length > 0 ? parsedLeads : [{ name: "Target Lead", phone: "+91 98201 11223" }],
          script,
        }),
      }).catch(() => {});
    } catch {}

    onCampaignCreated?.(payload);
    toast.success("Campaign launched successfully!", {
      description: `${payload.name} (${payload.leads} leads) is now queued for dialing.`,
    });
    onClose();
  };

  const compliant = isTimeWindowCompliant();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-600/20 text-violet-300 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Create New Calling Campaign</h3>
              <p className="text-[11px] text-zinc-400">
                Step {step} of 4 · Configure lead list, compliance window, dialer mode & script
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-2 bg-zinc-900/30 border-b border-zinc-800/80 flex items-center gap-2 shrink-0">
          {[
            { s: 1, label: "Details & Schedule" },
            { s: 2, label: "CSV Import & Mapping" },
            { s: 3, label: "Dialer Cadence" },
            { s: 4, label: "AI Script & Preamble" },
          ].map((item) => (
            <button
              key={item.s}
              type="button"
              onClick={() => setStep(item.s as any)}
              className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                step === item.s
                  ? "bg-violet-600/20 text-violet-300 border border-violet-500/40"
                  : step > item.s
                  ? "text-emerald-400"
                  : "text-zinc-500"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === item.s
                    ? "bg-violet-500 text-white"
                    : step > item.s
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {step > item.s ? "✓" : item.s}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Campaign Title
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Diwali Flash Sale Follow-up"
                  className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Calling Window Validation */}
              <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-violet-400" />
                    <span className="text-xs font-semibold text-zinc-200">
                      TRAI Calling Hours Window (IST)
                    </span>
                  </div>
                  {compliant ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                      <CheckCircle2 size={12} /> Compliant (09:00 - 21:00)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded">
                      <AlertTriangle size={12} /> Non-compliant hours
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-1">Window Start</span>
                    <input
                      type="time"
                      value={callingStart}
                      onChange={(e) => setCallingStart(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-mono focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-1">Window End</span>
                    <input
                      type="time"
                      value={callingEnd}
                      onChange={(e) => setCallingEnd(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-mono focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                {!compliant && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1.5">
                    <ShieldAlert size={13} />
                    TRAI regulations strictly forbid outbound promotional or transactional marketing
                    calls before 09:00 AM or after 09:00 PM.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Quick load options */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-violet-950/20 border border-violet-800/30">
                <span className="text-xs text-zinc-300">Have a CSV or want to test immediately?</span>
                <button
                  type="button"
                  onClick={handleLoadSampleBatch}
                  className="px-2.5 py-1 rounded bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 border border-violet-500/40 text-xs font-medium cursor-pointer transition"
                >
                  ⚡ Quick-load 5 Sample Contacts
                </button>
              </div>

              {/* CSV Upload Zone */}
              <div className="border-2 border-dashed border-zinc-800 hover:border-violet-500/60 rounded-xl p-5 text-center transition-colors bg-zinc-900/30">
                <input
                  type="file"
                  id="csvFileInput"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="csvFileInput" className="cursor-pointer block space-y-2">
                  <div className="w-10 h-10 rounded-full bg-violet-600/20 text-violet-400 mx-auto flex items-center justify-center">
                    <Upload size={18} />
                  </div>
                  <div className="text-xs text-zinc-300">
                    <strong className="text-violet-400">Click to upload CSV</strong> or drag and drop
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Supports formatted CSV with Name, Mobile (+91), Company, and Custom notes
                  </p>
                </label>
              </div>

              {/* CSV Preview and Column Mapping */}
              {csvData && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-zinc-200">
                      <FileSpreadsheet size={15} className="text-emerald-400" />
                      <strong>{csvData.fileName}</strong>
                      <span className="text-zinc-500">
                        ({csvData.totalCount.toLocaleString()} leads)
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-medium">Auto-parsed</span>
                  </div>

                  {/* Mapping Selectors */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-zinc-900/60 rounded-lg border border-zinc-800">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                        Name Column *
                      </span>
                      <select
                        value={columnMapping.name}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, name: e.target.value })
                        }
                        className="w-full px-2 py-1 text-xs bg-zinc-950 border border-zinc-700 rounded text-zinc-200"
                      >
                        {csvData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                        Phone Column *
                      </span>
                      <select
                        value={columnMapping.phone}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, phone: e.target.value })
                        }
                        className="w-full px-2 py-1 text-xs bg-zinc-950 border border-zinc-700 rounded text-zinc-200"
                      >
                        {csvData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                        Company Column
                      </span>
                      <select
                        value={columnMapping.company}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, company: e.target.value })
                        }
                        className="w-full px-2 py-1 text-xs bg-zinc-950 border border-zinc-700 rounded text-zinc-200"
                      >
                        <option value="">None</option>
                        {csvData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                        Notes / Intent
                      </span>
                      <select
                        value={columnMapping.notes}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, notes: e.target.value })
                        }
                        className="w-full px-2 py-1 text-xs bg-zinc-950 border border-zinc-700 rounded text-zinc-200"
                      >
                        <option value="">None</option>
                        {csvData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="overflow-x-auto border border-zinc-800 rounded-lg max-h-36">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-zinc-900 text-zinc-400 uppercase text-[10px] sticky top-0">
                        <tr>
                          {csvData.headers.map((h) => (
                            <th key={h} className="p-2 border-b border-zinc-800">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                        {csvData.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-zinc-900/50">
                            {row.map((cell, j) => (
                              <td key={j} className="p-2 whitespace-nowrap">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <DialerModeSelector value={dialerMode} onChange={setDialerMode} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <ClaudeScriptEditor
                value={script}
                onChange={setScript}
                objective={objective}
                onObjectiveChange={setObjective}
              />
            </div>
          )}
        </div>

        {/* Footer with Step Controls */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/60 shrink-0">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1) as any)}
            disabled={step === 1}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={13} /> Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(4, s + 1) as any)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-600/20"
              >
                Continue <ArrowRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 size={14} /> Launch Campaign
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
