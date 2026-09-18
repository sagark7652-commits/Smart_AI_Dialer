import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ExternalLink,
  Receipt,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  description: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  status: "paid" | "pending";
  paymentMethod: string;
}

export const InvoicesTable: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchInvoices = () => {
    fetch("/api/calling/billing/invoices")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.invoices) {
          setInvoices(data.invoices);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleDownloadInvoice = (inv: InvoiceRecord) => {
    // Generate text/csv formatted GST receipt and trigger download
    const invoiceContent = `=====================================================
CALLFORGE OPS TELEPHONY - TAX INVOICE
=====================================================
Invoice Number : ${inv.invoiceNumber}
Date           : ${new Date(inv.date).toLocaleDateString("en-IN", { dateStyle: "long" })}
GSTIN Seller   : 27AABCC9999F1Z9 (CallForge Telecom India)
GSTIN Buyer    : 27AABCC1234F1Z8 (Arjun's Workspace)
-----------------------------------------------------
Item Description:
${inv.description}

Subtotal (Pre-Tax)  : INR ${inv.subtotal.toFixed(2)}
IGST / CGST+SGST 18%: INR ${inv.gstAmount.toFixed(2)}
-----------------------------------------------------
TOTAL AMOUNT PAID   : INR ${inv.totalAmount.toFixed(2)}
Payment Mode        : ${inv.paymentMethod}
Payment Status      : SUCCESS / PAID
-----------------------------------------------------
This is a computer-generated tax invoice compliant 
with Section 31 of CGST Act 2017.
=====================================================`;

    const blob = new Blob([invoiceContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${inv.invoiceNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded Tax Invoice ${inv.invoiceNumber}`);
  };

  const filtered = invoices.filter(
    (i) =>
      i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase()) ||
      i.paymentMethod.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
            <Receipt size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100">Tax Invoices & Prepaid Recharge Ledger</h3>
            <p className="text-[11px] text-zinc-400">
              Download GST-compliant monthly invoices, e-mandates & top-up receipts
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice or ref..."
              className="pl-7 pr-3 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 w-44 sm:w-56"
            />
          </div>
          <button
            type="button"
            onClick={fetchInvoices}
            className="px-2.5 py-1 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition cursor-pointer"
            title="Refresh Invoices"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/80 text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b border-zinc-800">
            <tr>
              <th className="p-3">Invoice #</th>
              <th className="p-3">Date</th>
              <th className="p-3">Description</th>
              <th className="p-3">Payment Mode</th>
              <th className="p-3 text-right">Amount (Incl. GST)</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500 text-xs">
                  {loading ? "Loading invoices..." : "No invoices found"}
                </td>
              </tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="p-3 font-mono font-semibold text-zinc-200">
                    {inv.invoiceNumber}
                  </td>
                  <td className="p-3 text-zinc-400 text-[11px]">
                    {new Date(inv.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="p-3 text-zinc-200">{inv.description}</td>
                  <td className="p-3 text-zinc-400 text-[11px] font-medium">{inv.paymentMethod}</td>
                  <td className="p-3 text-right font-mono font-bold text-zinc-100">
                    ₹{inv.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-semibold inline-flex items-center gap-1 font-mono">
                      <CheckCircle2 size={11} /> Paid
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoice(inv)}
                      className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium inline-flex items-center gap-1 transition cursor-pointer"
                      title="Download GST Receipt"
                    >
                      <Download size={12} />
                      <span>PDF/TXT</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
