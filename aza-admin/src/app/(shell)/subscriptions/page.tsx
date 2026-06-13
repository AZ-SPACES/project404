"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSubscriptions,
  cancelSubscription,
  type MerchantSubscription,
  type Page,
} from "@/lib/admin-api";
import { X, ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PAUSED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CANCELLED: "bg-muted/50 text-foreground/40 border-border",
  EXPIRED: "bg-red-500/10 text-red-400 border-red-500/20",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [cancelTarget, setCancelTarget] = useState<MerchantSubscription | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery<Page<MerchantSubscription>>({
    queryKey: ["subscriptions", statusFilter, page],
    queryFn: () => getSubscriptions(statusFilter || undefined, page, 20),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelSubscription(id),
    onSuccess: () => {
      setCancelTarget(null);
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Merchant Subscriptions</h1>
          <p className="text-foreground/40 text-sm mt-1">All active and historical merchant billing subscriptions.</p>
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Customer</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Merchant ID</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Plan ID</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Next Billing</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Created</th>
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
              <tr><td colSpan={7} className="px-4 py-8 text-center text-foreground/30 text-sm">No subscriptions found.</td></tr>
            ) : data?.content.map(sub => (
              <tr key={sub.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-foreground font-medium">{sub.customerName ?? "—"}</p>
                  <p className="text-foreground/40 text-xs">{sub.customerEmail ?? "No email"}</p>
                </td>
                <td className="px-4 py-3 font-mono text-foreground/50 text-xs">{sub.merchantId.slice(0, 8)}…</td>
                <td className="px-4 py-3 font-mono text-foreground/50 text-xs">{sub.planId.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-foreground/70">{fmt(sub.nextBillingAt)}</td>
                <td className="px-4 py-3 text-foreground/70">{fmt(sub.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[sub.status] ?? ""}`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {sub.status === "ACTIVE" && (
                    <button onClick={() => { setCancelTarget(sub); setError(""); }}
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
            <h3 className="font-semibold text-foreground">Cancel Subscription</h3>
            <p className="text-foreground/50 text-sm">
              Cancel subscription for <strong>{cancelTarget.customerName ?? "this customer"}</strong>?
              Their billing will stop immediately.
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
                Cancel Subscription
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
