"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getSessions,
  createSession,
  expireSession,
  getSessionsSummary,
  CheckoutSession,
  SessionsSummary,
  Page,
} from "@/lib/merchant-api";
import {
  Loader2,
  AlertCircle,
  Plus,
  Link2,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  Copy,
  Check,
  X,
  ExternalLink,
  Search,
  Hash,
  Calculator,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";

function fmtGHS(n: number) {
  return `GH₵ ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "MMM d, yyyy · h:mm a"); }
  catch { return iso; }
}

const STATUS_CFG: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  PENDING:   { icon: Clock,        cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",   label: "Pending" },
  COMPLETED: { icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Paid" },
  CANCELLED: { icon: XCircle,      cls: "text-red-400 bg-red-500/10 border-red-500/20",           label: "Cancelled" },
  EXPIRED:   { icon: Ban,          cls: "text-foreground/30 bg-muted/30 border-border",                label: "Expired" },
};

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutSession | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid amount");
      const res = await createSession({
        amount: amt,
        description: description || undefined,
        reference: reference.trim() || undefined,
      });
      setResult(res);
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (result?.checkoutUrl) {
      navigator.clipboard.writeText(result.checkoutUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-foreground/30 hover:text-foreground hover:bg-muted/40 transition-colors">
          <X size={16} />
        </button>
        <h3 className="text-base font-semibold text-foreground mb-5">New payment link</h3>

        {!result ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground/50 mb-1.5">Amount (GHS) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 text-sm">GH₵</span>
                <input
                  type="number" step="0.01" min="0.01" required
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/50 mb-1.5">Description <span className="text-foreground/25 font-normal">optional</span></label>
              <input
                type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this payment for?"
                className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/50 mb-1.5">Reference <span className="text-foreground/25 font-normal">optional</span></label>
              <input
                type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                maxLength={255}
                placeholder="Order or tenant/seller ID"
                className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
              />
              <p className="text-[11px] text-foreground/30 mt-1.5 leading-snug">Your own ID for this payment. Filter and reconcile by it later; included in the webhook payload.</p>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-foreground font-semibold text-sm transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Creating…" : "Create link"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-[#B7EE7A]/8 border border-[#B7EE7A]/20 rounded-xl">
              <CheckCircle2 size={16} className="text-[#B7EE7A] flex-shrink-0" />
              <p className="text-sm text-[#B7EE7A] font-medium">Link created · expires in 30 min</p>
            </div>
            <div className="bg-black/30 border border-border rounded-xl p-3 break-all">
              <p className="text-[10px] text-foreground/30 mb-1.5 uppercase tracking-wider font-medium">URL</p>
              <p className="text-xs text-foreground/70 font-mono">{result.checkoutUrl}</p>
            </div>
            {result.reference && (
              <div className="bg-black/30 border border-border rounded-xl p-3 break-all">
                <p className="text-[10px] text-foreground/30 mb-1.5 uppercase tracking-wider font-medium">Reference</p>
                <p className="text-xs text-foreground/70 font-mono">{result.reference}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={copy} className="flex-1 py-2.5 rounded-xl bg-muted/30 border border-border text-foreground/60 hover:text-foreground hover:bg-muted font-medium text-sm transition-colors flex items-center justify-center gap-2">
                {copied ? <Check size={13} className="text-[#B7EE7A]" /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <a
                href={result.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-muted/30 border border-border text-foreground/60 hover:text-foreground hover:bg-muted font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink size={13} />
                Open
              </a>
            </div>
            <button onClick={onClose} className="w-full py-2 text-sm text-foreground/30 hover:text-foreground/60 transition-colors">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PaymentLinksPage() {
  const [data, setData] = useState<Page<CheckoutSession> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [expiring, setExpiring] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refInput, setRefInput] = useState("");
  const [reference, setReference] = useState("");
  const [summary, setSummary] = useState<SessionsSummary | null>(null);

  const load = useCallback(async (p: number, s: string, ref: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSessions({
        page: p,
        size: 20,
        status: s !== "ALL" ? s : undefined,
        reference: ref || undefined,
      });
      setData(res);
      setPage(p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0, statusFilter, reference); }, [load, statusFilter, reference]);

  // When filtering by a reference, also pull the reconciliation totals for it.
  // The render is guarded on summary.reference === reference, so a stale summary
  // for a previous reference never shows while a new one loads.
  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    getSessionsSummary(reference)
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [reference]);

  function applyReference(e: React.FormEvent) {
    e.preventDefault();
    setReference(refInput.trim());
  }

  function clearReference() {
    setRefInput("");
    setReference("");
  }

  async function handleExpire(id: string) {
    setExpiring(id);
    try {
      await expireSession(id);
      load(page, statusFilter, reference);
    } catch {}
    setExpiring(null);
  }

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const STATUS_TABS = ["ALL", "PENDING", "COMPLETED", "CANCELLED", "EXPIRED"];

  return (
    <>
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => load(0, statusFilter, reference)}
        />
      )}

      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Payment Links</h1>
            <p className="text-foreground/40 text-sm mt-0.5">Checkout sessions you've generated</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-foreground font-semibold text-sm transition-colors"
          >
            <Plus size={15} />
            New link
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit flex-wrap">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === s ? "bg-[#174717] text-foreground" : "text-foreground/45 hover:text-foreground"
                }`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <form onSubmit={applyReference} className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none" />
            <input
              type="text"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="Filter by reference…"
              className="w-56 pl-9 pr-8 py-2 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-xs transition-all"
            />
            {reference && (
              <button type="button" onClick={clearReference} title="Clear" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-foreground/30 hover:text-foreground transition-colors">
                <X size={13} />
              </button>
            )}
          </form>
        </div>

        {reference && summary && summary.reference === reference && (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 bg-[#B7EE7A]/[0.06] border border-[#B7EE7A]/20 rounded-xl">
            <div className="flex items-center gap-2 text-foreground/60">
              <Calculator size={15} className="text-[#B7EE7A]" />
              <span className="text-xs font-medium">Reconciliation</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 text-[11px] font-mono text-foreground/70">
                <Hash size={10} className="text-foreground/35" />{summary.reference}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/30 font-medium">Paid sessions</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{summary.completedCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/30 font-medium">Gross collected</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{fmtGHS(summary.totalAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/30 font-medium">Net (after fees)</p>
              <p className="text-sm font-semibold text-[#B7EE7A] mt-0.5">{fmtGHS(summary.totalNetAmount)}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={15} />{error}
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin text-foreground/30" size={22} />
            </div>
          ) : data?.content.length === 0 ? (
            <div className="py-16 text-center">
              <Link2 size={28} className="mx-auto mb-3 text-foreground/15" />
              <p className="text-sm text-foreground/30">No payment links yet</p>
              <button onClick={() => setShowCreate(true)} className="mt-3 text-xs text-[#B7EE7A] hover:underline">Create your first link</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Amount", "Description", "Created", "Expires", "Status", ""].map((h, i) => (
                    <th key={i} className={`px-5 py-3 text-[10px] font-semibold text-foreground/25 uppercase tracking-wider text-left ${
                      i === 3 ? "hidden md:table-cell" : i === 1 ? "hidden sm:table-cell" : ""
                    }`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {data?.content.map((s) => {
                  const cfg = STATUS_CFG[s.status] ?? STATUS_CFG.EXPIRED;
                  const StatusIcon = cfg.icon;
                  const isPending = s.status === "PENDING";
                  return (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground">{fmtGHS(s.amount)}</p>
                        <p className="text-[10px] text-foreground/25 font-mono mt-0.5">{s.id.slice(0, 12)}…</p>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <p className="text-sm text-foreground/70 truncate max-w-[180px]">{s.description ?? "—"}</p>
                        {s.reference && (
                          <button
                            onClick={() => { setRefInput(s.reference!); setReference(s.reference!); }}
                            title="Filter by this reference"
                            className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-muted/40 text-[10px] font-mono text-foreground/45 hover:text-foreground/80 hover:bg-muted/60 transition-colors max-w-[180px] truncate"
                          >
                            <Hash size={9} className="text-foreground/30 flex-shrink-0" />
                            <span className="truncate">{s.reference}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-foreground/40">{fmtDate(s.createdAt)}</span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        {isPending && s.expiresAt ? (
                          <span className="text-xs text-amber-400">
                            {formatDistanceToNow(parseISO(s.expiresAt), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-xs text-foreground/25">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
                          <StatusIcon size={10} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyLink(s.checkoutUrl, s.id)}
                            title="Copy link"
                            className="p-1.5 rounded-lg text-foreground/25 hover:text-foreground/70 hover:bg-muted/40 transition-colors"
                          >
                            {copiedId === s.id ? <Check size={13} className="text-[#B7EE7A]" /> : <Copy size={13} />}
                          </button>
                          {isPending && (
                            <button
                              onClick={() => handleExpire(s.id)}
                              disabled={expiring === s.id}
                              title="Expire link"
                              className="p-1.5 rounded-lg text-foreground/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              {expiring === s.id ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                            </button>
                          )}
                        </div>
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
            <button onClick={() => load(page - 1, statusFilter, reference)} disabled={page === 0 || loading} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Previous</button>
            <span className="text-sm text-foreground/35">{page + 1} / {data.totalPages}</span>
            <button onClick={() => load(page + 1, statusFilter, reference)} disabled={page >= data.totalPages - 1 || loading} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Next</button>
          </div>
        )}
      </div>
    </>
  );
}
