import React, { useState } from "react";
import {
  X,
  Send,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  FileText,
  Calendar,
  Gift,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface WhatsAppFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadName?: string;
  leadPhone?: string;
  disposition?: string;
  onSentSuccess?: () => void;
}

const TEMPLATES = [
  {
    id: "festive_brochure",
    title: "Festive 20% Discount + Product Brochure",
    category: "Interested",
    icon: Gift,
    body: (name: string) =>
      `Namaste ${name || "Ji"}, thank you for taking our call! As discussed, here is the exclusive 20% festive discount on CallForge AI Calling Packs. Download our enterprise brochure & features guide: https://callforge.io/festive-brochure.pdf. Feel free to reply here to schedule a live walkthrough!`,
  },
  {
    id: "slot_reschedule",
    title: "Call Callback & Slot Confirmation",
    category: "Callback",
    icon: Calendar,
    body: (name: string) =>
      `Namaste ${name || "Ji"}, we noticed you were busy when we called. When is a convenient time to reconnect tomorrow? You can also pick a 10-minute demo slot directly on our calendar: https://cal.com/callforge/15min`,
  },
  {
    id: "welcome_onboarding",
    title: "Enterprise Customer Welcome & Setup Kit",
    category: "Converted",
    icon: Sparkles,
    body: (name: string) =>
      `Congratulations ${name || "Ji"}! Your CallForge AI Calling Account is now active. Access your operations console & API keys at https://callforge.io/console. Your dedicated relationship manager is on standby.`,
  },
];

export const WhatsAppFollowUpModal: React.FC<WhatsAppFollowUpModalProps> = ({
  isOpen,
  onClose,
  leadName = "Aarav Mehta",
  leadPhone = "+91 99887 11002",
  disposition = "Interested",
  onSentSuccess,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    disposition === "Converted"
      ? "welcome_onboarding"
      : disposition === "Callback"
      ? "slot_reschedule"
      : "festive_brochure"
  );
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentDone, setSentDone] = useState(false);

  if (!isOpen) return null;

  const currentTemplate =
    TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0];
  const messageBody = customMessage || currentTemplate.body(leadName);

  const handleSend = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/calling/automation/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: leadName,
          recipientPhone: leadPhone,
          templateName: currentTemplate.id,
          body: messageBody,
          disposition,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSentDone(true);
        toast.success(`WhatsApp Message Delivered to ${leadPhone}!`, {
          description: `Template: ${currentTemplate.title}`,
        });
        if (onSentSuccess) onSentSuccess();
      } else {
        toast.error(data.error || "Failed to deliver WhatsApp message");
      }
    } catch {
      toast.error("Network error delivering message");
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSentDone(false);
    setCustomMessage("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <MessageSquare size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">WhatsApp Business Cloud Dispatch</h3>
              <p className="text-[11px] text-zinc-400">
                Send instant post-call brochure, booking link or welcome kit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {sentDone ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 className="text-base font-bold text-zinc-100">Message Delivered Successfully</h4>
              <p className="text-xs text-zinc-400 mt-1">
                Delivered via Meta WhatsApp Business Cloud API to {leadPhone} ({leadName}).
              </p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-left font-mono space-y-1 text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Delivery Status:</span>
                <span className="text-emerald-400 font-bold">SENT & DELIVERED (2 Blue Ticks)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Template ID:</span>
                <span>{currentTemplate.id}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs cursor-pointer transition shadow-lg shadow-emerald-600/30"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4 text-xs">
            {/* Recipient Card */}
            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                  Recipient
                </span>
                <strong className="text-zinc-100 font-semibold text-xs">{leadName}</strong>
                <span className="text-zinc-400 font-mono text-[11px] block">{leadPhone}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                  Call Disposition
                </span>
                <span className="px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-800/60 text-[10px] font-semibold">
                  {disposition}
                </span>
              </div>
            </div>

            {/* Template Selection */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1.5">
                Select Pre-Approved Meta WhatsApp Template
              </label>
              <div className="space-y-1.5">
                {TEMPLATES.map((tmpl) => {
                  const Icon = tmpl.icon;
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(tmpl.id);
                        setCustomMessage("");
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200"
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:bg-zinc-850"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={15} className={isSelected ? "text-emerald-400" : "text-zinc-400"} />
                        <span className="font-semibold text-xs">{tmpl.title}</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase text-zinc-500">
                        {tmpl.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Preview & Edit */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                Message Preview (Editable)
              </label>
              <textarea
                rows={4}
                value={messageBody}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-sans text-xs focus:outline-none focus:border-emerald-500 leading-relaxed resize-none"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                <ShieldCheck size={13} className="text-emerald-400" /> WhatsApp Cloud Verified API
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30 transition active:scale-95"
                >
                  {isSending ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Send WhatsApp Message</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
