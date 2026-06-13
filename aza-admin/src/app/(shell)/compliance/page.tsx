"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getFlaggedTransactions,
  getComplianceStats,
  reviewFlaggedTransaction,
  exportAmlRegisterCsv,
  FlaggedTransaction,
  ComplianceStats,
  Page,
} from "@/lib/admin-api";
import {
  ShieldAlert,
  CheckCircle2,
  FileText,
  Clock,
  AlertTriangle,
  Loader2,
  X,
  AlertCircle,
  Download,
} from "lucide-react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtGhs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function RiskScore({ score }: { score: number }) {
  const color = score >= 80 ? "text-red-400 bg-red-500/10 border-red-500/20"
    : score >= 60 ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  return <span className={`px-2 py-0.5 rounded text-xs font-bold border ${color}`}>{score}</span>;
}

function StatusBadge({ status }: { status: FlaggedTransaction["status"] }) {
  const map = {
    PENDING_REVIEW: { label: "Pending Review", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    CLEARED: { label: "Cleared", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    REPORTED: { label: "SAR Filed", cls: "text-red-400 bg-red-500/10 border-red-500/20" },
  };
  const cfg = map[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

type ActiveFilter = "ALL" | "PENDING_REVIEW" | "CLEARED" | "REPORTED";

export default function CompliancePage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ActiveFilter>("PENDING_REVIEW");
  const [page, setPage] = useState(0);
  const [reviewing, setReviewing] = useState<FlaggedTransaction | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: compStats } = useQuery<ComplianceStats>({
    queryKey: ["complianceStats"],
    queryFn: getComplianceStats,
  });

  const { data, isLoading, error } = useQuery<Page<FlaggedTransaction>>({
    queryKey: ["flaggedTxs", { filter, page }],
    queryFn: () => getFlaggedTransactions(page, 20, filter === "ALL" ? undefined : filter),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "CLEAR" | "REPORT" }) =>
      reviewFlaggedTransaction(id, action, reviewNotes),
    onSuccess: (updated) => {
      queryClient.setQueryData<Page<FlaggedTransaction>>(["flaggedTxs", { filter, page }], (prev) =>
        prev ? { ...prev, content: prev.content.map(t => t.id === updated.id ? updated : t) } : prev
      );
      queryClient.invalidateQueries({ queryKey: ["complianceStats"] });
      setReviewing(null);
      setReviewNotes("");
    },
  });

  const [exportBusy, setExportBusy] = useState(false);

  const tabs: { key: ActiveFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "PENDING_REVIEW", label: "Pending Review" },
    { key: "CLEARED", label: "Cleared" },
    { key: "REPORTED", label: "SAR Filed" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Compliance & AML</h1>
          <p className="text-foreground/40 text-sm mt-0.5">Anti-money laundering monitoring and suspicious activity reports</p>
        </div>
        <button
          onClick={async () => {
            setExportBusy(true);
            try { await exportAmlRegisterCsv({ status: filter === "ALL" ? undefined : filter }); }
            finally { setExportBusy(false); }
          }}
          disabled={exportBusy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-muted/30 border border-border text-foreground/60 hover:text-foreground transition-colors disabled:opacity-40 flex-shrink-0"
        >
          {exportBusy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Export AML Register
        </button>
      </div>

      {compStats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "Flagged Today", value: compStats.flaggedToday, color: "text-red-400", icon: AlertTriangle },
            { label: "Pending Review", value: compStats.pendingReview, color: "text-amber-400", icon: Clock },
            { label: "Cleared (Month)", value: compStats.clearedThisMonth, color: "text-emerald-400", icon: CheckCircle2 },
            { label: "SARs Filed", value: compStats.reportsFiledThisMonth, color: "text-red-400", icon: FileText },
            { label: "High Risk Users", value: compStats.highRiskUsers, color: "text-amber-400", icon: ShieldAlert },
            { label: "Avg Risk Score", value: compStats.averageRiskScore.toFixed(0), color: "text-foreground", icon: AlertCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-foreground/35 uppercase tracking-wider font-medium">{label}</p>
                <Icon size={14} className="text-foreground/20" />
              </div>
              <p className={`text-2xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setPage(0); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === tab.key ? "bg-[#B7EE7A] text-black" : "text-foreground/50 hover:text-foreground"
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
      ) : data?.content.length === 0 ? (
        <div className="text-center py-20 text-foreground/25">
          <ShieldAlert size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No flagged transactions found</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">User</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Amount</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden md:table-cell">Reason</th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Risk</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden sm:table-cell">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden lg:table-cell">Flagged</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.content.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-foreground">{tx.userName}</p>
                    {tx.userHandle && <p className="text-xs text-foreground/35">@{tx.userHandle}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-foreground">{fmtGhs(tx.amount)}</p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <p className="text-xs text-foreground/55 max-w-[200px] truncate">{tx.flagReason}</p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <RiskScore score={tx.riskScore} />
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <p className="text-xs text-foreground/35">{fmtDate(tx.flaggedAt)}</p>
                  </td>
                  <td className="px-5 py-4">
                    {tx.status === "PENDING_REVIEW" && (
                      <button
                        onClick={() => { setReviewing(tx); setReviewNotes(""); }}
                        className="px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted border border-border text-xs text-foreground/60 hover:text-foreground transition-all font-medium"
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0 || isLoading} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Previous</button>
          <span className="text-sm text-foreground/40">{page + 1} / {data.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages - 1 || isLoading} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Next</button>
        </div>
      )}

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setReviewing(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-foreground">Review Flagged Transaction</h3>
              <button onClick={() => setReviewing(null)} className="text-foreground/40 hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="bg-muted/20 border border-border rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-foreground/40">User</span>
                <span className="text-foreground font-medium">{reviewing.userName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/40">Amount</span>
                <span className="text-foreground font-semibold">{fmtGhs(reviewing.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/40">Risk Score</span>
                <RiskScore score={reviewing.riskScore} />
              </div>
              <div className="text-sm">
                <span className="text-foreground/40 block mb-1">Flag Reason</span>
                <span className="text-foreground/70 text-xs">{reviewing.flagReason}</span>
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 block">Review Notes</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Document your review findings..."
                rows={3}
                className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 resize-none"
              />
            </div>

            {reviewMutation.error && (
              <p className="text-red-400 text-sm mb-3">{(reviewMutation.error as Error).message}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => reviewMutation.mutate({ id: reviewing.id, action: "CLEAR" })}
                disabled={reviewMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition-all"
              >
                <CheckCircle2 size={15} />
                Clear Transaction
              </button>
              <button
                onClick={() => reviewMutation.mutate({ id: reviewing.id, action: "REPORT" })}
                disabled={reviewMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-all"
              >
                <FileText size={15} />
                File SAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
