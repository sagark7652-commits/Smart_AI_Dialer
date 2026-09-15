import React, { useState } from "react";
import { Shield, Check, Lock, Save, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Permission {
  id: string;
  name: string;
  description: string;
}

const PERMISSIONS: Permission[] = [
  {
    id: "view_billing",
    name: "View Telephony Billing & Spend Ledger",
    description: "Access to burn rates, wallet balance, and auto-recharge settings.",
  },
  {
    id: "start_campaigns",
    name: "Launch, Pause & Delete Campaigns",
    description: "Permission to upload CSV lead files and control dialer pace.",
  },
  {
    id: "barge_whisper",
    name: "Barge-In & Whisper Active Calls",
    description: "Audio bridge privileges to join or coach on live WebRTC streams.",
  },
  {
    id: "export_cdr",
    name: "Export Raw CDR & Call Recordings",
    description: "Download decrypted audio files and CSV compliance records.",
  },
  {
    id: "edit_script",
    name: "Modify AI Prompts & Knowledge Base",
    description: "Edit agent conversation scripts, guidelines, and objection handling.",
  },
  {
    id: "override_qa",
    name: "Override AI QA Scorecards",
    description: "Manually adjust quality ratings, compliance audits, and star scores.",
  },
];

type RoleMatrix = Record<string, Record<string, boolean>>;

export const RoleManagementUI: React.FC = () => {
  const [matrix, setMatrix] = useState<RoleMatrix>({
    admin: {
      view_billing: true,
      start_campaigns: true,
      barge_whisper: true,
      export_cdr: true,
      edit_script: true,
      override_qa: true,
    },
    supervisor: {
      view_billing: false,
      start_campaigns: true,
      barge_whisper: true,
      export_cdr: true,
      edit_script: true,
      override_qa: true,
    },
    agent: {
      view_billing: false,
      start_campaigns: false,
      barge_whisper: false,
      export_cdr: false,
      edit_script: false,
      override_qa: false,
    },
  });

  const togglePermission = (role: string, permId: string) => {
    if (role === "admin" && permId === "view_billing") {
      toast.error("Admin must always retain billing permissions");
      return;
    }
    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permId]: !prev[role]?.[permId],
      },
    }));
  };

  const handleSave = () => {
    toast.success("Role & RBAC Permissions Updated", {
      description: "Permission matrix enforced across all operator sessions.",
    });
  };

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center">
            <Shield size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100">Role-Based Access Control (RBAC)</h3>
            <p className="text-[11px] text-zinc-400">
              Control capability matrix across Admins, Supervisors, and Floor Calling Agents
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-600/20"
        >
          <Save size={13} /> Save Access Matrix
        </button>
      </div>

      {/* Matrix Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/80 text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b border-zinc-800">
            <tr>
              <th className="p-3">Platform Capability</th>
              <th className="p-3 text-center w-28">Admin</th>
              <th className="p-3 text-center w-28">Supervisor</th>
              <th className="p-3 text-center w-28">Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {PERMISSIONS.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-900/40 transition-colors">
                <td className="p-3">
                  <strong className="text-zinc-100 font-semibold block">{p.name}</strong>
                  <span className="text-[11px] text-zinc-400">{p.description}</span>
                </td>

                {["admin", "supervisor", "agent"].map((role) => {
                  const isChecked = !!matrix[role]?.[p.id];
                  return (
                    <td key={role} className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => togglePermission(role, p.id)}
                        className={`w-5 h-5 rounded flex items-center justify-center mx-auto transition-colors cursor-pointer ${
                          isChecked
                            ? "bg-violet-600 text-white"
                            : "bg-zinc-800 text-transparent border border-zinc-700 hover:border-zinc-500"
                        }`}
                      >
                        <Check size={12} className={isChecked ? "block" : "hidden"} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
