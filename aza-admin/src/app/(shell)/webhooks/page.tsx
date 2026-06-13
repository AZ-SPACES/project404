"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWebhookDeliveries,
  getWebhookStats,
  retryWebhookDelivery,
  type WebhookDelivery,
  type WebhookStats,
  type Page,
} from "@/lib/admin-api";
import { RefreshCw, Loader2 } from "lucide-react";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_TABS = ["", "PENDING", "FAILED", "ABANDONED", "SUCCESS"] as const;
type StatusFilter = (typeof STATUS_TABS)[number];

function statusBadge(status: WebhookDelivery["status"]) {
  const map = {
    PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    SUCCESS: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
    ABANDONED: "bg-foreground/5 text-foreground/50 border-border",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${map[status]}`}>{status}</span>
  );
}

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [page, setPage] = useState(0);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data: stats } = useQuery<WebhookStats>({
    queryKey: ["webhookStats"],
    queryFn: getWebhookStats,
    refetchInterval: 15_000,
  });

  const { data: deliveries, isLoading } = useQuery<Page<WebhookDelivery>>({
    queryKey: ["webhookDeliveries", statusFilter, page],
    queryFn: () => getWebhookDeliveries(statusFilter || undefined, page, 20),
  });

  const retry = useMutation({
    mutationFn: (id: string) => retryWebhookDelivery(id),
    onMutate: (id) => setRetryingId(id),
    onSettled: () => {
      setRetryingId(null);
      queryClient.invalidateQueries({ queryKey: ["webhookDeliveries"] });
      queryClient.invalidateQueries({ queryKey: ["webhookStats"] });
    },
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw size={20} className="text-foreground/50" />
          <h1 className="text-2xl font-semibold text-foreground">Webhook Retry Dashboard</h1>
        </div>
        <p className="text-foreground/50 text-sm">Monitor and retry failed webhook deliveries.</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <p className="text-xs text-foreground/50 mb-1">Pending</p>
            <p className="text-2xl font-semibold text-yellow-400">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-xs text-foreground/50 mb-1">Failed</p>
            <p className="text-2xl font-semibold text-red-400">{stats.failed}</p>
          </div>
          <div className="rounded-xl border border-border bg-foreground/5 p-4">
            <p className="text-xs text-foreground/50 mb-1">Abandoned</p>
            <p className="text-2xl font-semibold text-foreground/60">{stats.abandoned}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-foreground/50 mb-1">Success</p>
            <p className="text-2xl font-semibold text-emerald-400">{stats.success}</p>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              setPage(0);
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2 ${
              statusFilter === s
                ? "border-[#B7EE7A] text-[#B7EE7A]"
                : "border-transparent text-foreground/50 hover:text-foreground"
            }`}
          >
            {s === "" ? "All" : s}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="h-48 bg-muted/20 rounded-xl animate-pulse" />
      ) : !deliveries || deliveries.content.length === 0 ? (
        <div className="rounded-xl border border-border text-center py-16 text-foreground/30">
          <RefreshCw size={32} className="mx-auto mb-3 opacity-40" />
          <p>No webhook deliveries found</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/20 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Event Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Attempts</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">HTTP Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Last Attempt</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Next Retry</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveries.content.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-foreground font-mono text-xs">{d.eventType}</p>
                      <p className="text-foreground/30 text-xs font-mono">{d.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3">{statusBadge(d.status)}</td>
                    <td className="px-4 py-3 text-foreground/70">{d.attemptCount}</td>
                    <td className="px-4 py-3 text-foreground/70">
                      {d.responseStatusCode ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground/50">{fmt(d.lastAttemptAt)}</td>
                    <td className="px-4 py-3 text-foreground/50">{fmt(d.nextRetryAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {(d.status === "FAILED" || d.status === "ABANDONED") && (
                        <button
                          onClick={() => retry.mutate(d.id)}
                          disabled={retryingId === d.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-xs transition-colors disabled:opacity-50 ml-auto"
                        >
                          {retryingId === d.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <RefreshCw size={12} />
                          )}
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {deliveries.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-foreground/50">
              <span>
                Page {deliveries.number + 1} of {deliveries.totalPages} ·{" "}
                {deliveries.totalElements} total
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={page >= deliveries.totalPages - 1}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
