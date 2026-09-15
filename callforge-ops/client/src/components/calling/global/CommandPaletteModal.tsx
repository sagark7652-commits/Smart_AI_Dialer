import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  ArrowRight,
  Phone,
  Plus,
  FileText,
  Activity,
  Radio,
  Settings,
  Shield,
  LayoutDashboard,
  Users,
  Megaphone,
  Headphones,
  Sliders,
  Sparkles,
  X,
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onNewCampaign: () => void;
  onNewLead: () => void;
  onExportReport: () => void;
  onOpenSoftphone: () => void;
  onShowHelp: () => void;
}

interface ActionItem {
  id: string;
  category: "Navigation" | "Actions" | "Telephony";
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  action: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  onNavigate,
  onNewCampaign,
  onNewLead,
  onExportReport,
  onOpenSoftphone,
  onShowHelp,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Close on Escape or shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
          setSelectedIndex(0);
        }
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const items: ActionItem[] = useMemo(
    () => [
      // Navigation
      {
        id: "nav-overview",
        category: "Navigation",
        title: "Go to Overview",
        subtitle: "Operations KPI dashboard & pacing controls",
        icon: LayoutDashboard,
        action: () => {
          onNavigate("Overview");
          onClose();
        },
      },
      {
        id: "nav-campaigns",
        category: "Navigation",
        title: "Go to Campaigns",
        subtitle: "Active outbound dialer runs & schedules",
        icon: Megaphone,
        action: () => {
          onNavigate("Campaigns");
          onClose();
        },
      },
      {
        id: "nav-workspace",
        category: "Navigation",
        title: "Go to Agent Workspace",
        subtitle: "WebRTC softphone, CTI screen pop & wrap-up",
        icon: Headphones,
        action: () => {
          onNavigate("Agent Workspace");
          onClose();
        },
      },
      {
        id: "nav-leads",
        category: "Navigation",
        title: "Go to Leads & CRM",
        subtitle: "Contact records & click-to-call directory",
        icon: Users,
        action: () => {
          onNavigate("Leads & CRM");
          onClose();
        },
      },
      {
        id: "nav-voices",
        category: "Navigation",
        title: "Go to AI Voice Studio",
        subtitle: "Indian neural voices & latency tuning",
        icon: Radio,
        action: () => {
          onNavigate("AI Voice Studio");
          onClose();
        },
      },
      {
        id: "nav-wallboard",
        category: "Navigation",
        title: "Go to Live Wallboard",
        subtitle: "Supervisor real-time floor monitoring",
        icon: Activity,
        action: () => {
          onNavigate("Live Floor");
          onClose();
        },
      },
      {
        id: "nav-cdrs",
        category: "Navigation",
        title: "Go to Call Logs (CDR)",
        subtitle: "Historical recordings, transcripts & QA scores",
        icon: FileText,
        action: () => {
          onNavigate("Call Logs");
          onClose();
        },
      },
      {
        id: "nav-ivr",
        category: "Navigation",
        title: "Go to IVR Designer",
        subtitle: "Visual inbound telephony dialplan tree",
        icon: Sliders,
        action: () => {
          onNavigate("IVR Designer");
          onClose();
        },
      },
      {
        id: "nav-compliance",
        category: "Navigation",
        title: "Go to Compliance & DNC",
        subtitle: "TRAI 09:00–21:00 calling ledger & consent logs",
        icon: Shield,
        action: () => {
          onNavigate("Compliance");
          onClose();
        },
      },
      {
        id: "nav-admin",
        category: "Navigation",
        title: "Go to Admin & Billing",
        subtitle: "Carrier trunk wallet, ping tests & RBAC",
        icon: Settings,
        action: () => {
          onNavigate("Admin & Billing");
          onClose();
        },
      },

      // Quick Actions
      {
        id: "act-new-campaign",
        category: "Actions",
        title: "Launch New Campaign",
        subtitle: "Upload CSV leads and configure dialer mode",
        icon: Plus,
        action: () => {
          onClose();
          onNewCampaign();
        },
      },
      {
        id: "act-new-lead",
        category: "Actions",
        title: "Create New Lead Record",
        subtitle: "Add contact directly to CRM directory",
        icon: Plus,
        action: () => {
          onClose();
          onNewLead();
        },
      },
      {
        id: "act-export",
        category: "Actions",
        title: "Export Daily Executive Report (CSV)",
        subtitle: "Download platform KPI & spend summary",
        icon: FileText,
        action: () => {
          onClose();
          onExportReport();
        },
      },
      {
        id: "act-help",
        category: "Actions",
        title: "Open Help & Telephony Docs",
        subtitle: "Guides, keyboard shortcuts & support",
        icon: Sparkles,
        action: () => {
          onClose();
          onShowHelp();
        },
      },

      // Telephony
      {
        id: "tel-softphone",
        category: "Telephony",
        title: "Open WebRTC Softphone",
        subtitle: "Manual dialpad, hold & audio controls",
        icon: Phone,
        action: () => {
          onClose();
          onOpenSoftphone();
        },
      },
    ],
    [
      onNavigate,
      onNewCampaign,
      onNewLead,
      onExportReport,
      onOpenSoftphone,
      onShowHelp,
      onClose,
    ]
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? filteredItems.length - 1 : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-zinc-800 gap-3 bg-zinc-900/50">
          <Search size={18} className="text-zinc-400 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command, page name, or action... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-sm text-zinc-100 placeholder:text-zinc-500"
          />
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-800/60 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results list */}
        <div className="overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-sm text-zinc-500">
              No matching commands or pages found.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition group ${
                    isSelected
                      ? "bg-violet-600/20 text-violet-200 border border-violet-500/30"
                      : "text-zinc-300 hover:bg-zinc-900 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-md ${
                        isSelected
                          ? "bg-violet-500/30 text-violet-300"
                          : "bg-zinc-800/80 text-zinc-400 group-hover:text-zinc-200"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-medium leading-tight">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-xs text-zinc-400 truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-400">
                      {item.category}
                    </span>
                    <ArrowRight
                      size={14}
                      className={`transition ${
                        isSelected
                          ? "text-violet-400 translate-x-0.5"
                          : "text-zinc-600 opacity-0 group-hover:opacity-100"
                      }`}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-300 font-mono text-[10px]">
                ↑↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-300 font-mono text-[10px]">
                ↵
              </kbd>{" "}
              Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-300 font-mono text-[10px]">
                Esc
              </kbd>{" "}
              Close
            </span>
          </div>
          <span className="font-mono text-violet-400">CallForge Ops Quick Bar</span>
        </div>
      </div>
    </div>
  );
}
