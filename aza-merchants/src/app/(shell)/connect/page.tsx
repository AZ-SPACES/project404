"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getConnectBalance, getConnectTransfers, createConnectTransfer, resolveConnectRecipient,
  ConnectBalance, ConnectTransfer, ConnectRecipient, Page,
} from "@/lib/merchant-api";
import {
  Loader2, Store, Plus, X, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Wallet as WalletIcon, BadgeCheck, AlertCircle,
} from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-[#B7EE7A]/10 text-[#B7EE7A]",
  SIMULATED: "bg-blue-400/10 text-blue-400",
  PENDING: "bg-amber-400/10 text-amber-400",
  FAILED: "bg-red-400/10 text-red-400",
};

function PayModal({
  balance, onClose, onCreate,
}: {
  balance: number;
  onClose: () => void;
  onCreate: (t: ConnectTransfer) => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ConnectRecipient | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verify the seller as the merchant types (debounced), so they see who they'll pay.
  useEffect(() => {
    const id = recipient.trim();
    setResolved(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (id.length < 3) { setResolving(false); return; }
    setResolving(true);
    debounce.current = setTimeout(async () => {
      try { setResolved(await resolveConnectRecipient(id)); }
      catch { setResolved(null); }
      finally { setResolving(false); }
    }, 450);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [recipient]);

  const amountNum = parseFloat(amount) || 0;
  const overBalance = amountNum > balance;
  const canSubmit =
    recipient.trim().length > 0 &&
    amountNum > 0 &&
    !overBalance &&
    resolved?.canReceive === true &&
    !loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const t = await createConnectTransfer({
        recipient: recipient.trim(),
        amount: amountNum,
        note: note.trim() || undefined,
        reference: reference.trim() || undefined,
        // Guards against a double-click sending twice; per-account unique.
        idempotencyKey: `dash:${recipient.trim()}:${amountNum}:${Date.now()}`,
      });
      onCreate(t);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Pay a seller</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-foreground/40 mb-1.5">Seller (email or username)</label>
            <input
              autoFocus
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50"
              placeholder="ama@example.com"
            />
            {/* Live verification feedback */}
            {resolving ? (
              <p className="flex items-center gap-1.5 text-xs text-foreground/40 mt-1.5"><Loader2 size={12} className="animate-spin" /> Checking…</p>
            ) : resolved?.canReceive ? (
              <p className="flex items-center gap-1.5 text-xs text-[#B7EE7A] mt-1.5"><BadgeCheck size={12} /> {resolved.displayName} can receive</p>
            ) : resolved && !resolved.canReceive ? (
              <p className="flex items-center gap-1.5 text-xs text-amber-400 mt-1.5"><AlertCircle size={12} /> {resolved.reason ?? "Cannot receive"}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-xs text-foreground/40 mb-1.5">Amount (GHS)</label>
            <input
              type="number" min="0.01" step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50"
              placeholder="0.00"
            />
            <p className={`text-xs mt-1.5 ${overBalance ? "text-red-400" : "text-foreground/30"}`}>
              {overBalance ? "Exceeds your balance" : `Available: ${fmt(balance)}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground/40 mb-1.5">Note <span className="text-foreground/20">(optional)</span></label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50" placeholder="Weekly payout" />
            </div>
            <div>
              <label className="block text-xs text-foreground/40 mb-1.5">Reference <span className="text-foreground/20">(optional)</span></label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50" placeholder="payout-07-01" />
            </div>
          </div>

          {error && <p className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground/60 hover:text-foreground hover:bg-muted/30 transition-colors">Cancel</button>
            <button type="submit" disabled={!canSubmit} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-foreground transition-colors disabled:opacity-40">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Store size={14} />}
              Send {amountNum > 0 ? fmt(amountNum) : ""}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  const [balance, setBalance] = useState<ConnectBalance | null>(null);
  const [page, setPage] = useState<Page<ConnectTransfer> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const [bal, transfers] = await Promise.all([getConnectBalance(), getConnectTransfers(p, 20)]);
      setBalance(bal);
      setPage(transfers);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(currentPage); }, [load, currentPage]);

  return (
    <div className="space-y-6">
      {showPay && balance && (
        <PayModal
          balance={balance.available}
          onClose={() => setShowPay(false)}
          onCreate={(t) => {
            setPage((p) => p ? { ...p, content: [t, ...p.content], totalElements: p.totalElements + 1 } : p);
            setBalance((b) => b ? { ...b, available: b.available - t.amount } : b);
            setShowPay(false);
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Seller Payouts</h1>
          <p className="text-foreground/40 text-sm mt-0.5">Pay individual sellers straight into their Aza wallet</p>
        </div>
        <button
          onClick={() => setShowPay(true)}
          disabled={!balance}
          className="flex items-center gap-2 px-4 py-2 bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-foreground rounded-xl transition-colors disabled:opacity-50"
        >
          <Plus size={15} />
          Pay a seller
        </button>
      </div>

      {/* Balance card */}
      <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-[#B7EE7A]/10 border border-[#B7EE7A]/20 flex items-center justify-center flex-shrink-0">
          <WalletIcon size={20} className="text-[#B7EE7A]" />
        </div>
        <div>
          <p className="text-xs text-foreground/40">Available to pay out</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{balance ? fmt(balance.available) : "—"}</p>
        </div>
        <p className="ml-auto text-xs text-foreground/30 max-w-xs hidden sm:block">
          Splits set on checkout sessions credit sellers automatically. Use this to pay sellers on your own schedule.
        </p>
      </div>

      {/* History */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#B7EE7A]" size={22} /></div>
        ) : error ? (
          <div className="flex items-center justify-center h-48"><p className="text-red-400 text-sm">{error}</p></div>
        ) : !page || page.content.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Store size={32} className="text-foreground/15" />
            <p className="text-foreground/40 text-sm">No seller payouts yet</p>
            <button onClick={() => setShowPay(true)} className="text-sm text-[#B7EE7A] hover:underline">Pay your first seller</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Seller</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Amount</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">Reference</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {page.content.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          {t.status === "COMPLETED" ? <CheckCircle2 size={14} className="text-[#B7EE7A] flex-shrink-0" />
                            : t.status === "FAILED" ? <XCircle size={14} className="text-red-400 flex-shrink-0" />
                            : <div className="w-3.5" />}
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate">{t.recipient}</p>
                            {t.note && <p className="text-xs text-foreground/40 mt-0.5 truncate max-w-xs">{t.note}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-foreground">{fmt(t.amount)}</td>
                      <td className="px-5 py-3.5 text-left text-xs text-foreground/40 hidden md:table-cell font-mono">{t.reference ?? "—"}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[t.status] ?? "bg-muted/50 text-foreground/40"}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-foreground/40 hidden md:table-cell">{fmtDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {page.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-foreground/30">{page.totalElements} payouts · page {page.number + 1} of {page.totalPages}</p>
                <div className="flex gap-1">
                  <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                  <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= page.totalPages - 1} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
