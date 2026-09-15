import React, { useState, useRef, useEffect } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Trash2,
  X,
  ShieldAlert,
  Radio,
  UserCheck,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export interface NotificationItem {
  id: string;
  type: "warning" | "success" | "info" | "billing";
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionTab?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    type: "warning",
    title: "TRAI 21:00 IST Cutoff Alert",
    message: "Outbound calling window closes at 21:00 IST. Pacing engine will automatically halt non-emergency trunks.",
    time: "10m ago",
    read: false,
    actionTab: "Compliance",
  },
  {
    id: "notif-2",
    type: "success",
    title: "Carrier PRI Trunk Optimal",
    message: "Airtel PRI SIP Trunk 01 report: 22ms round-trip latency, 0.02% packet loss. MOS audio score 4.4/5.",
    time: "28m ago",
    read: false,
    actionTab: "Admin & Billing",
  },
  {
    id: "notif-3",
    type: "info",
    title: "High Intent Lead Qualified",
    message: "Priya Patel (Kolkata) scored 94% conversion intent. Auto-scheduled follow-up for tomorrow 10:30 AM.",
    time: "1h ago",
    read: false,
    actionTab: "Leads & CRM",
  },
  {
    id: "notif-4",
    type: "billing",
    title: "Wallet Balance Status",
    message: "Live telephony balance: ₹15,480. Auto-recharge safety safeguard configured at ₹2,500 threshold.",
    time: "2h ago",
    read: true,
    actionTab: "Admin & Billing",
  },
];

export function NotificationCenter({
  onNavigate,
}: {
  onNavigate: (tab: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    INITIAL_NOTIFICATIONS
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const clearAll = () => {
    setNotifications([]);
    toast.info("Notifications cleared");
  };

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNotificationClick = (item: NotificationItem) => {
    // mark this item as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (item.actionTab) {
      onNavigate(item.actionTab);
      setIsOpen(false);
    }
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "warning":
        return <ShieldAlert size={16} className="text-amber-400 shrink-0" />;
      case "success":
        return <Radio size={16} className="text-emerald-400 shrink-0" />;
      case "info":
        return <UserCheck size={16} className="text-cyan-400 shrink-0" />;
      case "billing":
        return <CreditCard size={16} className="text-violet-400 shrink-0" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell / Alert trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="icon-button relative hover:text-zinc-100 transition"
        title="Notifications & Telecom Alerts"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white shadow-sm ring-1 ring-zinc-950 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Floating Notifications Tray */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-100">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllAsRead}
                    className="text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1"
                    title="Mark all read"
                  >
                    <CheckCheck size={13} /> Mark read
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-zinc-400 hover:text-rose-400 transition p-1"
                    title="Clear all"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-900">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                <Bell size={24} className="mx-auto mb-2 text-zinc-600" />
                No active notifications. All systems optimal.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-zinc-900/80 transition cursor-pointer group ${
                    !n.read ? "bg-zinc-900/30" : ""
                  }`}
                >
                  <div className="mt-0.5">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs font-semibold truncate ${
                          !n.read ? "text-zinc-100" : "text-zinc-300"
                        }`}
                      >
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {n.time}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {n.message}
                    </p>
                    {n.actionTab && (
                      <div className="mt-2 flex items-center text-[11px] text-violet-400 group-hover:text-violet-300 font-medium">
                        <span>View {n.actionTab}</span>
                        <ChevronRight size={12} className="ml-0.5" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => dismissNotification(n.id, e)}
                    className="text-zinc-600 hover:text-zinc-300 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                    title="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Telecom Trunk Monitor Live</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PRI Trunks Active
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
