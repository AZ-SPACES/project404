"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAnomalyFlaggedTransactions,
  getAdminTransaction,
  getAiOpinion,
  getHeldTransfers,
  releaseHeldTransfer,
  rejectHeldTransfer,
  AdminTransaction,
  Page,
  type FraudAiAssessment,
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${map[level] ?? "bg-muted/30 text-foreground/40 border-border"}`}>
      {level === "HIGH" && <AlertTriangle size={10} />}
      {level}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-foreground/30 text-xs">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 55 ? "bg-red-400" : pct >= 30 ? "bg-yellow-400" : "bg-green-400";
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-foreground/50 w-8 text-right">{pct}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: "bg-green-500/10 text-green-400 border-green-500/20",
    PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
    CANCELLED: "bg-muted/50 text-foreground/40 border-border",
    REVERSED: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    HELD_FOR_REVIEW: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? "bg-muted/50 text-foreground/40 border-border"}`}>
      {status}
    </span>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <span className="text-foreground/40 text-sm shrink-0">{label}</span>
      <span className="text-foreground text-sm text-right">{children}</span>
    </div>
  );
}

function FraudDrawer({ txId, onClose }: { txId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState("");

  const { data: tx, isLoading, error } = useQuery<AdminTransaction>({
    queryKey: ["transaction", txId],
    queryFn: () => getAdminTransaction(txId),
  });

  const decide = useMutation({
    mutationFn: ({ release }: { release: boolean }) =>
      release ? releaseHeldTransfer(txId) : rejectHeldTransfer(txId),
    onMutate: () => setActionError(""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud-held"] });
      queryClient.invalidateQueries({ queryKey: ["transaction", txId] });
      queryClient.invalidateQueries({ queryKey: ["fraud-flagged"] });
    },
    onError: (e: Error) => setActionError(e.message),
  });

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Flagged Transaction</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin text-foreground/40" size={24} />
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
                    <p className="text-xs text-foreground/50">
                      Anomaly score: {tx.anomalyScore != null ? `${Math.round(tx.anomalyScore * 100)}%` : "—"}
                    </p>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="bg-card border border-border rounded-xl p-5 text-center">
                <div className="text-3xl font-bold text-foreground mb-1">
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
                <div className="text-xs text-foreground/30 uppercase tracking-wider font-medium mb-2">Sender</div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-foreground font-medium">{tx.senderName}</div>
                  {tx.senderHandle && <div className="text-foreground/40 text-sm">@{tx.senderHandle}</div>}
                  <div className="text-foreground/25 text-xs mt-1 font-mono">{tx.senderId}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-foreground/30 uppercase tracking-wider font-medium mb-2">Recipient</div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="text-foreground font-medium">{tx.recipientName}</div>
                  {tx.recipientHandle && <div className="text-foreground/40 text-sm">@{tx.recipientHandle}</div>}
                  <div className="text-foreground/25 text-xs mt-1 font-mono">{tx.recipientId}</div>
                </div>
              </div>

              {/* Details */}
              <div>
                <div className="text-xs text-foreground/30 uppercase tracking-wider font-medium mb-2">Details</div>
                <div className="bg-card border border-border rounded-xl px-4">
                  <DetailRow label="Transaction ID">
                    <span className="font-mono text-xs text-foreground/70 break-all">{tx.id}</span>
                  </DetailRow>
                  <DetailRow label="Note">
                    {tx.note ? <span className="text-foreground/70">{tx.note}</span> : <span className="text-foreground/25">None</span>}
                  </DetailRow>
                  <DetailRow label="Category">
                    {tx.category ? <span className="text-[#B7EE7A]">{tx.category}</span> : <span className="text-foreground/25">Uncategorised</span>}
                  </DetailRow>
                  <DetailRow label="Initiated">{fmt(tx.initiatedAt)}</DetailRow>
                  <DetailRow label="Completed">{fmt(tx.completedAt)}</DetailRow>
                </div>
              </div>

              {/* Release / Reject actions — only for intercepted transfers */}
              {tx.status === "HELD_FOR_REVIEW" && (
                <div className="space-y-3">
                  <p className="text-xs text-foreground/40 leading-relaxed">
                    This transfer was intercepted before any money moved.
                    <strong className="text-foreground/60"> Release</strong> executes it;
                    <strong className="text-foreground/60"> Reject</strong> cancels it and notifies the sender.
                  </p>
                  {actionError && (
                    <p className="text-xs text-red-400">{actionError}</p>
                  )}
                  {decide.isSuccess ? (
                    <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                      <CheckCircle2 size={14} />
                      Decision recorded successfully.
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={() => decide.mutate({ release: true })}
                        disabled={decide.isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-medium hover:bg-green-500/20 disabled:opacity-40 transition-colors"
                      >
                        {decide.isPending && decide.variables?.release ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        Release transfer
                      </button>
                      <button
                        onClick={() => decide.mutate({ release: false })}
                        disabled={decide.isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                      >
                        {decide.isPending && !decide.variables?.release ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <XCircle size={14} />
                        )}
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
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

function HeldTransfersSection() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [opinions, setOpinions] = useState<Record<string, FraudAiAssessment>>({});
  const [askingAi, setAskingAi] = useState<string | null>(null);

  const { data: held } = useQuery<Page<AdminTransaction>>({
    queryKey: ["fraud-held"],
    queryFn: () => getHeldTransfers(0, 50),
  });

  const decide = useMutation({
    mutationFn: ({ id, release }: { id: string; release: boolean }) =>
      release ? releaseHeldTransfer(id) : rejectHeldTransfer(id),
    onMutate: ({ id, release }) => {
      setError("");
      setActing(`${id}:${release}`);
    },
    onSettled: () => setActing(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fraud-held"] }),
    onError: (e: Error) => setError(e.message),
  });

  async function askAi(id: string) {
    setAskingAi(id);
    setError("");
    try {
      const assessment = await getAiOpinion(id);
      setOpinions((prev) => ({ ...prev, [id]: assessment }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI assessment failed");
    } finally {
      setAskingAi(null);
    }
  }

  const VERDICT_STYLES: Record<string, string> = {
    LIKELY_FRAUD: "bg-red-500/10 text-red-400 border-red-500/20",
    LIKELY_LEGITIMATE: "bg-green-500/10 text-green-400 border-green-500/20",
    UNCERTAIN: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };

  if (!held || held.content.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={16} className="text-orange-400" />
        <h2 className="font-medium text-foreground">Held for review ({held.totalElements})</h2>
      </div>
      <p className="text-xs text-foreground/40 mb-4">
        High-anomaly transfers intercepted before any money moved. Release executes the transfer; reject
        cancels it and notifies the sender.
      </p>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden bg-card">
        {held.content.map((tx) => (
          <div key={tx.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium truncate">
                  {tx.senderName} → {tx.recipientName} ·{" "}
                  GHS {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-foreground/40 truncate">
                  Score {tx.anomalyScore != null ? `${Math.round(tx.anomalyScore * 100)}%` : "—"} ·
                  initiated {fmt(tx.initiatedAt)}{tx.note ? ` · "${tx.note}"` : ""}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => askAi(tx.id)}
                  disabled={askingAi !== null}
                  title="Ask Claude for a second opinion (takes up to a minute)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 text-foreground/60 border border-border text-xs font-medium hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  {askingAi === tx.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                  AI opinion
                </button>
                <button
                  onClick={() => decide.mutate({ id: tx.id, release: true })}
                  disabled={decide.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium hover:bg-green-500/20 disabled:opacity-30 transition-colors"
                >
                  {acting === `${tx.id}:true` ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Release
                </button>
                <button
                  onClick={() => decide.mutate({ id: tx.id, release: false })}
                  disabled={decide.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 disabled:opacity-30 transition-colors"
                >
                  {acting === `${tx.id}:false` ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                  Reject
                </button>
              </div>
            </div>
            {opinions[tx.id] && (
              <div className="mt-3 ml-1 rounded-lg border border-border bg-muted/10 px-4 py-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border mb-2 ${VERDICT_STYLES[opinions[tx.id].verdict] ?? VERDICT_STYLES.UNCERTAIN}`}
                >
                  {opinions[tx.id].verdict.replace("_", " ")} · {opinions[tx.id].confidence}% confidence
                </span>
                <p className="text-xs text-foreground/60 leading-relaxed">{opinions[tx.id].reasoning}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

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
          <h1 className="text-2xl font-semibold text-foreground mb-1 flex items-center gap-2">
            <ShieldAlert size={22} className="text-red-400" />
            Fraud Detection
          </h1>
          <p className="text-foreground/50 text-sm">
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
                  : "bg-muted/30 text-foreground/50 border-border hover:text-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <HeldTransfersSection />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-24 text-foreground/30">
          <ShieldAlert size={40} className="mx-auto mb-4 opacity-40" />
          <p>No flagged transactions</p>
          <p className="text-sm mt-1 text-foreground/20">All transactions look normal for the selected filter</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="text-left px-4 py-3 text-foreground/40 font-medium">From</th>
                <th className="text-left px-4 py-3 text-foreground/40 font-medium">To</th>
                <th className="text-right px-4 py-3 text-foreground/40 font-medium">Amount</th>
                <th className="text-center px-4 py-3 text-foreground/40 font-medium">Category</th>
                <th className="text-center px-4 py-3 text-foreground/40 font-medium">Risk</th>
                <th className="text-right px-4 py-3 text-foreground/40 font-medium">Score</th>
                <th className="text-right px-4 py-3 text-foreground/40 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {data?.content.map((tx, i) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelectedTxId(tx.id)}
                  className={`border-b border-border hover:bg-muted/50 cursor-pointer transition-colors ${
                    i % 2 === 0 ? "" : "bg-muted/10"
                  } ${selectedTxId === tx.id ? "bg-[#B7EE7A]/5" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="text-foreground font-medium text-sm">{tx.senderName}</div>
                    {tx.senderHandle && <div className="text-foreground/30 text-xs">@{tx.senderHandle}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground font-medium text-sm">{tx.recipientName}</div>
                    {tx.recipientHandle && <div className="text-foreground/30 text-xs">@{tx.recipientHandle}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-foreground font-semibold">GHS {Number(tx.amount).toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tx.category ? (
                      <span className="text-xs text-[#B7EE7A] bg-[#B7EE7A]/10 border border-[#B7EE7A]/20 px-2 py-0.5 rounded-full">
                        {tx.category}
                      </span>
                    ) : (
                      <span className="text-foreground/25 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RiskBadge level={tx.anomalyRiskLevel} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ScoreBar score={tx.anomalyScore} />
                  </td>
                  <td className="px-4 py-3 text-right text-foreground/40 text-xs whitespace-nowrap">
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
            className="px-4 py-2 text-sm rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-foreground/50">{page + 1} / {data.totalPages}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= data.totalPages - 1 || isLoading}
            className="px-4 py-2 text-sm rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
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
