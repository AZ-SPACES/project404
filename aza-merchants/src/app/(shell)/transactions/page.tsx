"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getSessions, refundSession,
  CheckoutSession, Page,
} from "@/lib/merchant-api";
import {
  Loader2, AlertCircle, CheckCircle2, Clock, XCircle, Ban,
  ArrowLeftRight, X, Download, RotateCcw,
} from "lucide-react";
import { format, parseISO } from "date-fns";

function fmtGHS(n: number) {
  return `GH₵ ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy · h:mm a"); }
  catch { return iso; }
}

const STATUS_CFG: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  COMPLETED: { icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Paid" },
  PENDING:   { icon: Clock,        cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",       label: "Pending" },
  CANCELLED: { icon: XCircle,      cls: "text-red-400 bg-red-500/10 border-red-500/20",              label: "Cancelled" },
  EXPIRED:   { icon: Ban,          cls: "text-white/30 bg-white/5 border-white/10",                  label: "Expired" },
  REFUNDED:  { icon: RotateCcw,    cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",           label: "Refunded" },
};

const STATUS_TABS = ["ALL", "COMPLETED", "PENDING", "EXPIRED", "CANCELLED", "REFUNDED"];

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  session,
  onClose,
  onRefund,
}: {
  session: CheckoutSession;
  onClose: () => void;
  onRefund: (id: string) => Promise<void>;
}) {
  const cfg = STATUS_CFG[session.status] ?? STATUS_CFG.PENDING;
  const StatusIcon = cfg.icon;
  const [refunding, setRefunding] = useState(false);

  async function handleRefund() {
    if (!confirm("Issue a refund for this payment? The net amount will be returned to the customer.")) return;
    setRefunding(true);
    try {
      await onRefund(session.id);
      onClose();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <p className="text-xs text-white/30 font-mono">{session.id}</p>
            <p className="text-sm font-semibold text-white mt-0.5">{session.description || "Payment"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Amount + status */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-white font-mono">{fmtGHS(session.amount)}</p>
            {session.platformFee != null && (
              <p className="text-xs text-white/30 mt-1">
                Fee: {fmtGHS(session.platformFee)} · Net: {fmtGHS(session.netAmount ?? 0)}
              </p>
            )}
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
            <StatusIcon size={12} />
            {cfg.label}
          </span>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-3">
          {[
            { label: "Created", value: fmtDate(session.createdAt) },
            { label: "Completed", value: fmtDate(session.completedAt) },
            { label: "Expires", value: fmtDate(session.expiresAt) },
            { label: "Refunded", value: fmtDate(session.refundedAt) },
            { label: "Cancelled", value: fmtDate(session.cancelledAt) },
            { label: "Currency", value: session.currency },
          ].filter(({ value }) => value !== "—" || true).map(({ label, value }) => value !== "—" && (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-white/35">{label}</span>
              <span className="text-white/70">{value}</span>
            </div>
          ))}

          {session.successUrl && (
            <div className="flex justify-between text-sm gap-4">
              <span className="text-white/35 flex-shrink-0">Success URL</span>
              <span className="text-white/50 text-xs font-mono truncate">{session.successUrl}</span>
            </div>
          )}
          {session.cancelUrl && (
            <div className="flex justify-between text-sm gap-4">
              <span className="text-white/35 flex-shrink-0">Cancel URL</span>
              <span className="text-white/50 text-xs font-mono truncate">{session.cancelUrl}</span>
            </div>
          )}
          {session.metadata && (
            <div className="mt-2">
              <p className="text-xs text-white/35 mb-1.5">Metadata</p>
              <pre className="text-[11px] text-white/50 bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 overflow-x-auto whitespace-pre-wrap break-all">
                {(() => { try { return JSON.stringify(JSON.parse(session.metadata), null, 2); } catch { return session.metadata; } })()}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-2">
          {session.status === "COMPLETED" && (
            <button
              onClick={handleRefund}
              disabled={refunding}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {refunding ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Issue Refund
            </button>
          )}
          {session.checkoutUrl && (
            <a
              href={session.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/8 text-white/60 hover:text-white text-sm font-medium transition-colors"
            >
              Open Link
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(sessions: CheckoutSession[]) {
  const header = ["ID", "Description", "Amount", "Currency", "Fee", "Net", "Status", "Customer ID", "Created", "Completed"];
  const rows = sessions.map((s) => [
    s.id,
    s.description ?? "",
    s.amount,
    s.currency,
    s.platformFee ?? "",
    s.netAmount ?? "",
    s.status,
    s.customerId ?? "",
    s.createdAt,
    s.completedAt ?? "",
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [data, setData] = useState<Page<CheckoutSession> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CheckoutSession | null>(null);

  const load = useCallback(async (p: number, s: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSessions({ page: p, size: 20, status: s !== "ALL" ? s : undefined });
      setData(res);
      setPage(p);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0, status); }, [load, status]);

  async function handleRefund(id: string) {
    const updated = await refundSession(id);
    setData((d) => d ? { ...d, content: d.content.map((s) => s.id === id ? updated : s) } : d);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {selected && (
        <DetailModal
          session={selected}
          onClose={() => setSelected(null)}
          onRefund={handleRefund}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Transactions</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {data ? `${data.totalElements.toLocaleString()} total` : "All payment sessions"}
          </p>
        </div>
        {data && data.content.length > 0 && (
          <button
            onClick={() => exportCsv(data.content)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/8 text-sm text-white/60 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0"
          >
            <Download size={14} />
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <FilterTabs options={STATUS_TABS} value={status} onChange={setStatus} />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} />{error}
        </div>
      )}

      <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-white/30" size={22} />
          </div>
        ) : data?.content.length === 0 ? (
          <div className="py-16 text-center">
            <ArrowLeftRight size={28} className="mx-auto mb-3 text-white/15" />
            <p className="text-sm text-white/30">No transactions found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["Description", "Date", "Amount", "Fee", "Net", "Status"].map((h, i) => (
                  <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/25 uppercase tracking-wider text-left ${
                    i === 1 ? "hidden sm:table-cell" : ""
                  } ${i === 3 ? "hidden md:table-cell" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {data?.content.map((session) => {
                const cfg = STATUS_CFG[session.status] ?? STATUS_CFG.PENDING;
                const StatusIcon = cfg.icon;
                return (
                  <tr
                    key={session.id}
                    onClick={() => setSelected(session)}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-white/80 text-xs truncate max-w-[160px]">
                        {session.description || "Payment"}
                      </p>
                      <p className="text-[10px] text-white/30 font-mono mt-0.5 truncate max-w-[160px]">{session.id}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-xs text-white/40">
                        {fmtDate(session.completedAt ?? session.createdAt)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-white font-mono">{fmtGHS(session.amount)}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-white/35 font-mono text-xs">
                        {session.platformFee != null ? `-${fmtGHS(session.platformFee)}` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-white/70 font-mono text-xs">
                        {session.netAmount != null ? fmtGHS(session.netAmount) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
                        <StatusIcon size={10} />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button onClick={() => load(page - 1, status)} disabled={page === 0 || loading} className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5">
            Previous
          </button>
          <span className="text-sm text-white/35">{page + 1} / {data.totalPages}</span>
          <button onClick={() => load(page + 1, status)} disabled={page >= data.totalPages - 1 || loading} className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function FilterTabs({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 bg-white/5 p-1 rounded-xl flex-wrap">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === o ? "bg-[#174717] text-white" : "text-white/45 hover:text-white"
          }`}
        >
          {o.charAt(0) + o.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  );
}
