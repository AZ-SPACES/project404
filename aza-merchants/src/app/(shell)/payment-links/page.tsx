"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getSessions,
  createSession,
  expireSession,
  CheckoutSession,
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
  EXPIRED:   { icon: Ban,          cls: "text-white/30 bg-white/5 border-white/10",                label: "Expired" },
};

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
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
      <div className="w-full max-w-sm bg-[#161616] border border-white/8 rounded-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors">
          <X size={16} />
        </button>
        <h3 className="text-base font-semibold text-white mb-5">New payment link</h3>

        {!result ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Amount (GHS) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-sm">GH₵</span>
                <input
                  type="number" step="0.01" min="0.01" required
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Description <span className="text-white/25 font-normal">optional</span></label>
              <input
                type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this payment for?"
                className="w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
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
            <div className="bg-black/30 border border-white/8 rounded-xl p-3 break-all">
              <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider font-medium">URL</p>
              <p className="text-xs text-white/70 font-mono">{result.checkoutUrl}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={copy} className="flex-1 py-2.5 rounded-xl bg-white/6 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 font-medium text-sm transition-colors flex items-center justify-center gap-2">
                {copied ? <Check size={13} className="text-[#B7EE7A]" /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <a
                href={result.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-white/6 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink size={13} />
                Open
              </a>
            </div>
            <button onClick={onClose} className="w-full py-2 text-sm text-white/30 hover:text-white/60 transition-colors">Done</button>
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

  const load = useCallback(async (p: number, s: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSessions({ page: p, size: 20, status: s !== "ALL" ? s : undefined });
      setData(res);
      setPage(p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0, statusFilter); }, [load, statusFilter]);

  async function handleExpire(id: string) {
    setExpiring(id);
    try {
      await expireSession(id);
      load(page, statusFilter);
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
          onCreated={() => load(0, statusFilter)}
        />
      )}

      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Payment Links</h1>
            <p className="text-white/40 text-sm mt-0.5">Checkout sessions you've generated</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-white font-semibold text-sm transition-colors"
          >
            <Plus size={15} />
            New link
          </button>
        </div>

        <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit flex-wrap">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s ? "bg-[#174717] text-white" : "text-white/45 hover:text-white"
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
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
              <Link2 size={28} className="mx-auto mb-3 text-white/15" />
              <p className="text-sm text-white/30">No payment links yet</p>
              <button onClick={() => setShowCreate(true)} className="mt-3 text-xs text-[#B7EE7A] hover:underline">Create your first link</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Amount", "Description", "Created", "Expires", "Status", ""].map((h, i) => (
                    <th key={i} className={`px-5 py-3 text-[10px] font-semibold text-white/25 uppercase tracking-wider text-left ${
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
                    <tr key={s.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-white">{fmtGHS(s.amount)}</p>
                        <p className="text-[10px] text-white/25 font-mono mt-0.5">{s.id.slice(0, 12)}…</p>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <p className="text-sm text-white/70 truncate max-w-[180px]">{s.description ?? "—"}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-white/40">{fmtDate(s.createdAt)}</span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        {isPending && s.expiresAt ? (
                          <span className="text-xs text-amber-400">
                            {formatDistanceToNow(parseISO(s.expiresAt), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-xs text-white/25">—</span>
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
                            className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/8 transition-colors"
                          >
                            {copiedId === s.id ? <Check size={13} className="text-[#B7EE7A]" /> : <Copy size={13} />}
                          </button>
                          {isPending && (
                            <button
                              onClick={() => handleExpire(s.id)}
                              disabled={expiring === s.id}
                              title="Expire link"
                              className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
            <button onClick={() => load(page - 1, statusFilter)} disabled={page === 0 || loading} className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5">Previous</button>
            <span className="text-sm text-white/35">{page + 1} / {data.totalPages}</span>
            <button onClick={() => load(page + 1, statusFilter)} disabled={page >= data.totalPages - 1 || loading} className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5">Next</button>
          </div>
        )}
      </div>
    </>
  );
}
