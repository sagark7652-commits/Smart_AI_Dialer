import React from "react";
import {
  X,
  Phone,
  User,
  Building,
  MapPin,
  Sparkles,
  History,
  ArrowUpRight,
  ShieldCheck,
  Headphones,
} from "lucide-react";
import { toast } from "sonner";

export interface ScreenPopLead {
  name: string;
  phone: string;
  company: string;
  city: string;
  intentScore: number;
  intentSummary: string;
  source: string;
  lastCall: string;
  lastOutcome: string;
  assignedCampaign: string;
  dncStatus: "Verified Clean" | "Warning" | "Exempt";
}

interface ScreenPopCardProps {
  isOpen: boolean;
  onClose: () => void;
  lead?: ScreenPopLead;
  onTransfer?: () => void;
  onOpenProfile?: (lead: ScreenPopLead) => void;
}

export const ScreenPopCard: React.FC<ScreenPopCardProps> = ({
  isOpen,
  onClose,
  lead = {
    name: "Anjali Sharma",
    phone: "+91 98765 14482",
    company: "Sharma Retail Mart Pvt Ltd",
    city: "Mumbai, Maharashtra",
    intentScore: 92,
    intentSummary: "Requested annual pricing for 12 storefronts during Meta Ads lead campaign.",
    source: "Inbound Callback Queue",
    lastCall: "Yesterday, 16:30",
    lastOutcome: "Call back today at 11am",
    assignedCampaign: "Festive season follow-up",
    dncStatus: "Verified Clean",
  },
  onTransfer,
  onOpenProfile,
}) => {
  if (!isOpen) return null;

  const initials = lead?.name
    ? lead.name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CF";

  return (
    <div className="fixed top-16 left-3 right-3 sm:left-auto sm:right-5 sm:w-96 z-50 bg-zinc-950 border border-violet-500/60 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-right-8 duration-200">
      {/* Header with Ringing Badge */}
      <div className="p-4 bg-gradient-to-r from-violet-950/70 via-zinc-900/90 to-zinc-900 border-b border-zinc-800 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-violet-600/30 text-violet-300 flex items-center justify-center font-bold text-sm border border-violet-500/40">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> CTI Screen Pop
              </span>
            </div>
            <h4 className="text-sm font-bold text-zinc-100 mt-0.5">{lead.name}</h4>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body Content */}
      <div className="p-4 space-y-3.5 text-xs">
        {/* Contact Quick Info */}
        <div className="space-y-1.5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-300">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Phone size={13} className="text-violet-400" /> Phone:
            </span>
            <span className="font-mono font-semibold text-zinc-100">{lead.phone}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-300">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Building size={13} className="text-cyan-400" /> Company:
            </span>
            <span className="font-medium text-zinc-200">{lead.company}</span>
          </div>
          <div className="flex items-center justify-between text-zinc-300">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <MapPin size={13} className="text-amber-400" /> Location:
            </span>
            <span className="text-zinc-300">{lead.city}</span>
          </div>
        </div>

        {/* AI Briefing Note */}
        <div className="p-3 rounded-lg bg-violet-950/20 border border-violet-800/30 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1">
              <Sparkles size={12} /> AI Live Briefing
            </span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40">
              Score {lead.intentScore}/100
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed italic">
            “{lead.intentSummary}”
          </p>
        </div>

        {/* History & Compliance */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
            <span className="text-[9px] uppercase text-zinc-500 font-bold block mb-0.5">
              Last Interaction
            </span>
            <span className="text-zinc-200 font-medium block">{lead.lastCall}</span>
            <span className="text-zinc-400 text-[10px]">{lead.lastOutcome}</span>
          </div>
          <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
            <span className="text-[9px] uppercase text-zinc-500 font-bold block mb-0.5">
              TRAI DNC Scrub
            </span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck size={12} /> {lead.dncStatus}
            </span>
            <span className="text-zinc-400 text-[10px]">TCCCPR Registered</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-2 flex items-center gap-2 border-t border-zinc-800">
          <button
            type="button"
            onClick={() => {
              if (onOpenProfile) {
                onOpenProfile(lead);
              } else {
                toast.info(`Opening ${lead.name}'s complete CRM timeline`);
              }
            }}
            className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <History size={12} /> Full CRM Profile <ArrowUpRight size={12} />
          </button>

          <button
            type="button"
            onClick={() => {
              onTransfer?.();
              toast.success("Call transfer initiated to senior queue");
            }}
            className="py-1.5 px-2.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Headphones size={12} /> Warm Transfer
          </button>
        </div>
      </div>
    </div>
  );
};
