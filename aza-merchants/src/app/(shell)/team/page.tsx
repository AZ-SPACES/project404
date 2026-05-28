"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getTeamMembers, inviteTeamMember, updateTeamRole, removeTeamMember,
  TeamMember,
} from "@/lib/merchant-api";
import { Loader2, UserCog, UserPlus, X, Trash2, ChevronDown } from "lucide-react";

const ROLES = ["ADMIN", "DEVELOPER", "ANALYST", "SUPPORT"] as const;

const ROLE_DESC: Record<string, string> = {
  ADMIN: "Full access except billing",
  DEVELOPER: "API keys, webhooks, developer tools",
  ANALYST: "Read-only access to all reports",
  SUPPORT: "View transactions and customers",
};

const STATUS_STYLE: Record<string, string> = {
  INVITED: "bg-amber-400/10 text-amber-400",
  ACTIVE: "bg-[#B7EE7A]/10 text-[#B7EE7A]",
  REMOVED: "bg-white/10 text-white/30",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function InviteModal({ onClose, onInvite }: { onClose: () => void; onInvite: (m: TeamMember) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("DEVELOPER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const m = await inviteTeamMember({ email: email.trim(), role });
      onInvite(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Invite Team Member</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Email address</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#B7EE7A]/50"
              placeholder="colleague@company.com"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Role</label>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <label key={r} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${role === r ? "border-[#B7EE7A]/40 bg-[#B7EE7A]/5" : "border-white/8 hover:border-white/15"}`}>
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="mt-0.5 accent-[#B7EE7A]"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{r}</p>
                    <p className="text-xs text-white/40">{ROLE_DESC[r]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTeamMembers();
      setMembers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRoleChange(id: string, newRole: string) {
    setActionLoading(id + ":role");
    try {
      const updated = await updateTeamRole(id, newRole);
      setMembers((ms) => ms ? ms.map((m) => m.id === id ? updated : m) : ms);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setActionLoading(null);
      setEditingRole(null);
    }
  }

  async function handleRemove(id: string, email: string) {
    if (!confirm(`Remove ${email} from your team?`)) return;
    setActionLoading(id + ":remove");
    try {
      await removeTeamMember(id);
      setMembers((ms) => ms ? ms.filter((m) => m.id !== id) : ms);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvite={(m) => {
            setMembers((ms) => ms ? [m, ...ms] : [m]);
            setShowInvite(false);
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Team</h1>
          <p className="text-white/40 text-sm mt-0.5">Manage who has access to your merchant account</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-white rounded-xl transition-colors"
        >
          <UserPlus size={15} />
          Invite
        </button>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-[#B7EE7A]" size={22} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : !members || members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <UserCog size={32} className="text-white/15" />
            <p className="text-white/40 text-sm">No team members yet</p>
            <button onClick={() => setShowInvite(true)} className="text-sm text-[#B7EE7A] hover:underline">
              Invite someone
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {members.map((m) => (
              <div key={m.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-[#B7EE7A]/15 border border-[#B7EE7A]/25 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#B7EE7A]">{initials(m.email)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{m.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLE[m.status] ?? "bg-white/10 text-white/40"}`}>
                      {m.status}
                    </span>
                    <span className="text-[10px] text-white/30">
                      {m.status === "ACTIVE" ? `joined ${fmtDate(m.joinedAt)}` : `invited ${fmtDate(m.invitedAt)}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.status !== "REMOVED" && (
                    <div className="relative">
                      <button
                        onClick={() => setEditingRole(editingRole === m.id ? null : m.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/8 text-xs text-white/60 hover:text-white hover:border-white/15 transition-colors"
                      >
                        {m.role}
                        <ChevronDown size={12} />
                      </button>
                      {editingRole === m.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-xl z-10">
                          {ROLES.map((r) => (
                            <button
                              key={r}
                              onClick={() => handleRoleChange(m.id, r)}
                              disabled={actionLoading === m.id + ":role"}
                              className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors ${r === m.role ? "text-[#B7EE7A] bg-[#B7EE7A]/5" : "text-white/70 hover:text-white hover:bg-white/5"}`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {m.status !== "REMOVED" && (
                    <button
                      onClick={() => handleRemove(m.id, m.email)}
                      disabled={actionLoading === m.id + ":remove"}
                      className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30"
                      title="Remove member"
                    >
                      {actionLoading === m.id + ":remove" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
        <p className="text-sm font-semibold text-white mb-3">Role permissions</p>
        <div className="space-y-2">
          {ROLES.map((r) => (
            <div key={r} className="flex items-start gap-3">
              <span className="text-xs font-semibold text-white/50 w-20 flex-shrink-0 mt-0.5">{r}</span>
              <span className="text-xs text-white/30">{ROLE_DESC[r]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
