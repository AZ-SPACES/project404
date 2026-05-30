"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAnomalyFlaggedTransactions,
  getAdminTransaction,
  AdminTransaction,
  Page,
} from "@/lib/admin-api";
import {
  ShieldAlert,
  AlertTriangle,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const map: Record<string, string> = {
    HIGH: "bg-red-500/10 text-red-400 border-red-500/20",
    MEDIUM: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    LOW: "bg-green-500/10 text-green-400 border-green-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${map[level] ?? "bg-white/5 text-white/40 border-white/10"}`}>
      {level === "HIGH" && <AlertTriangle size={10} />}
      {level}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-white/30 text-xs">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 55 ? "bg-red-400" : pct >= 30 ? "bg-yellow-400" : "bg-green-400";
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-white/50 w-8 text-right">{pct}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: "bg-green-500/10 text-green-400 border-green-500/20",
    PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
    CANCELLED: "bg-white/10 text-white/40 border-white/10",
    REVERSED: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? "bg-white/10 text-white/40 border-white/10"}`}>
      {status}
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-0">
      <span className="text-white/40 text-sm shrink-0">{label}</span>
      <span className="text-white text-sm text-right">{children}</span>
    </div>
  );
}

function FraudDrawer({ txId, onClose }: { txId: string; onClose: () => void }) {
  const { data: tx, isLoading, error } = useQuery<AdminTransaction>({
    queryKey: ["transaction", txId],
    queryFn: () => getAdminTransaction(txId),
  });

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#161616] border-l border-white/5 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="text-base font-semibold text-white">Flagged Transaction</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin text-white/40" size={24} />
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
              {(error as Error).message}
            </div>
          ) : tx ? (
            <div className="space-y-6">
              {/* Anomaly summary card */}
              {tx.anomalyRiskLevel && tx.anomalyRiskLevel !== "LOW" && (
                <div className={`rounded-xl p-4 border flex gap-3 ${
                  tx.anomalyRiskLevel === "HIGH"
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-yellow-500/10 border-yellow-500/20"
                }`}>
                  <AlertTriangle
                    size={16}
                    className={`mt-0.5 flex-shrink-0 ${tx.anomalyRiskLevel === "HIGH" ? "text-red-400" : "text-yellow-400"}`}
                  />
                  <div className="space-y-1">
                    <p className={`text-sm font-semibold ${tx.anomalyRiskLevel === "HIGH" ? "text-red-400" : "text-yellow-400"}`}>
                      {tx.anomalyRiskLevel === "HIGH" ? "High Risk Transaction" : "Unusual Transaction"}
                    </p>
                    <p className="text-xs text-white/50">
                      Anomaly score: {tx.anomalyScore != null ? `${Math.round(tx.anomalyScore * 100)}%` : "—"}
                    </p>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  GHS {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <StatusBadge status={tx.status} />
                  <RiskBadge level={tx.anomalyRiskLevel} />
                  {tx.category && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#B7EE7A]/10 text-[#B7EE7A] border border-[#B7EE7A]/20">
                      {tx.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Sender / Recipient */}
              <div>
                <div className="text-xs text-white/30 uppercase tracking-wider font-medium mb-2">Sender</div>
                <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4">
                  <div className="text-white font-medium">{tx.senderName}</div>
                  {tx.senderHandle && <div className="text-white/40 text-sm">@{tx.senderHandle}</div>}
                  <div className="text-white/25 text-xs mt-1 font-mono">{tx.senderId}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-white/30 uppercase tracking-wider font-medium mb-2">Recipient</div>
                <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4">
                  <div className="text-white font-medium">{tx.recipientName}</div>
                  {tx.recipientHandle && <div className="text-white/40 text-sm">@{tx.recipientHandle}</div>}
                  <div className="text-white/25 text-xs mt-1 font-mono">{tx.recipientId}</div>
                </div>
              </div>

              {/* Details */}
              <div>
                <div className="text-xs text-white/30 uppercase tracking-wider font-medium mb-2">Details</div>
                <div className="bg-[#1a1a1a] border border-white/5 rounded-xl px-4">
                  <DetailRow label="Transaction ID">
                    <span className="font-mono text-xs text-white/70 break-all">{tx.id}</span>
                  </DetailRow>
                  <DetailRow label="Note">
                    {tx.note ? <span className="text-white/70">{tx.note}</span> : <span className="text-white/25">None</span>}
                  </DetailRow>
                  <DetailRow label="Category">
                    {tx.category ? <span className="text-[#B7EE7A]">{tx.category}</span> : <span className="text-white/25">Uncategorised</span>}
                  </DetailRow>
                  <DetailRow label="Initiated">{fmt(tx.initiatedAt)}</DetailRow>
                  <DetailRow label="Completed">{fmt(tx.completedAt)}</DetailRow>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

const RISK_FILTERS = [
  { label: "All flagged", value: "" },
  { label: "High risk", value: "HIGH" },
  { label: "Medium risk", value: "MEDIUM" },
];

export default function FraudDetectionPage() {
  const [page, setPage] = useState(0);
  const [riskLevel, setRiskLevel] = useState("");
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<Page<AdminTransaction>>({
    queryKey: ["fraud-flagged", page, riskLevel],
    queryFn: () => getAnomalyFlaggedTransactions(page, 20, riskLevel || undefined),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1 flex items-center gap-2">
            <ShieldAlert size={22} className="text-red-400" />
            Fraud Detection
          </h1>
          <p className="text-white/50 text-sm">
            Transactions flagged by the AI anomaly scorer — review for suspicious activity
          </p>
        </div>

        {/* Risk filter */}
        <div className="flex gap-2">
          {RISK_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setRiskLevel(f.value); setPage(0); }}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                riskLevel === f.value
                  ? "bg-[#B7EE7A]/15 text-[#B7EE7A] border-[#B7EE7A]/30"
                  : "bg-white/5 text-white/50 border-white/10 hover:text-white hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-24 text-white/30">
          <ShieldAlert size={40} className="mx-auto mb-4 opacity-40" />
          <p>No flagged transactions</p>
          <p className="text-sm mt-1 text-white/20">All transactions look normal for the selected filter</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-white/40 font-medium">From</th>
                <th className="text-left px-4 py-3 text-white/40 font-medium">To</th>
                <th className="text-right px-4 py-3 text-white/40 font-medium">Amount</th>
                <th className="text-center px-4 py-3 text-white/40 font-medium">Category</th>
                <th className="text-center px-4 py-3 text-white/40 font-medium">Risk</th>
                <th className="text-right px-4 py-3 text-white/40 font-medium">Score</th>
                <th className="text-right px-4 py-3 text-white/40 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {data?.content.map((tx, i) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelectedTxId(tx.id)}
                  className={`border-b border-white/5 hover:bg-white/[0.05] cursor-pointer transition-colors ${
                    i % 2 === 0 ? "" : "bg-white/[0.02]"
                  } ${selectedTxId === tx.id ? "bg-[#B7EE7A]/5" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-sm">{tx.senderName}</div>
                    {tx.senderHandle && <div className="text-white/30 text-xs">@{tx.senderHandle}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-sm">{tx.recipientName}</div>
                    {tx.recipientHandle && <div className="text-white/30 text-xs">@{tx.recipientHandle}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-white font-semibold">GHS {Number(tx.amount).toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tx.category ? (
                      <span className="text-xs text-[#B7EE7A] bg-[#B7EE7A]/10 border border-[#B7EE7A]/20 px-2 py-0.5 rounded-full">
                        {tx.category}
                      </span>
                    ) : (
                      <span className="text-white/25 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RiskBadge level={tx.anomalyRiskLevel} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ScoreBar score={tx.anomalyScore} />
                  </td>
                  <td className="px-4 py-3 text-right text-white/40 text-xs whitespace-nowrap">
                    {fmt(tx.initiatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0 || isLoading}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-white/50">{page + 1} / {data.totalPages}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= data.totalPages - 1 || isLoading}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {selectedTxId && (
        <FraudDrawer txId={selectedTxId} onClose={() => setSelectedTxId(null)} />
      )}
    </div>
  );
}
