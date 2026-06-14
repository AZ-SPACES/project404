"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminWithdrawals,
  reviewWithdrawal,
  type UserWithdrawal,
  type Page,
} from "@/lib/admin-api";
import {
  Wallet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  X,
} from "lucide-react";

const STATUS_CFG: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
  PENDING:   { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",       label: "Pending",   icon: <Clock size={11} /> },
  APPROVED:  { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",          label: "Approved",  icon: <CheckCircle2 size={11} /> },
  COMPLETED: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Completed", icon: <CheckCircle2 size={11} /> },
  REJECTED:  { cls: "text-red-400 bg-red-500/10 border-red-500/20",             label: "Rejected",  icon: <XCircle size={11} /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { cls: "text-foreground/40 bg-muted/30 border-border", label: status, icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";

function ReviewModal({ withdrawal, onClose }: { withdrawal: UserWithdrawal; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState<"APPROVE" | "REJECT" | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (action: "APPROVE" | "REJECT") => reviewWithdrawal(withdrawal.id, action, note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminWithdrawals"] });
      onClose();
    },
  });

  if (confirming) {
    const isApprove = confirming === "APPROVE";
    return (
      <div className="space-y-4">
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${isApprove ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
          {isApprove ? <ThumbsUp size={18} className="text-emerald-400 shrink-0" /> : <ThumbsDown size={18} className="text-red-400 shrink-0" />}
          <div>
            <p className={`text-sm font-semibold ${isApprove ? "text-emerald-400" : "text-red-400"}`}>
              {isApprove ? "Approve withdrawal?" : "Reject withdrawal?"}
            </p>
            <p className="text-xs text-foreground/40 mt-0.5">
              {fmtAmount(withdrawal.amount, withdrawal.currency)} · {withdrawal.provider} → {withdrawal.destination}
            </p>
          </div>
        </div>
        {mutation.isError && (
          <p className="text-sm text-red-400">{(mutation.error as Error).message}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(null)}
            disabled={mutation.isPending}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-foreground/50 hover:text-foreground transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => mutation.mutate(confirming)}
            disabled={mutation.isPending}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${
              isApprove ? "bg-emerald-500 text-white hover:bg-emerald-400" : "bg-red-500 text-white hover:bg-red-400"
            } disabled:opacity-50 transition-colors`}
          >
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Confirm {isApprove ? "Approval" : "Rejection"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-muted/20 border border-border rounded-xl divide-y divide-border">
        {[
          { label: "Amount", value: fmtAmount(withdrawal.amount, withdrawal.currency) },
          { label: "Provider", value: withdrawal.provider },
          { label: "Destination", value: withdrawal.destination },
          ...(withdrawal.bankName ? [{ label: "Bank", value: withdrawal.bankName }] : []),
          { label: "Requested", value: fmtDate(withdrawal.createdAt) },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-foreground/40">{label}</span>
            <span className="text-foreground font-medium">{value}</span>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-1.5">
          Admin note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason for approval or rejection…"
          rows={3}
          className="w-full bg-muted/20 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/25 resize-none focus:outline-none focus:border-[#B7EE7A]/50"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setConfirming("REJECT")}
          className="flex-1 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
        >
          <ThumbsDown size={14} />
          Reject
        </button>
        <button
          onClick={() => setConfirming("APPROVE")}
          className="flex-1 py-2.5 rounded-xl bg-[#B7EE7A] text-black text-sm font-semibold hover:bg-[#c8f58e] transition-colors flex items-center justify-center gap-2"
        >
          <ThumbsUp size={14} />
          Approve
        </button>
      </div>
    </div>
  );
}

export default function WithdrawalsPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selected, setSelected] = useState<UserWithdrawal | null>(null);

  const { data, isLoading, error } = useQuery<Page<UserWithdrawal>>({
    queryKey: ["adminWithdrawals", page, statusFilter],
    queryFn: () => getAdminWithdrawals(page, 20, statusFilter === "ALL" ? undefined : statusFilter),
  });

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "PENDING", label: "Pending" },
    { key: "APPROVED", label: "Approved" },
    { key: "COMPLETED", label: "Completed" },
    { key: "REJECTED", label: "Rejected" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">User Withdrawals</h1>
        <p className="text-foreground/40 text-sm mt-0.5">Review and action pending withdrawal requests</p>
      </div>

      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(0); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              statusFilter === tab.key ? "bg-[#B7EE7A] text-black" : "text-foreground/50 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-foreground/30" size={24} />
        </div>
      ) : !data || data.content.length === 0 ? (
        <div className="text-center py-20 text-foreground/25">
          <Wallet size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No withdrawal requests found</p>
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">User</th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Amount</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Provider</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden md:table-cell">Destination</th>
                  <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Status</th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden lg:table-cell">Requested</th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden lg:table-cell">Reviewed</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.content.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3 text-foreground/50 font-mono text-xs">{w.userId.slice(0, 8)}…</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{fmtAmount(w.amount, w.currency)}</td>
                    <td className="px-5 py-3 text-foreground/70">{w.provider}</td>
                    <td className="px-5 py-3 text-foreground/50 hidden md:table-cell">
                      {w.destination}
                      {w.bankName && <span className="block text-xs text-foreground/30">{w.bankName}</span>}
                    </td>
                    <td className="px-5 py-3 text-center"><StatusBadge status={w.status} /></td>
                    <td className="px-5 py-3 text-right text-foreground/40 text-xs hidden lg:table-cell">{fmtDate(w.createdAt)}</td>
                    <td className="px-5 py-3 text-right text-foreground/40 text-xs hidden lg:table-cell">{fmtDate(w.reviewedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      {w.status === "PENDING" ? (
                        <button
                          onClick={() => setSelected(w)}
                          className="px-3 py-1 rounded-lg bg-[#B7EE7A]/10 border border-[#B7EE7A]/30 text-[#B7EE7A] text-xs font-semibold hover:bg-[#B7EE7A]/20 transition-colors"
                        >
                          Review
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelected(w)}
                          className="px-3 py-1 rounded-lg border border-border text-foreground/40 text-xs hover:text-foreground transition-colors"
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-foreground/40">
              <span>
                Page {data.number + 1} of {data.totalPages} · {data.totalElements} total
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-30 hover:text-foreground transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.totalPages - 1}
                  className="p-1.5 rounded-lg border border-border disabled:opacity-30 hover:text-foreground transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review / detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative z-10 w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Withdrawal Request</h2>
                <p className="text-xs text-foreground/40 mt-0.5 font-mono">{selected.id.slice(0, 16)}…</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </div>
            {selected.status === "PENDING" ? (
              <ReviewModal withdrawal={selected} onClose={() => setSelected(null)} />
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/20 border border-border rounded-xl divide-y divide-border">
                  {[
                    { label: "Amount", value: fmtAmount(selected.amount, selected.currency) },
                    { label: "Provider", value: selected.provider },
                    { label: "Destination", value: selected.destination },
                    ...(selected.bankName ? [{ label: "Bank", value: selected.bankName }] : []),
                    { label: "Status", value: selected.status },
                    { label: "Requested", value: fmtDate(selected.createdAt) },
                    { label: "Reviewed", value: fmtDate(selected.reviewedAt) },
                    ...(selected.adminNote ? [{ label: "Note", value: selected.adminNote }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                      <span className="text-foreground/40">{label}</span>
                      <span className="text-foreground font-medium">{value}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-full py-2.5 rounded-xl border border-border text-sm text-foreground/50 hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
