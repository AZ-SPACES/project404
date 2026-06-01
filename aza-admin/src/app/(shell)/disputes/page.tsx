"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDisputes,
  getDisputeStats,
  resolveDispute,
  Dispute,
  DisputeStats,
  Page,
} from "@/lib/admin-api";
import { Scale, AlertCircle, CheckCircle2, XCircle, Clock, Loader2, X } from "lucide-react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function fmtGhs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_MAP = {
  OPEN: { label: "Open", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  UNDER_REVIEW: { label: "Under Review", cls: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  RESOLVED_APPROVED: { label: "Approved", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  RESOLVED_DENIED: { label: "Denied", cls: "text-red-400 bg-red-500/10 border-red-500/20" },
};

const CATEGORY_LABELS: Record<string, string> = {
  UNAUTHORIZED: "Unauthorized Transaction",
  WRONG_AMOUNT: "Wrong Amount",
  NOT_RECEIVED: "Not Received",
  DUPLICATE: "Duplicate Charge",
  SERVICE_ISSUE: "Service Issue",
  OTHER: "Other",
};

function StatusBadge({ status }: { status: Dispute["status"] }) {
  const cfg = STATUS_MAP[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

type FilterStatus = "ALL" | "OPEN" | "UNDER_REVIEW" | "RESOLVED_APPROVED" | "RESOLVED_DENIED";

export default function DisputesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>("OPEN");
  const [page, setPage] = useState(0);
  const [resolving, setResolving] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState("");

  const { data: disputeStats } = useQuery<DisputeStats>({
    queryKey: ["disputeStats"],
    queryFn: getDisputeStats,
  });

  const { data, isLoading, error } = useQuery<Page<Dispute>>({
    queryKey: ["disputes", { filter, page }],
    queryFn: () => getDisputes(page, 20, filter === "ALL" ? undefined : filter),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "APPROVE" | "DENY" }) =>
      resolveDispute(id, action, resolution),
    onSuccess: (updated) => {
      queryClient.setQueryData<Page<Dispute>>(["disputes", { filter, page }], (prev) =>
        prev ? { ...prev, content: prev.content.map(d => d.id === updated.id ? updated : d) } : prev
      );
      queryClient.invalidateQueries({ queryKey: ["disputeStats"] });
      setResolving(null);
      setResolution("");
    },
  });

  const tabs: { key: FilterStatus; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "OPEN", label: "Open" },
    { key: "UNDER_REVIEW", label: "Under Review" },
    { key: "RESOLVED_APPROVED", label: "Approved" },
    { key: "RESOLVED_DENIED", label: "Denied" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dispute Management</h1>
        <p className="text-foreground/40 text-sm mt-0.5">Customer transaction disputes and chargebacks</p>
      </div>

      {disputeStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Open", value: disputeStats.open, icon: Clock, color: "text-amber-400" },
            { label: "Under Review", value: disputeStats.underReview, icon: AlertCircle, color: "text-blue-400" },
            { label: "Resolved (Month)", value: disputeStats.resolvedThisMonth, icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Total Value Disputed", value: fmtGhs(disputeStats.totalValueDisputed), icon: Scale, color: "text-foreground" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-foreground/35 uppercase tracking-wider font-medium">{label}</p>
                <Icon size={14} className="text-foreground/20" />
              </div>
              <p className={`text-xl font-semibold ${color} mt-1`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setPage(0); }}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === tab.key ? "bg-[#B7EE7A] text-black" : "text-foreground/50 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{(error as Error).message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-foreground/30" size={24} />
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-20 text-foreground/25">
          <Scale size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No disputes found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.content.map((dispute) => (
            <div key={dispute.id} className="bg-card border border-border rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-xs font-mono text-foreground/30">{dispute.referenceId}</span>
                    <StatusBadge status={dispute.status} />
                    <span className="px-2 py-0.5 rounded text-xs border border-border text-foreground/40">
                      {CATEGORY_LABELS[dispute.category] ?? dispute.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-2 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{dispute.userName}</p>
                      {dispute.userHandle && <p className="text-xs text-foreground/35">@{dispute.userHandle}</p>}
                    </div>
                    <div className="text-right sm:text-left">
                      <p className="text-sm font-bold text-[#B7EE7A]">{fmtGhs(dispute.amount)}</p>
                      <p className="text-xs text-foreground/35">Disputed amount</p>
                    </div>
                  </div>
                  <p className="text-xs text-foreground/50 leading-relaxed">{dispute.description}</p>
                  {dispute.resolution && (
                    <div className="mt-2 px-3 py-2 bg-muted/10 border border-border rounded-lg">
                      <p className="text-[11px] text-foreground/30 font-medium uppercase tracking-wider mb-0.5">Resolution</p>
                      <p className="text-xs text-foreground/55">{dispute.resolution}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-xs text-foreground/30">{fmtDate(dispute.createdAt)}</p>
                  {(dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW") && (
                    <button
                      onClick={() => { setResolving(dispute); setResolution(""); }}
                      className="px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted border border-border text-xs text-foreground/60 hover:text-foreground transition-all font-medium"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0 || isLoading} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Previous</button>
          <span className="text-sm text-foreground/40">{page + 1} / {data.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages - 1 || isLoading} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Next</button>
        </div>
      )}

      {resolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setResolving(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-foreground">Resolve Dispute</h3>
              <button onClick={() => setResolving(null)} className="text-foreground/40 hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="bg-muted/20 border border-border rounded-xl p-4 mb-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-foreground/40">User</span>
                <span className="text-foreground font-medium">{resolving.userName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/40">Amount</span>
                <span className="text-[#B7EE7A] font-bold">{fmtGhs(resolving.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/40">Type</span>
                <span className="text-foreground/70">{CATEGORY_LABELS[resolving.category]}</span>
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 block">Resolution Notes</label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Provide resolution details..."
                rows={3}
                className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 resize-none"
              />
            </div>

            {resolveMutation.error && (
              <p className="text-red-400 text-sm mb-3">{(resolveMutation.error as Error).message}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => resolveMutation.mutate({ id: resolving.id, action: "APPROVE" })}
                disabled={resolveMutation.isPending || !resolution.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition-all"
              >
                <CheckCircle2 size={15} />
                Approve Dispute
              </button>
              <button
                onClick={() => resolveMutation.mutate({ id: resolving.id, action: "DENY" })}
                disabled={resolveMutation.isPending || !resolution.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-all"
              >
                <XCircle size={15} />
                Deny Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
