"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getFlaggedTransactions,
  getComplianceStats,
  reviewFlaggedTransaction,
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
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${color}`}>{score}</span>
  );
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
  const [data, setData] = useState<Page<FlaggedTransaction> | null>(null);
  const [compStats, setCompStats] = useState<ComplianceStats | null>(null);
  const [filter, setFilter] = useState<ActiveFilter>("PENDING_REVIEW");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<FlaggedTransaction | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    getComplianceStats().then(setCompStats).catch(() => {});
  }, []);

  const load = useCallback(async (p: number, f: ActiveFilter) => {
    setLoading(true);
    setError(null);
    try {
      const status = f === "ALL" ? undefined : f;
      const res = await getFlaggedTransactions(p, 20, status);
      setData(res);
      setPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load flagged transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0, filter); }, [load, filter]);

  const handleReview = async (action: "CLEAR" | "REPORT") => {
    if (!reviewing) return;
    setReviewLoading(true);
    try {
      const updated = await reviewFlaggedTransaction(reviewing.id, action, reviewNotes);
      setData((prev) => prev
        ? { ...prev, content: prev.content.map((t) => t.id === updated.id ? updated : t) }
        : prev
      );
      setReviewing(null);
      setReviewNotes("");
    } catch (e: any) {
      setError(e.message ?? "Review failed");
    } finally {
      setReviewLoading(false);
    }
  };

  const tabs: { key: ActiveFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "PENDING_REVIEW", label: "Pending Review" },
    { key: "CLEARED", label: "Cleared" },
    { key: "REPORTED", label: "SAR Filed" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Compliance & AML</h1>
        <p className="text-white/40 text-sm mt-0.5">Anti-money laundering monitoring and suspicious activity reports</p>
      </div>

      {/* Stats */}
      {compStats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "Flagged Today", value: compStats.flaggedToday, color: "text-red-400", icon: AlertTriangle },
            { label: "Pending Review", value: compStats.pendingReview, color: "text-amber-400", icon: Clock },
            { label: "Cleared (Month)", value: compStats.clearedThisMonth, color: "text-emerald-400", icon: CheckCircle2 },
            { label: "SARs Filed", value: compStats.reportsFiledThisMonth, color: "text-red-400", icon: FileText },
            { label: "High Risk Users", value: compStats.highRiskUsers, color: "text-amber-400", icon: ShieldAlert },
            { label: "Avg Risk Score", value: compStats.averageRiskScore.toFixed(0), color: "text-white", icon: AlertCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-[#161616] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium">{label}</p>
                <Icon size={14} className="text-white/20" />
              </div>
              <p className={`text-2xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === tab.key ? "bg-[#F5A623] text-black" : "text-white/50 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-white/30" size={24} />
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-20 text-white/25">
          <ShieldAlert size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No flagged transactions found</p>
        </div>
      ) : (
        <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">User</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Amount</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden md:table-cell">Reason</th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Risk</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden sm:table-cell">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 hidden lg:table-cell">Flagged</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {data?.content.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-white">{tx.userName}</p>
                    {tx.userHandle && <p className="text-xs text-white/35">@{tx.userHandle}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-white">{fmtGhs(tx.amount)}</p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <p className="text-xs text-white/55 max-w-[200px] truncate">{tx.flagReason}</p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <RiskScore score={tx.riskScore} />
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <p className="text-xs text-white/35">{fmtDate(tx.flaggedAt)}</p>
                  </td>
                  <td className="px-5 py-4">
                    {tx.status === "PENDING_REVIEW" && (
                      <button
                        onClick={() => { setReviewing(tx); setReviewNotes(""); }}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-xs text-white/60 hover:text-white transition-all font-medium"
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
          <button onClick={() => load(page - 1, filter)} disabled={page === 0 || loading} className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5">Previous</button>
          <span className="text-sm text-white/40">{page + 1} / {data.totalPages}</span>
          <button onClick={() => load(page + 1, filter)} disabled={page >= data.totalPages - 1 || loading} className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5">Next</button>
        </div>
      )}

      {/* Review modal */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setReviewing(null)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">Review Flagged Transaction</h3>
              <button onClick={() => setReviewing(null)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="bg-white/4 border border-white/8 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">User</span>
                <span className="text-white font-medium">{reviewing.userName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Amount</span>
                <span className="text-white font-semibold">{fmtGhs(reviewing.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Risk Score</span>
                <RiskScore score={reviewing.riskScore} />
              </div>
              <div className="text-sm">
                <span className="text-white/40 block mb-1">Flag Reason</span>
                <span className="text-white/70 text-xs">{reviewing.flagReason}</span>
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Review Notes</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Document your review findings..."
                rows={3}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleReview("CLEAR")}
                disabled={reviewLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition-all"
              >
                <CheckCircle2 size={15} />
                Clear Transaction
              </button>
              <button
                onClick={() => handleReview("REPORT")}
                disabled={reviewLoading}
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
