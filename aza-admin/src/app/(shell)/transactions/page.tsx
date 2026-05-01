"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAdminTransactions,
  getAdminTransaction,
  AdminTransaction,
  Page,
} from "@/lib/admin-api";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    COMPLETED: {
      label: "Completed",
      className: "bg-green-500/10 text-green-400 border-green-500/20",
      icon: <CheckCircle2 size={11} />,
    },
    PENDING: {
      label: "Pending",
      className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      icon: <Clock size={11} />,
    },
    FAILED: {
      label: "Failed",
      className: "bg-red-500/10 text-red-400 border-red-500/20",
      icon: <XCircle size={11} />,
    },
    CANCELLED: {
      label: "Cancelled",
      className: "bg-white/10 text-white/40 border-white/10",
      icon: <XCircle size={11} />,
    },
    DECLINED: {
      label: "Declined",
      className: "bg-red-500/10 text-red-400 border-red-500/20",
      icon: <AlertCircle size={11} />,
    },
  };
  const s = map[status] ?? {
    label: status,
    className: "bg-white/10 text-white/40 border-white/10",
    icon: null,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.className}`}
    >
      {s.icon}
      {s.label}
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

function TransactionDrawer({
  txId,
  onClose,
}: {
  txId: string;
  onClose: () => void;
}) {
  const [tx, setTx] = useState<AdminTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAdminTransaction(txId)
      .then(setTx)
      .catch((e: any) => setError(e.message ?? "Failed to load transaction"))
      .finally(() => setLoading(false));
  }, [txId]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#161616] border-l border-white/5 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="text-base font-semibold text-white">Transaction Details</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin text-white/40" size={24} />
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          ) : tx ? (
            <div className="space-y-6">
              {/* Amount hero */}
              <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  GHS {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <StatusBadge status={tx.status} />
                  <span className="inline-flex items-center gap-1 text-xs text-white/40">
                    {tx.type === "TRANSFER" ? (
                      <ArrowUpRight size={12} />
                    ) : (
                      <ArrowDownLeft size={12} />
                    )}
                    {tx.type}
                  </span>
                </div>
              </div>

              {/* Sender */}
              <div>
                <div className="text-xs text-white/30 uppercase tracking-wider font-medium mb-2">
                  Sender
                </div>
                <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4">
                  <div className="text-white font-medium">{tx.senderName}</div>
                  {tx.senderHandle && (
                    <div className="text-white/40 text-sm">@{tx.senderHandle}</div>
                  )}
                  <div className="text-white/25 text-xs mt-1 font-mono">{tx.senderId}</div>
                </div>
              </div>

              {/* Recipient */}
              <div>
                <div className="text-xs text-white/30 uppercase tracking-wider font-medium mb-2">
                  Recipient
                </div>
                <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4">
                  <div className="text-white font-medium">{tx.recipientName}</div>
                  {tx.recipientHandle && (
                    <div className="text-white/40 text-sm">@{tx.recipientHandle}</div>
                  )}
                  <div className="text-white/25 text-xs mt-1 font-mono">{tx.recipientId}</div>
                </div>
              </div>

              {/* Details */}
              <div>
                <div className="text-xs text-white/30 uppercase tracking-wider font-medium mb-2">
                  Details
                </div>
                <div className="bg-[#1a1a1a] border border-white/5 rounded-xl px-4">
                  <DetailRow label="Transaction ID">
                    <span className="font-mono text-xs text-white/70 break-all">{tx.id}</span>
                  </DetailRow>
                  <DetailRow label="Type">{tx.type}</DetailRow>
                  <DetailRow label="Status">
                    <StatusBadge status={tx.status} />
                  </DetailRow>
                  <DetailRow label="Note">
                    {tx.note ? (
                      <span className="text-white/70">{tx.note}</span>
                    ) : (
                      <span className="text-white/25">No note</span>
                    )}
                  </DetailRow>
                  <DetailRow label="Initiated">{fmt(tx.initiatedAt)}</DetailRow>
                  <DetailRow label="Completed">{fmt(tx.completedAt)}</DetailRow>
                  {tx.cancelledAt && (
                    <DetailRow label="Cancelled">{fmt(tx.cancelledAt)}</DetailRow>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function TransactionsPage() {
  const [data, setData] = useState<Page<AdminTransaction> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminTransactions(p, 20);
      setData(res);
      setPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Transactions</h1>
        <p className="text-white/50 text-sm">
          All platform transactions, newest first — click a row to view details
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-24 text-white/30">
          <ArrowUpRight size={40} className="mx-auto mb-4 opacity-40" />
          <p>No transactions yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/3">
                <th className="text-left px-4 py-3 text-white/40 font-medium">From</th>
                <th className="text-left px-4 py-3 text-white/40 font-medium">To</th>
                <th className="text-right px-4 py-3 text-white/40 font-medium">Amount</th>
                <th className="text-center px-4 py-3 text-white/40 font-medium">Type</th>
                <th className="text-center px-4 py-3 text-white/40 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-white/40 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {data?.content.map((tx, i) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelectedTxId(tx.id)}
                  className={`border-b border-white/5 hover:bg-white/[0.05] transition-colors cursor-pointer ${
                    i % 2 === 0 ? "" : "bg-white/[0.02]"
                  } ${selectedTxId === tx.id ? "bg-[#F5A623]/5" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-sm">{tx.senderName}</div>
                    {tx.senderHandle && (
                      <div className="text-white/30 text-xs">@{tx.senderHandle}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-sm">{tx.recipientName}</div>
                    {tx.recipientHandle && (
                      <div className="text-white/30 text-xs">@{tx.recipientHandle}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-white font-semibold">
                      GHS {Number(tx.amount).toFixed(2)}
                    </span>
                    {tx.note && (
                      <div className="text-white/30 text-xs truncate max-w-[120px] ml-auto">
                        {tx.note}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-white/50">
                      {tx.type === "TRANSFER" ? (
                        <ArrowUpRight size={12} />
                      ) : (
                        <ArrowDownLeft size={12} />
                      )}
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={tx.status} />
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
            onClick={() => load(page - 1)}
            disabled={page === 0 || loading}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-white/50">
            {page + 1} / {data.totalPages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= data.totalPages - 1 || loading}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {selectedTxId && (
        <TransactionDrawer txId={selectedTxId} onClose={() => setSelectedTxId(null)} />
      )}
    </div>
  );
}
