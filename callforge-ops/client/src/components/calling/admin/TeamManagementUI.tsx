import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Phone,
  Mail,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "supervisor" | "agent";
  status: "active" | "invited" | "suspended";
  extension: string;
  joinedAt: string;
  avatarInitials: string;
}

export const TeamManagementUI: React.FC = () => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "supervisor" | "agent">("agent");
  const [extension, setExtension] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTeam = () => {
    fetch("/api/calling/admin/team")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.team) {
          setTeam(data.team);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and Email are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/calling/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, extension }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setShowAddModal(false);
        setName("");
        setEmail("");
        setExtension("");
        fetchTeam();
      } else {
        toast.error(data.error || "Failed to add team member");
      }
    } catch {
      toast.error("Network error adding team member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: "admin" | "supervisor" | "agent") => {
    try {
      const res = await fetch(`/api/calling/admin/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Role updated to ${newRole.toUpperCase()}`);
        setTeam((prev) =>
          prev.map((m) => (m.id === id ? { ...m, role: newRole } : m))
        );
      }
    } catch {
      toast.error("Failed to update member role");
    }
  };

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      const res = await fetch(`/api/calling/admin/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`User status changed to ${nextStatus}`);
        setTeam((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: nextStatus as any } : m))
        );
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteMember = async (id: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the workspace?`)) return;

    try {
      const res = await fetch(`/api/calling/admin/team/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${memberName} removed from workspace`);
        setTeam((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      toast.error("Failed to delete team member");
    }
  };

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center">
            <Users size={17} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100">Team & Calling Operator Management</h3>
            <p className="text-[11px] text-zinc-400">
              Manage supervisor credentials, PBX extensions, and floor agent accounts
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-violet-600/20 active:scale-95"
        >
          <UserPlus size={13} />
          <span>Add Team Member</span>
        </button>
      </div>

      {/* Team Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/80 text-zinc-400 text-[10px] uppercase font-bold tracking-wider border-b border-zinc-800">
            <tr>
              <th className="p-3">Operator Name</th>
              <th className="p-3">Email & Contact</th>
              <th className="p-3">PBX Ext</th>
              <th className="p-3">Assigned Role</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {team.map((m) => (
              <tr key={m.id} className="hover:bg-zinc-900/40 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-violet-950 border border-violet-700/60 text-violet-300 flex items-center justify-center font-bold text-[11px]">
                      {m.avatarInitials}
                    </div>
                    <div>
                      <strong className="text-zinc-100 font-semibold block">{m.name}</strong>
                      <span className="text-[10px] text-zinc-500">
                        Joined {new Date(m.joinedAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                  </div>
                </td>

                <td className="p-3 text-zinc-400 font-mono text-[11px]">
                  {m.email}
                </td>

                <td className="p-3 font-mono text-zinc-200">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px]">
                    Ext {m.extension}
                  </span>
                </td>

                <td className="p-3">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as any)}
                    className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-200 focus:outline-none focus:border-violet-500"
                  >
                    <option value="admin">Admin (Full Access)</option>
                    <option value="supervisor">Supervisor (Barge & Wallboard)</option>
                    <option value="agent">Agent (Softphone Only)</option>
                  </select>
                </td>

                <td className="p-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleStatusToggle(m.id, m.status)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer transition ${
                      m.status === "active"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : "bg-rose-950 text-rose-400 border border-rose-800"
                    }`}
                    title="Click to toggle active/suspended"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        m.status === "active" ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                    />
                    <span className="capitalize">{m.status}</span>
                  </button>
                </td>

                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(m.id, m.name)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                    title="Remove Operator"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-violet-400" />
                <h3 className="text-sm font-bold text-zinc-100">Add Calling Operator</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vikramaditya Sen"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. vikram.sen@callforge.io"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Platform Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100"
                  >
                    <option value="agent">Agent</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    PBX Extension #
                  </label>
                  <input
                    type="text"
                    value={extension}
                    onChange={(e) => setExtension(e.target.value)}
                    placeholder="e.g. 1005"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold cursor-pointer shadow-md shadow-violet-600/20"
                >
                  {isSubmitting ? "Adding..." : "Save Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
