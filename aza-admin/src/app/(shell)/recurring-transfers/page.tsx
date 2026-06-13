"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRecurringTransfers,
  cancelRecurringTransfer,
  type RecurringTransfer,
  type Page,
} from "@/lib/admin-api";
import { RefreshCw, ChevronLeft, ChevronRight, X, Loader2, AlertCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PAUSED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CANCELLED: "bg-muted/50 text-foreground/40 border-border",
};

const FREQ_LABELS: Record<string, string> = {
  DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly",
  QUARTERLY: "Quarterly", ANNUALLY: "Annual",
};

function ghs(n: number) {
  return `GHS ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}
function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function RecurringTransfersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [cancelTarget, setCancelTarget] = useState<RecurringTransfer | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery<Page<RecurringTransfer>>({
    queryKey: ["recurringTransfers", statusFilter, page],
    queryFn: () => getRecurringTransfers(statusFilter || undefined, page, 20),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelRecurringTransfer(id),
    onSuccess: () => {
      setCancelTarget(null);
      queryClient.invalidateQueries({ queryKey: ["recurringTransfers"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Recurring Transfers</h1>
          <p className="text-foreground/40 text-sm mt-1">View and manage all scheduled recurring transfers.</p>
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Recipient</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Amount</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Frequency</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Next Run</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Runs</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center">
                <Loader2 size={20} className="animate-spin mx-auto text-foreground/30" />
              </td></tr>
            ) : data?.content.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-foreground/30 text-sm">No recurring transfers found.</td></tr>
            ) : data?.content.map(rt => (
              <tr key={rt.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-foreground font-medium truncate max-w-[140px]">{rt.recipientIdentifier}</td>
                <td className="px-4 py-3 text-foreground font-semibold">{ghs(rt.amount)}</td>
                <td className="px-4 py-3 text-foreground/70">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw size={11} className="text-foreground/30" />
                    {FREQ_LABELS[rt.frequency] ?? rt.frequency}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground/70">{fmt(rt.nextRunAt)}</td>
                <td className="px-4 py-3 text-foreground/50">
                  {rt.successfulRuns} / {rt.totalRuns}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[rt.status] ?? ""}`}>
                    {rt.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {rt.status === "ACTIVE" && (
                    <button onClick={() => { setCancelTarget(rt); setError(""); }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1">
                      <X size={10} /> Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/30 hover:bg-muted border border-border text-foreground/60 text-sm disabled:opacity-30 transition-colors">
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-foreground/40 text-sm">{page + 1} / {data.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages - 1}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/30 hover:bg-muted border border-border text-foreground/60 text-sm disabled:opacity-30 transition-colors">
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-foreground">Cancel Recurring Transfer</h3>
            <p className="text-foreground/50 text-sm">
              Cancel the <strong>{FREQ_LABELS[cancelTarget.frequency]}</strong> transfer of{" "}
              <strong>{ghs(cancelTarget.amount)}</strong> to{" "}
              <strong>{cancelTarget.recipientIdentifier}</strong>? This cannot be undone.
            </p>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => cancelMut.mutate(cancelTarget.id)} disabled={cancelMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 font-semibold text-sm hover:bg-red-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                {cancelMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Cancel Transfer
              </button>
              <button onClick={() => setCancelTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground">
                Keep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
