import React, { useState } from "react";
import {
  X,
  User,
  Shield,
  Key,
  Copy,
  Check,
  Bell,
  Volume2,
  Server,
  Globe,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const [copied, setCopied] = useState(false);
  const [audioChime, setAudioChime] = useState(true);
  const [autoDisposition, setAutoDisposition] = useState(true);

  if (!isOpen) return null;

  const apiKey = "cf_live_98ab77d612e0944cb9128f";

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success("API Key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with avatar */}
        <div className="p-6 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-950 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-violet-600 text-white font-bold text-lg flex items-center justify-center shadow-lg shadow-violet-600/30">
              AM
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Arjun Mehta</h3>
              <p className="text-xs text-zinc-400">arjun.mehta@callforge.io</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Super Admin
                </span>
                <span className="text-[10px] text-zinc-400">Mumbai PBX Cluster</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Details & Settings */}
        <div className="p-6 space-y-4 text-xs">
          {/* Telephony Gateway details */}
          <div className="space-y-2">
            <span className="font-semibold text-zinc-300 uppercase tracking-wider block">
              Telephony Node & Security
            </span>
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-500">Gateway Region</span>
                <span className="font-mono text-zinc-200">ap-south-1 (Mumbai)</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-500">Signaling Protocol</span>
                <span className="font-mono text-emerald-400">SIP over WSS (TLS 1.3)</span>
              </div>
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-500">Media Encryption</span>
                <span className="font-mono text-emerald-400">SRTP (AES_CM_128)</span>
              </div>
            </div>
          </div>

          {/* API Token */}
          <div className="space-y-1.5">
            <span className="font-semibold text-zinc-300 uppercase tracking-wider block">
              Direct Webhook / Calling API Token
            </span>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <Key size={14} className="text-zinc-500 shrink-0" />
              <span className="font-mono text-zinc-300 truncate flex-1">{apiKey}</span>
              <button
                onClick={handleCopy}
                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
                title="Copy Token"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-2 border-t border-zinc-800/80 pt-4">
            <span className="font-semibold text-zinc-300 uppercase tracking-wider block">
              Call Center Preferences
            </span>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/30 border border-zinc-800/60 cursor-pointer">
                <div className="flex items-center gap-2 text-zinc-200">
                  <Volume2 size={15} className="text-violet-400" />
                  <span>Incoming Call Audio Chime</span>
                </div>
                <input
                  type="checkbox"
                  checked={audioChime}
                  onChange={(e) => {
                    setAudioChime(e.target.checked);
                    toast.success(e.target.checked ? "Audio chime enabled" : "Audio chime muted");
                  }}
                  className="accent-violet-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/30 border border-zinc-800/60 cursor-pointer">
                <div className="flex items-center gap-2 text-zinc-200">
                  <Bell size={15} className="text-cyan-400" />
                  <span>Auto-open Wrap-Up Disposition</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoDisposition}
                  onChange={(e) => {
                    setAutoDisposition(e.target.checked);
                    toast.success(e.target.checked ? "Auto-disposition enabled" : "Auto-disposition disabled");
                  }}
                  className="accent-violet-600 rounded"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
          <button
            onClick={() => {
              toast.info("Session refreshed. Active token validated.");
              onClose();
            }}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            Refresh Session
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
