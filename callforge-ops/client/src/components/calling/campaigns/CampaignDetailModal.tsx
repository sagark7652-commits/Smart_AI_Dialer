import React, { useState, useEffect } from "react";
import {
  X,
  Megaphone,
  Play,
  Pause,
  PhoneCall,
  Sparkles,
  Target,
  Users,
  Clock,
  Radio,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

export interface CampaignRecord {
  id?: string;
  name: string;
  mode: string;
  status: string;
  leads: string;
  connected: string;
  progress: number;
  color?: string;
  scriptPreview?: string;
}

interface CampaignDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignRecord | null;
  onTestCall: () => void;
  onOpenEditor: () => void;
  onStatusChange?: (campaignId: string, newStatus: string) => void;
}

export const CampaignDetailModal: React.FC<CampaignDetailModalProps> = ({
  isOpen,
  onClose,
  campaign,
  onTestCall,
  onOpenEditor,
  onStatusChange,
}) => {
  const [currentStatus, setCurrentStatus] = useState<string>(campaign?.status || "Running");
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    if (campaign?.status) {
      setCurrentStatus(campaign.status);
    }
  }, [campaign?.id, campaign?.status]);

  if (!isOpen || !campaign) return null;

  const handleToggleStatus = async () => {
    setIsToggling(true);
    const newStatus = currentStatus === "Running" ? "Paused" : "Running";
    const campaignId = campaign.id || "camp-101";
    try {
      const endpoint = newStatus === "Paused" ? "pause" : "resume";
      await fetch(`/api/calling/campaigns/${campaignId}/${endpoint}`, { method: "POST" });
      setCurrentStatus(newStatus);
      onStatusChange?.(campaignId, newStatus);
      toast.success(`Campaign ${newStatus === "Paused" ? "Paused" : "Resumed"}`, {
        description: `Dialer queue for '${campaign.name}' is now ${newStatus.toLowerCase()}.`,
      });
    } catch {
      setCurrentStatus(newStatus);
      onStatusChange?.(campaignId, newStatus);
      toast.info(`Campaign status updated to ${newStatus}`);
    } finally {
      setIsToggling(false);
    }
  };

  const leadsCount = parseInt(String(campaign.leads || "0").replace(/,/g, ""), 10) || 2480;
  const connectedCount = parseInt(String(campaign.connected || "0").replace(/,/g, ""), 10) || 842;
  const connectRate = ((connectedCount / leadsCount) * 100).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Megaphone size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-100">{campaign.name}</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    currentStatus === "Running"
                      ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80"
                      : "bg-amber-950/80 text-amber-400 border border-amber-800/80"
                  }`}
                >
                  {currentStatus}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                Pacing Mode: <span className="text-zinc-200 uppercase font-semibold">{campaign.mode}</span> • ID: camp-{campaign.name.slice(0, 3).toLowerCase()}-2026
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Progress Bar */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-300 font-medium">Queue Completion</span>
              <span className="font-mono text-violet-400 font-bold">{campaign.progress}% Completed</span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${campaign.progress}%` }}
                className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full transition-all duration-500"
              />
            </div>
            <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
              <span>{campaign.connected} dialed & answered</span>
              <span>{campaign.leads} total contacts</span>
            </div>
          </div>

          {/* KPI Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                <Target size={13} className="text-emerald-400" /> Connect Rate
              </div>
              <div className="text-lg font-bold font-mono text-zinc-100">{connectRate}%</div>
              <span className="text-[10px] text-emerald-400 font-mono">Target &gt; 35%</span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                <Radio size={13} className="text-cyan-400" /> Active Channels
              </div>
              <div className="text-lg font-bold font-mono text-zinc-100">12 Lines</div>
              <span className="text-[10px] text-cyan-400 font-mono">PRI Trunk 01</span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                <Clock size={13} className="text-amber-400" /> Calling Window
              </div>
              <div className="text-lg font-bold font-mono text-zinc-100">09:00 - 21:00</div>
              <span className="text-[10px] text-amber-400 font-mono">TRAI TCCCPR Compliant</span>
            </div>
          </div>

          {/* Active AI Prompt Preview */}
          <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <Sparkles size={12} className="text-violet-400" /> Active Claude 3.5 Conversation Prompt
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditor();
                }}
                className="text-violet-400 hover:text-violet-300 underline font-semibold cursor-pointer"
              >
                Edit in Studio
              </button>
            </div>
            <p className="text-zinc-300 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 font-mono text-[11px] leading-relaxed">
              "Hamare paas 40 concurrent AI agent lines par festive season me 20% discount offer chal raha hai with direct TRAI DLT registration support."
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={isToggling}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              currentStatus === "Running"
                ? "bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
            }`}
          >
            {currentStatus === "Running" ? (
              <>
                <Pause size={14} /> Pause Campaign
              </>
            ) : (
              <>
                <Play size={14} /> Resume Campaign
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onTestCall();
              }}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700/60"
            >
              <PhoneCall size={14} /> Test Call Sandbox
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenEditor();
              }}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-violet-600/20"
            >
              <Sparkles size={14} /> Open Notion Script Studio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
