"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  batchInviteWaitlist,
  deleteWaitlistEntry,
  getWaitlistEntries,
  getWaitlistStats,
  inviteWaitlistEntry,
  type WaitlistEntry,
  type WaitlistStats,
} from "@/lib/admin-api";
import { CheckCircle2, Loader2, Mail, MailCheck, Trash2, Users } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-foreground/50">{label}</p>
      <p className="text-2xl font-semibold text-foreground mt-1">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-foreground/40 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function WaitlistPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchError, setBatchError] = useState("");

  const { data: stats } = useQuery<WaitlistStats>({
    queryKey: ["waitlist-stats"],
    queryFn: getWaitlistStats,
  });

  const { data: entries, isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ["waitlist-entries"],
    queryFn: () => getWaitlistEntries(0, 200),
  });

  const invite = useMutation({
    mutationFn: inviteWaitlistEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist-entries"] });
      qc.invalidateQueries({ queryKey: ["waitlist-stats"] });
    },
  });

  const batchInvite = useMutation({
    mutationFn: () => batchInviteWaitlist(Array.from(selected)),
    onSuccess: () => {
      setSelected(new Set());
      setBatchError("");
      qc.invalidateQueries({ queryKey: ["waitlist-entries"] });
      qc.invalidateQueries({ queryKey: ["waitlist-stats"] });
    },
    onError: (e: Error) => setBatchError(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteWaitlistEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist-entries"] });
      qc.invalidateQueries({ queryKey: ["waitlist-stats"] });
    },
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pending = entries?.filter((e) => !e.invitedAt) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Waitlist</h1>
        <p className="text-sm text-foreground/50 mt-0.5">Manage pre-launch signups and send invitations</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total signups" value={stats.total} />
          <StatCard label="Awaiting invite" value={stats.pending} />
          <StatCard label="Invited" value={stats.invited} />
          <StatCard label="Confirmation sent" value={stats.confirmationSent} />
        </div>
      )}

      {selected.size > 0 && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-foreground/70">{selected.size} selected</span>
          <button
            onClick={() => batchInvite.mutate()}
            disabled={batchInvite.isPending}
            className="text-xs px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            {batchInvite.isPending ? "Inviting…" : `Invite ${selected.size}`}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-foreground/40 hover:text-foreground/60"
          >
            Clear
          </button>
          {batchError && <span className="text-xs text-red-400">{batchError}</span>}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={18} className="animate-spin text-foreground/40" />
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-foreground/[0.02]">
                <th className="px-4 py-2.5 text-left w-8">
                  <input
                    type="checkbox"
                    className="accent-blue-500"
                    checked={selected.size === pending.length && pending.length > 0}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(pending.map((p) => p.id)) : new Set())
                    }
                  />
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foreground/50">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foreground/50">Signed up</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foreground/50">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-foreground/50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).map((entry) => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-foreground/[0.01]">
                  <td className="px-4 py-2.5">
                    {!entry.invitedAt && (
                      <input
                        type="checkbox"
                        className="accent-blue-500"
                        checked={selected.has(entry.id)}
                        onChange={() => toggleSelect(entry.id)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{entry.email}</td>
                  <td className="px-4 py-2.5 text-foreground/50">{fmt(entry.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    {entry.invitedAt ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <MailCheck size={10} />
                        Invited {fmt(entry.invitedAt)}
                      </span>
                    ) : entry.confirmationSent ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <CheckCircle2 size={10} />
                        Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/50 border border-border">
                        <Users size={10} />
                        Waiting
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!entry.invitedAt && (
                        <button
                          onClick={() => invite.mutate(entry.id)}
                          disabled={invite.isPending}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/70 transition-colors disabled:opacity-50"
                        >
                          <Mail size={11} />
                          Invite
                        </button>
                      )}
                      <button
                        onClick={() => remove.mutate(entry.id)}
                        disabled={remove.isPending}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(entries ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-foreground/40">
                    No waitlist entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
