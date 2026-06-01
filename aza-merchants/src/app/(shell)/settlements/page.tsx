"use client";

import { useEffect, useState, useCallback } from "react";
import { getSettlements, getSettlement, Settlement, SettlementDetail, Page } from "@/lib/merchant-api";
import { Loader2, Landmark, ChevronLeft, ChevronRight, X, ArrowUpRight } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-400/10 text-amber-400",
  SETTLED: "bg-[#B7EE7A]/10 text-[#B7EE7A]",
};

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<SettlementDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettlement(id)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <p className="text-xs text-foreground/30 font-mono">{id}</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">Settlement Detail</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-[#B7EE7A]" size={22} />
          </div>
        ) : !detail ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-foreground/40 text-sm">Failed to load detail</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {/* Summary */}
            <div className="px-6 py-5 grid grid-cols-3 gap-4 border-b border-border">
              <div>
                <p className="text-xs text-foreground/30 mb-1">Gross</p>
                <p className="text-base font-bold text-foreground">{fmt(detail.grossAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-foreground/30 mb-1">Fees</p>
                <p className="text-base font-bold text-red-400">-{fmt(detail.feeTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-foreground/30 mb-1">Net settled</p>
                <p className="text-base font-bold text-[#B7EE7A]">{fmt(detail.netAmount)}</p>
              </div>
            </div>

            <div className="px-6 py-4 space-y-2 border-b border-border text-sm">
              <div className="flex justify-between">
                <span className="text-foreground/35">Period</span>
                <span className="text-foreground/70">{fmtDate(detail.periodStart)} – {fmtDate(detail.periodEnd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/35">Transactions</span>
                <span className="text-foreground/70">{detail.transactionCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/35">Settled at</span>
                <span className="text-foreground/70">{fmtDateTime(detail.settledAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground/35">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[detail.status] ?? ""}`}>{detail.status}</span>
              </div>
            </div>

            {/* Items */}
            {detail.items.length > 0 && (
              <div>
                <p className="px-6 py-3 text-xs font-semibold text-foreground/30 uppercase tracking-wider border-b border-border">Included transactions</p>
                <div className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
                  {detail.items.map((item) => (
                    <div key={item.id} className="px-6 py-3 flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-foreground/40 truncate max-w-xs">{item.checkoutSessionId}</span>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-foreground font-medium">{fmt(item.amount)}</p>
                        <p className="text-xs text-foreground/30">fee {fmt(item.fee)} · net {fmt(item.net)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettlementsPage() {
  const [page, setPage] = useState<Page<Settlement> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      setPage(await getSettlements(p, 20));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load settlements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(currentPage); }, [load, currentPage]);

  return (
    <div className="space-y-6">
      {selectedId && <DetailModal id={selectedId} onClose={() => setSelectedId(null)} />}

      <div>
        <h1 className="text-xl font-bold text-foreground">Settlements</h1>
        <p className="text-foreground/40 text-sm mt-0.5">Breakdown of funds settled with each payout</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-[#B7EE7A]" size={22} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : !page || page.content.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Landmark size={32} className="text-foreground/15" />
            <p className="text-foreground/40 text-sm">No settlements yet — they are created when you request a payout</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Settlement</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Gross</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">Fees</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Net</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">Txns</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {page.content.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-mono text-foreground/50">{s.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-foreground/30 mt-0.5">{fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-foreground/70">{fmt(s.grossAmount)}</td>
                      <td className="px-5 py-3.5 text-right text-sm text-red-400/70 hidden md:table-cell">-{fmt(s.feeTotal)}</td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-foreground">{fmt(s.netAmount)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[s.status] ?? "bg-muted/50 text-foreground/40"}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-foreground/40 hidden md:table-cell">{s.transactionCount}</td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setSelectedId(s.id)}
                          className="p-1.5 rounded-lg text-foreground/30 hover:text-foreground hover:bg-muted/30 transition-colors"
                          title="View detail"
                        >
                          <ArrowUpRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {page.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-foreground/30">
                  {page.totalElements} settlements · page {page.number + 1} of {page.totalPages}
                </p>
                <div className="flex gap-1">
                  <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= page.totalPages - 1} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
