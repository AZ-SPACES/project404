"use client";

import { useEffect, useState, useCallback } from "react";
import { getMerchantDisputes, respondToDispute, MerchantDispute, Page } from "@/lib/merchant-api";
import { Loader2, ShieldAlert, ChevronLeft, ChevronRight, X, Send, MessageSquare, CheckCircle2 } from "lucide-react";

function fmt(n: number | null, currency: string | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: currency ?? "GHS" }).format(n);
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-amber-400/10 text-amber-400",
  UNDER_REVIEW: "bg-blue-400/10 text-blue-400",
  RESOLVED_APPROVED: "bg-[#B7EE7A]/10 text-[#B7EE7A]",
  RESOLVED_DENIED: "bg-red-400/10 text-red-400",
  RESOLVED: "bg-[#B7EE7A]/10 text-[#B7EE7A]",
  CLOSED: "bg-muted/50 text-foreground/50",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

// ─── Dispute detail + response modal ─────────────────────────────────────────

function DisputeModal({
  dispute,
  onClose,
  onResponded,
}: {
  dispute: MerchantDispute;
  onClose: () => void;
  onResponded: (updated: MerchantDispute) => void;
}) {
  const [response, setResponse] = useState(dispute.merchantResponse ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(!!dispute.merchantResponse);

  const canRespond = !done && !["RESOLVED_APPROVED", "RESOLVED_DENIED", "CLOSED"].includes(dispute.status);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!response.trim()) { setError("Response cannot be empty"); return; }
    setError(null);
    setSubmitting(true);
    try {
      const updated = await respondToDispute(dispute.id, response.trim());
      onResponded(updated);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit response");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="text-xs text-foreground/30 font-mono">{dispute.referenceId ?? dispute.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {dispute.category?.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) ?? "Dispute"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/20 rounded-xl p-3">
              <p className="text-[10px] text-foreground/35 uppercase tracking-wider mb-1">Amount</p>
              <p className="text-sm font-semibold text-foreground">{fmt(dispute.amount, dispute.currency)}</p>
            </div>
            <div className="bg-muted/20 rounded-xl p-3">
              <p className="text-[10px] text-foreground/35 uppercase tracking-wider mb-1">Status</p>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[dispute.status] ?? "bg-muted/50 text-foreground/50"}`}>
                {statusLabel(dispute.status)}
              </span>
            </div>
          </div>

          {/* Customer's description */}
          {dispute.description && (
            <div>
              <p className="text-xs text-foreground/40 mb-1.5">Customer's claim</p>
              <div className="bg-muted/20 rounded-xl p-3.5 text-sm text-foreground/70 leading-relaxed">
                {dispute.description}
              </div>
            </div>
          )}

          {/* Existing merchant response */}
          {dispute.merchantResponse && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 size={12} className="text-[#B7EE7A]" />
                <p className="text-xs text-foreground/40">
                  Your response · {dispute.merchantRespondedAt ? fmtDateTime(dispute.merchantRespondedAt) : ""}
                </p>
              </div>
              <div className="bg-[#B7EE7A]/5 border border-[#B7EE7A]/15 rounded-xl p-3.5 text-sm text-foreground/70 leading-relaxed">
                {dispute.merchantResponse}
              </div>
            </div>
          )}

          {/* Response form */}
          {canRespond && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MessageSquare size={12} className="text-foreground/40" />
                  <label className="text-xs text-foreground/40">Submit your response</label>
                </div>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={4}
                  placeholder="Explain your side of the dispute, provide order details, delivery confirmation, etc."
                  className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[#B7EE7A]/60 transition-all resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !response.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-40 text-foreground font-semibold text-sm transition-colors"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? "Submitting…" : "Submit response"}
              </button>
            </form>
          )}

          {!canRespond && !dispute.merchantResponse && (
            <p className="text-xs text-foreground/35 text-center py-2">
              This dispute has been resolved. No further response is needed.
            </p>
          )}

          <div className="text-[10px] text-foreground/25 text-center pt-1">
            Opened {fmtDate(dispute.createdAt)}
            {dispute.resolvedAt && ` · Resolved ${fmtDate(dispute.resolvedAt)}`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DisputesPage() {
  const [page, setPage] = useState<Page<MerchantDispute> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MerchantDispute | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMerchantDisputes(p, 20);
      setPage(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(currentPage); }, [load, currentPage]);

  function handleResponded(updated: MerchantDispute) {
    setPage((prev) => prev ? {
      ...prev,
      content: prev.content.map((d) => d.id === updated.id ? updated : d),
    } : prev);
    setSelected(updated);
  }

  return (
    <>
      {selected && (
        <DisputeModal
          dispute={selected}
          onClose={() => setSelected(null)}
          onResponded={handleResponded}
        />
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Disputes</h1>
          <p className="text-foreground/40 text-sm mt-0.5">Customer disputes — click any row to view details or submit a response</p>
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
              <ShieldAlert size={32} className="text-foreground/15" />
              <p className="text-foreground/40 text-sm">No disputes found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Reference</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">Category</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Amount</th>
                      <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Status</th>
                      <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden sm:table-cell">Response</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">Opened</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {page.content.map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => setSelected(d)}
                        className="hover:bg-muted/10 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-foreground font-mono">{d.referenceId ?? d.id.slice(0, 8).toUpperCase()}</p>
                          {d.description && <p className="text-xs text-foreground/40 mt-0.5 truncate max-w-xs">{d.description}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-foreground/60 hidden md:table-cell capitalize">
                          {d.category?.replace(/_/g, " ").toLowerCase() ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm font-medium text-foreground">{fmt(d.amount, d.currency)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[d.status] ?? "bg-muted/50 text-foreground/50"}`}>
                            {statusLabel(d.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center hidden sm:table-cell">
                          {d.merchantResponse ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#B7EE7A]">
                              <CheckCircle2 size={11} />Responded
                            </span>
                          ) : ["RESOLVED_APPROVED", "RESOLVED_DENIED", "CLOSED"].includes(d.status) ? (
                            <span className="text-[11px] text-foreground/30">Closed</span>
                          ) : (
                            <span className="text-[11px] text-amber-400">Awaiting</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-foreground/40 hidden md:table-cell">{fmtDate(d.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {page.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <p className="text-xs text-foreground/30">
                    {page.totalElements} disputes · page {page.number + 1} of {page.totalPages}
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
    </>
  );
}
