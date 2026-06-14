"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  searchCSUsers,
  getCSUserDetail,
  adjustBalance,
  forceLogout,
  lockUser,
  unlockUser,
  addAdminNote,
  getAdminNotes,
  type CSUser,
  type CSUserDetail,
  type AdminNote,
  type AdminTransaction,
} from "@/lib/admin-api";
import {
  Search,
  Loader2,
  AlertCircle,
  UserCheck,
  UserX,
  LogOut,
  DollarSign,
  StickyNote,
  ChevronRight,
} from "lucide-react";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtBalance(amount: number): string {
  return new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  SUSPENDED: "bg-red-500/10 text-red-400 border-red-500/20",
  DEACTIVATED: "bg-foreground/5 text-foreground/30 border-border",
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const KYC_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  NOT_STARTED: "bg-foreground/5 text-foreground/30 border-border",
  UNDER_REVIEW: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const TX_STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
  HELD_FOR_REVIEW: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  REVERSED: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  CANCELLED: "bg-foreground/5 text-foreground/30 border-border",
};

function Badge({ label, styles }: { label: string; styles: Record<string, string> }) {
  const cls = styles[label] ?? "bg-foreground/5 text-foreground/30 border-border";
  return (
    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cls}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function initials(user: CSUser): string {
  const f = user.firstName?.[0] ?? "";
  const l = user.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || user.email[0].toUpperCase();
}

type ActionMode = "adjust" | "force-logout" | "lock" | "note" | null;

export default function CSPage() {
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedUser, setSelectedUser] = useState<CSUser | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [adjustType, setAdjustType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Search
  const { data: searchResult, isLoading: searching } = useQuery({
    queryKey: ["csUsers", debouncedQ],
    queryFn: () => searchCSUsers(debouncedQ),
    enabled: debouncedQ.length > 1,
  });

  // Detail
  const { data: detail, isLoading: detailLoading, error: detailError } = useQuery<CSUserDetail>({
    queryKey: ["csUserDetail", selectedUser?.id],
    queryFn: () => getCSUserDetail(selectedUser!.id),
    enabled: !!selectedUser,
  });

  // Notes
  const { data: notes, isLoading: notesLoading } = useQuery<AdminNote[]>({
    queryKey: ["adminNotes", selectedUser?.id],
    queryFn: () => getAdminNotes(selectedUser!.id),
    enabled: !!selectedUser,
  });

  // Adjust balance
  const adjustMutation = useMutation({
    mutationFn: () =>
      adjustBalance(selectedUser!.id, parseFloat(adjustAmount), adjustType, adjustReason),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["csUserDetail", selectedUser?.id] });
      setActionMode(null);
      setAdjustAmount("");
      setAdjustReason("");
      showToast(`Balance updated. New balance: GH₵ ${fmtBalance(res.newBalance)}`);
    },
  });

  // Force logout
  const forceLogoutMutation = useMutation({
    mutationFn: () => forceLogout(selectedUser!.id),
    onSuccess: () => {
      setActionMode(null);
      showToast("User has been logged out of all devices");
    },
  });

  // Lock
  const lockMutation = useMutation({
    mutationFn: () => (detail?.locked ? unlockUser(selectedUser!.id) : lockUser(selectedUser!.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["csUserDetail", selectedUser?.id] });
      queryClient.invalidateQueries({ queryKey: ["csUsers", debouncedQ] });
      setActionMode(null);
      showToast(detail?.locked ? "User unlocked" : "User locked");
    },
  });

  // Add note
  const noteMutation = useMutation({
    mutationFn: () => addAdminNote(selectedUser!.id, noteText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminNotes", selectedUser?.id] });
      setNoteText("");
      setActionMode(null);
      showToast("Note added");
    },
  });

  const users = searchResult?.content ?? [];

  return (
    <div className="flex h-[calc(100vh-3.5rem-4rem)] gap-0 -m-6 lg:-m-8">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm px-4 py-3 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* ── Left pane ── */}
      <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border flex-shrink-0">
          <h1 className="text-lg font-semibold text-foreground mb-3">CS Toolkit</h1>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email, phone, name…"
              className="w-full bg-muted/30 border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20"
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          {debouncedQ.length <= 1 && (
            <div className="flex flex-col items-center justify-center h-full text-foreground/20 text-sm gap-2">
              <Search size={28} className="opacity-30" />
              <p>Type to search users</p>
            </div>
          )}

          {debouncedQ.length > 1 && searching && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin text-foreground/30" size={20} />
            </div>
          )}

          {debouncedQ.length > 1 && !searching && users.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-foreground/20 text-sm gap-1">
              <p>No users found</p>
            </div>
          )}

          {users.map((user) => {
            const selected = selectedUser?.id === user.id;
            return (
              <button
                key={user.id}
                onClick={() => { setSelectedUser(user); setActionMode(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-border/50 transition-colors ${
                  selected
                    ? "bg-[#B7EE7A]/10 border-l-2 border-l-[#B7EE7A]"
                    : "hover:bg-muted/30"
                }`}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#B7EE7A]/20 flex items-center justify-center text-xs font-bold text-[#B7EE7A] flex-shrink-0">
                  {initials(user)}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.firstName || user.lastName
                      ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                      : user.email}
                  </p>
                  <p className="text-xs text-foreground/35 truncate">{user.email}</p>
                </div>
                {/* Badges */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge label={user.status} styles={STATUS_STYLES} />
                  <Badge label={user.kycStatus} styles={KYC_STYLES} />
                </div>
                <ChevronRight size={14} className="text-foreground/20 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right pane ── */}
      <div className="flex-1 overflow-y-auto">
        {!selectedUser && (
          <div className="flex flex-col items-center justify-center h-full text-foreground/20 gap-2">
            <UserCheck size={36} className="opacity-30" />
            <p className="text-sm">Select a user to view details</p>
          </div>
        )}

        {selectedUser && (
          <div className="p-6 space-y-6 max-w-3xl">
            {detailError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle size={16} />{(detailError as Error).message}
              </div>
            )}

            {detailLoading && (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="animate-spin text-foreground/30" size={24} />
              </div>
            )}

            {detail && (
              <>
                {/* User header */}
                <div className="rounded-xl border border-border bg-foreground/5 p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#B7EE7A]/20 flex items-center justify-center text-lg font-bold text-[#B7EE7A] flex-shrink-0">
                      {initials(detail)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-foreground">
                        {detail.firstName || detail.lastName
                          ? `${detail.firstName ?? ""} ${detail.lastName ?? ""}`.trim()
                          : "No name"}
                      </h2>
                      <p className="text-sm text-foreground/50">{detail.email}</p>
                      {detail.phoneNumber && (
                        <p className="text-sm text-foreground/40">{detail.phoneNumber}</p>
                      )}
                    </div>
                    {/* Wallet balance */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-foreground/30 uppercase tracking-wider mb-1">Balance</p>
                      <p className="text-2xl font-bold text-foreground">GH₵ {fmtBalance(detail.walletBalance)}</p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge label={detail.status} styles={STATUS_STYLES} />
                    <Badge label={detail.kycStatus} styles={KYC_STYLES} />
                    {detail.locked && (
                      <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-semibold bg-red-500/10 text-red-400 border-red-500/20">
                        LOCKED
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActionMode(actionMode === "adjust" ? null : "adjust")}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-all"
                  >
                    <DollarSign size={14} />
                    Adjust Balance
                  </button>
                  <button
                    onClick={() => setActionMode(actionMode === "force-logout" ? null : "force-logout")}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition-all"
                  >
                    <LogOut size={14} />
                    Force Logout
                  </button>
                  <button
                    onClick={() => setActionMode(actionMode === "lock" ? null : "lock")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      detail.locked
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                    }`}
                  >
                    {detail.locked ? <UserCheck size={14} /> : <UserX size={14} />}
                    {detail.locked ? "Unlock" : "Lock"} Account
                  </button>
                  <button
                    onClick={() => setActionMode(actionMode === "note" ? null : "note")}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-semibold hover:bg-blue-500/20 transition-all"
                  >
                    <StickyNote size={14} />
                    Add Note
                  </button>
                </div>

                {/* Inline action panels */}
                {actionMode === "adjust" && (
                  <div className="rounded-xl border border-border bg-foreground/5 p-5 space-y-4">
                    <p className="text-sm font-semibold text-foreground">Adjust Balance</p>
                    {/* CREDIT / DEBIT tabs */}
                    <div className="flex gap-1 bg-muted/30 p-1 rounded-lg w-fit">
                      {(["CREDIT", "DEBIT"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setAdjustType(t)}
                          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                            adjustType === t
                              ? "bg-[#B7EE7A] text-black"
                              : "text-foreground/50 hover:text-foreground"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/40 block mb-1.5">
                          Amount (GH₵)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/40 block mb-1.5">
                          Reason
                        </label>
                        <input
                          type="text"
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          placeholder="e.g. Refund for failed transfer"
                          className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20"
                        />
                      </div>
                    </div>
                    {adjustMutation.error && (
                      <p className="text-red-400 text-sm">{(adjustMutation.error as Error).message}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => adjustMutation.mutate()}
                        disabled={adjustMutation.isPending || !adjustAmount || !adjustReason}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 disabled:opacity-40 transition-all"
                      >
                        {adjustMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <DollarSign size={13} />}
                        Apply {adjustType}
                      </button>
                      <button
                        onClick={() => setActionMode(null)}
                        className="px-4 py-2 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {actionMode === "force-logout" && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
                    <p className="text-sm font-semibold text-amber-400">Force Logout</p>
                    <p className="text-sm text-foreground/60">
                      This will log the user out of all devices and invalidate all active sessions. Confirm?
                    </p>
                    {forceLogoutMutation.error && (
                      <p className="text-red-400 text-sm">{(forceLogoutMutation.error as Error).message}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => forceLogoutMutation.mutate()}
                        disabled={forceLogoutMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-sm font-semibold hover:bg-amber-500/25 disabled:opacity-40 transition-all"
                      >
                        {forceLogoutMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                        Confirm Logout
                      </button>
                      <button
                        onClick={() => setActionMode(null)}
                        className="px-4 py-2 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {actionMode === "lock" && (
                  <div className={`rounded-xl border p-5 space-y-3 ${
                    detail.locked
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-red-500/20 bg-red-500/5"
                  }`}>
                    <p className={`text-sm font-semibold ${detail.locked ? "text-emerald-400" : "text-red-400"}`}>
                      {detail.locked ? "Unlock Account" : "Lock Account"}
                    </p>
                    <p className="text-sm text-foreground/60">
                      {detail.locked
                        ? "This will restore the user's ability to log in and transact."
                        : "This will prevent the user from logging in or making transactions."}
                    </p>
                    {lockMutation.error && (
                      <p className="text-red-400 text-sm">{(lockMutation.error as Error).message}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => lockMutation.mutate()}
                        disabled={lockMutation.isPending}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all ${
                          detail.locked
                            ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25"
                            : "bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25"
                        }`}
                      >
                        {lockMutation.isPending ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : detail.locked ? (
                          <UserCheck size={13} />
                        ) : (
                          <UserX size={13} />
                        )}
                        Confirm {detail.locked ? "Unlock" : "Lock"}
                      </button>
                      <button
                        onClick={() => setActionMode(null)}
                        className="px-4 py-2 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {actionMode === "note" && (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-3">
                    <p className="text-sm font-semibold text-blue-400">Add Note</p>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Internal note about this user…"
                      rows={3}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 resize-none"
                    />
                    {noteMutation.error && (
                      <p className="text-red-400 text-sm">{(noteMutation.error as Error).message}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => noteMutation.mutate()}
                        disabled={noteMutation.isPending || !noteText.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 text-sm font-semibold hover:bg-blue-500/25 disabled:opacity-40 transition-all"
                      >
                        {noteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <StickyNote size={13} />}
                        Add Note
                      </button>
                      <button
                        onClick={() => setActionMode(null)}
                        className="px-4 py-2 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Recent Transactions */}
                {detail.recentTransactions && detail.recentTransactions.length > 0 && (
                  <div className="rounded-xl border border-border bg-foreground/5 overflow-hidden">
                    <div className="px-5 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground">Recent Transactions</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/10">
                          <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Date</th>
                          <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden sm:table-cell">Description</th>
                          <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Amount</th>
                          <th className="text-center px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detail.recentTransactions.slice(0, 5).map((tx: AdminTransaction) => (
                          <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-2.5">
                              <p className="text-xs text-foreground/40">{fmtDate(tx.initiatedAt ?? tx.completedAt ?? null)}</p>
                            </td>
                            <td className="px-5 py-2.5 hidden sm:table-cell">
                              <p className="text-xs text-foreground/70 truncate max-w-[160px]">
                                {tx.type.replace(/_/g, " ")}
                                {tx.note ? ` · ${tx.note}` : ""}
                              </p>
                            </td>
                            <td className="px-5 py-2.5 text-right">
                              <p className="text-sm font-semibold text-foreground">GH₵ {fmtBalance(tx.amount)}</p>
                            </td>
                            <td className="px-5 py-2.5 text-center">
                              <Badge label={tx.status} styles={TX_STATUS_STYLES} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Devices */}
                {detail.devices && detail.devices.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Devices</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {detail.devices.map((d) => (
                        <div key={d.id} className="rounded-xl border border-border bg-foreground/5 p-4">
                          <p className="text-sm font-medium text-foreground">{d.deviceName || "Unknown device"}</p>
                          <p className="text-xs text-foreground/40 mt-0.5">{d.deviceOs || "Unknown OS"}</p>
                          {d.lastSeenAt && (
                            <p className="text-xs text-foreground/25 mt-1">Last seen {timeAgo(d.lastSeenAt)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Admin Notes</p>

                  {notesLoading && (
                    <div className="flex items-center justify-center h-16">
                      <Loader2 className="animate-spin text-foreground/30" size={18} />
                    </div>
                  )}

                  {!notesLoading && notes && notes.length === 0 && (
                    <p className="text-xs text-foreground/25 italic">No notes yet</p>
                  )}

                  {notes && notes.map((n) => (
                    <div key={n.id} className="rounded-xl border border-border bg-foreground/5 p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-foreground/60">{n.createdBy}</p>
                        <p className="text-xs text-foreground/25">{fmtDate(n.createdAt)}</p>
                      </div>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{n.note}</p>
                    </div>
                  ))}

                  {/* Always-visible note form at bottom */}
                  <div className="rounded-xl border border-border bg-foreground/5 p-4 space-y-3">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add an internal note…"
                      rows={2}
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 resize-none"
                    />
                    <button
                      onClick={() => noteMutation.mutate()}
                      disabled={noteMutation.isPending || !noteText.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 text-sm font-semibold hover:bg-blue-500/25 disabled:opacity-40 transition-all"
                    >
                      {noteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <StickyNote size={13} />}
                      Add Note
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
