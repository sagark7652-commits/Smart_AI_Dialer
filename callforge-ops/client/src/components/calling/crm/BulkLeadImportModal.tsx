import React, { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Users,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface BulkLeadImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

interface ParsedRow {
  name: string;
  phone: string;
  company: string;
  source: string;
  stage: string;
  score: number;
}

export const BulkLeadImportModal: React.FC<BulkLeadImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDownloadSample = () => {
    const sampleCsv = `Name,Phone,Company,Source,Stage,Score
Sunil Gavaskar,+91 98201 12345,Sunny Sports Ltd,Website Inbound,Interested,88
Smriti Mandhana,+91 97654 67890,Smriti Apparel,Meta Ads Form,Callback,75
Rohit Verma,+91 98990 11223,Hitman Logistics,Referral,New,65
Deepika Padukone,+91 98731 44556,Live Love Laugh,Direct Inquiry,Converted,95
Ratan Tata,+91 98203 77889,Bombay House,Enterprise Import,Interested,92`;

    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "CallForge_Leads_Template.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded sample leads template (.csv)");
  };

  const parseCSVText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      toast.error("CSV file must contain a header row and at least one lead.");
      return;
    }

    const rows: ParsedRow[] = [];
    // skip header row
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length >= 2 && parts[1]) {
        rows.push({
          name: parts[0] || "Enterprise Lead",
          phone: parts[1],
          company: parts[2] || "Direct Business",
          source: parts[3] || "Bulk CSV Upload",
          stage: parts[4] || "New",
          score: Number(parts[5]) || 70,
        });
      }
    }

    setParsedRows(rows);
    toast.info(`Parsed ${rows.length} valid lead rows from CSV`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) parseCSVText(text);
    };
    reader.readAsText(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) parseCSVText(text);
    };
    reader.readAsText(f);
  };

  const handleUploadToDatabase = async () => {
    if (parsedRows.length === 0) return;
    setIsUploading(true);

    try {
      const res = await fetch("/api/calling/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: parsedRows }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Successfully Imported ${data.added} leads into database! (Total: ${data.total})`
        );
        if (onImportSuccess) onImportSuccess();
        onClose();
      } else {
        toast.error(data.error || "Failed to import leads");
      }
    } catch {
      toast.error("Network error during bulk import");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Bulk CSV Lead Ingestion</h3>
              <p className="text-[11px] text-zinc-400">
                Upload 1,000+ customer contacts with deduplication & scoring
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/60 bg-zinc-900/40 hover:bg-zinc-900/70 p-6 rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <UploadCloud size={24} />
            </div>
            <div>
              <p className="font-semibold text-zinc-200 text-xs">
                {file ? file.name : "Click to select or drag and drop a CSV file"}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Supports .csv and .txt with Name, Phone, Company, Source columns
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Need a starting format?</span>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer underline"
            >
              <Download size={13} /> Download Sample CSV
            </button>
          </div>

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-300">
                  Preview ({parsedRows.length} Leads Ready)
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  Deduplication Filter Active
                </span>
              </div>

              <div className="border border-zinc-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[9px] font-mono sticky top-0">
                    <tr>
                      <th className="p-2">Name</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">Company</th>
                      <th className="p-2">Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300 font-mono">
                    {parsedRows.slice(0, 8).map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/40">
                        <td className="p-2 font-sans font-medium text-zinc-200">{row.name}</td>
                        <td className="p-2 text-emerald-400">{row.phone}</td>
                        <td className="p-2 font-sans text-zinc-400">{row.company}</td>
                        <td className="p-2">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[9px]">
                            {row.stage}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 8 && (
                <p className="text-[10px] text-zinc-500 text-center">
                  + {parsedRows.length - 8} more leads in batch
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between shrink-0">
          <span className="text-xs text-zinc-400">
            {parsedRows.length > 0 ? `${parsedRows.length} contacts selected` : "No file loaded"}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUploadToDatabase}
              disabled={parsedRows.length === 0 || isUploading}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/25 transition active:scale-95"
            >
              {isUploading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Ingesting...</span>
                </>
              ) : (
                <>
                  <Users size={13} />
                  <span>Import {parsedRows.length} Leads</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
