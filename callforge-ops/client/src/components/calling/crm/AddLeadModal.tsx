import React, { useState } from "react";
import { X, UserPlus, Phone, Building, Layers, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LeadRecord } from "./LeadDetailsDrawer";

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLead: (lead: LeadRecord) => void;
}

export function AddLeadModal({ isOpen, onClose, onAddLead }: AddLeadModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+91 ");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("Inbound");
  const [stage, setStage] = useState("New");
  const [score, setScore] = useState(82);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide lead full name");
      return;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      toast.error("Please enter a valid phone number (+91 E.164)");
      return;
    }

    const newLead: LeadRecord = {
      name: name.trim(),
      phone: phone.trim(),
      company: company.trim() || "Independent",
      source,
      stage,
      score,
      last: "Just now",
      notes: [`Lead created manually on ${new Date().toLocaleDateString()}`],
    };

    onAddLead(newLead);
    toast.success(`Lead "${name}" added to CRM and ready for dialing!`);
    setName("");
    setPhone("+91 ");
    setCompany("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Add New Contact / Lead</h3>
              <p className="text-[11px] text-zinc-400">Directly register to campaign queue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kulkarni"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                Phone Number *
              </label>
              <input
                type="text"
                required
                placeholder="+91 98200 12345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-mono text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                Company / Organization
              </label>
              <input
                type="text"
                placeholder="e.g. Tata Motors"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
              >
                <option value="Inbound">Inbound IVR</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Meta Ads">Meta Ads</option>
                <option value="Outbound">Outbound Dialer</option>
                <option value="Web Form">Web Form</option>
                <option value="Referral">Partner Referral</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-1.5">
                Pipeline Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
              >
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Qualified">Qualified</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Predicted AI Intent Score
              </label>
              <span className="text-xs font-bold text-violet-400 font-mono">{score}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="99"
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full accent-violet-500 cursor-pointer"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-lg shadow-violet-600/20"
            >
              <UserPlus size={14} /> Add to Contacts
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
