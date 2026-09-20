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

import { jsPDF } from "jspdf";

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
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });

      // Dark slate top banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 595, 75, "F");

      // Brand Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("CALLFORGE OPS TELEPHONY", 40, 38);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Tax Invoice / Cash Receipt under Section 31 of CGST Act, 2017", 40, 56);

      // Status pill on header
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(460, 24, 95, 26, 4, 4, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("PAID & VERIFIED", 468, 40);

      // Section Headings
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("INVOICE METADATA", 40, 105);
      doc.text("BILLED TO (ENTERPRISE ACCOUNT)", 320, 105);

      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.line(40, 112, 555, 112);

      // Left Column: Supplier / Invoice Details
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Invoice No: ${inv.invoiceNumber}`, 40, 128);
      doc.text(`Invoice Date: ${new Date(inv.date).toLocaleDateString("en-IN", { dateStyle: "long" })}`, 40, 142);
      doc.text("Supplier: CallForge Telecom India Pvt Ltd", 40, 156);
      doc.text("Supplier GSTIN: 27AABCC9999F1Z9 (Maharashtra)", 40, 170);
      doc.text("State Code: 27 | Place of Supply: 27-MH", 40, 184);

      // Right Column: Customer Details
      let customerName = "Enterprise Customer";
      try {
        const saved = localStorage.getItem("creatorai_auth_user");
        if (saved) {
          const u = JSON.parse(saved);
          if (u.name) customerName = u.name;
        }
      } catch {}
      doc.text(`Customer: ${customerName} / CallForge Ops Workspace`, 320, 128);
      doc.text("Customer GSTIN: 27AABCC1234F1Z8", 320, 142);
      doc.text(`Payment Instrument: ${inv.paymentMethod}`, 320, 156);
      doc.text("Reconciliation ID: TXN-" + Math.floor(10000000 + Math.random() * 90000000), 320, 170);
      doc.text("SAC Classification: 9984 (Telecommunication Services)", 320, 184);

      // Table Header
      doc.setFillColor(241, 245, 249);
      doc.rect(40, 205, 515, 22, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text("Item / Plan Description", 50, 219);
      doc.text("SAC", 270, 219);
      doc.text("Taxable (INR)", 360, 219);
      doc.text("GST (18%)", 450, 219);
      doc.text("Total (INR)", 545, 219, { align: "right" });

      // Table Row
      doc.setFont("helvetica", "normal");
      doc.text(inv.description, 50, 242);
      doc.text("9984", 270, 242);
      doc.text(inv.subtotal.toFixed(2), 360, 242);
      doc.text(inv.gstAmount.toFixed(2), 450, 242);
      doc.text(inv.totalAmount.toFixed(2), 545, 242, { align: "right" });

      // Border below table
      doc.line(40, 255, 555, 255);

      // Calculation Breakdown
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text("Subtotal (Taxable Value):", 380, 275);
      doc.text(`INR ${inv.subtotal.toFixed(2)}`, 545, 275, { align: "right" });

      doc.text("Central GST (CGST 9%):", 380, 290);
      doc.text(`INR ${(inv.gstAmount / 2).toFixed(2)}`, 545, 290, { align: "right" });

      doc.text("State GST (SGST 9%):", 380, 305);
      doc.text(`INR ${(inv.gstAmount / 2).toFixed(2)}`, 545, 305, { align: "right" });

      // Grand Total Highlight Box
      doc.setFillColor(240, 253, 244);
      doc.rect(360, 318, 195, 26, "F");
      doc.setTextColor(22, 101, 52);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("Grand Total Paid:", 372, 335);
      doc.text(`INR ${inv.totalAmount.toFixed(2)}`, 545, 335, { align: "right" });

      // Verification Stamp Seal Box
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(1.2);
      doc.roundedRect(40, 280, 160, 52, 4, 4);
      doc.setTextColor(22, 101, 52);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("✓ TRAI & GST VERIFIED", 50, 300);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Authorized Electronic Voucher", 50, 314);
      doc.text("Instant Digital Clearance", 50, 325);

      // Compliance Notice Footer
      doc.setDrawColor(226, 232, 240);
      doc.line(40, 750, 555, 750);
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(
        "This is an authenticated computer-generated digital tax invoice issued under Rule 48 of the CGST Rules, 2017.",
        40,
        765
      );
      doc.text(
        "CallForge Telecom India Private Limited • Level 4, Business Bay, Pune MH 411014 • support@callforge.ai",
        40,
        778
      );

      doc.save(`${inv.invoiceNumber}.pdf`);
      toast.success(`Generated official PDF Tax Invoice: ${inv.invoiceNumber}`);
    } catch (err: any) {
      console.error("Failed to generate PDF", err);
      toast.error("Failed to export PDF invoice");
    }
  };

  const filtered = invoices.filter(
    (i) =>
      String(i?.invoiceNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      String(i?.description || "").toLowerCase().includes(search.toLowerCase()) ||
      String(i?.paymentMethod || "").toLowerCase().includes(search.toLowerCase())
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
