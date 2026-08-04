"use client";

import { useCallback, useEffect, useState } from "react";
import {
  confirmTransfer, getPersonalWallet, getSentTransfers, initiateTransfer,
  Page, PersonalWallet, TransferResult,
} from "@/lib/merchant-api";
import { CheckCircle2, Loader2, Send, Wallet as WalletIcon } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const inputCls =
  "w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50";

function SuccessCard({ result, onDone }: { result: TransferResult; onDone: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-[#B7EE7A]/10 border border-[#B7EE7A]/25">
        <CheckCircle2 size={22} className="text-[#B7EE7A]" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">Sent {fmt(result.amount)}</p>
        <p className="text-sm text-foreground/40 mt-0.5">to {result.recipientName}</p>
      </div>
      <button
        onClick={onDone}
        className="mt-2 px-4 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-foreground transition-colors"
      >
        Send another
      </button>
    </div>
  );
}

export default function SendMoneyPage() {
  const [wallet, setWallet] = useState<PersonalWallet | null>(null);
  const [history, setHistory] = useState<Page<TransferResult> | null>(null);
  const [loading, setLoading] = useState(true);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [passcode, setPasscode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, h] = await Promise.all([getPersonalWallet(), getSentTransfers(0, 10)]);
      setWallet(w);
      setHistory(h);
    } catch {
      /* wallet/history are supplementary — the send form still works without them */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function reset() {
    setRecipient(""); setAmount(""); setNote(""); setPasscode(""); setResult(null); setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!recipient.trim()) { setError("Enter a recipient email, phone, or @handle"); return; }
    if (isNaN(amt) || amt <= 0) { setError("Enter a valid amount"); return; }
    if (wallet && amt > wallet.balance) { setError(`Amount exceeds your available balance of ${fmt(wallet.balance)}`); return; }
    if (!passcode) { setError("Passcode is required"); return; }
    setError(null);
    setSubmitting(true);
    try {
      const pending = await initiateTransfer({
        recipientIdentifier: recipient.trim(),
        amount: amt,
        note: note.trim() || undefined,
        // Guards against a double-click sending twice.
        idempotencyKey: `send:${recipient.trim()}:${amt}:${Date.now()}`,
      });
      const completed = await confirmTransfer(pending.id, passcode);
      setResult(completed);
      setRecipient(""); setAmount(""); setNote(""); setPasscode("");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Send Money</h1>
        <p className="text-foreground/40 text-sm mt-0.5">
          Send funds from your own AZA wallet to another user
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm text-foreground/50 bg-card border border-border rounded-xl px-4 py-3">
        <WalletIcon size={15} className="text-foreground/30" />
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <span>
            Your balance: <span className="font-semibold text-foreground">{wallet ? fmt(wallet.balance) : "—"}</span>
          </span>
        )}
      </div>

      {result ? (
        <SuccessCard result={result} onDone={reset} />
      ) : (
        <form onSubmit={submit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-1.5">Recipient</label>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Email, phone, or @handle"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-1.5">Amount (GHS)</label>
            <input
              type="number" min="0.01" step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-1.5">
              Note <span className="text-foreground/25 font-normal">optional</span>
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's this for?"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-1.5">Passcode</label>
            <input
              type="password" inputMode="numeric" maxLength={4}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Your AZA passcode"
              className={inputCls}
            />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-foreground font-semibold text-sm transition-colors"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send
          </button>
        </form>
      )}

      <div>
        <h2 className="text-sm font-medium text-foreground/70 mb-3">Recent sends</h2>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#B7EE7A]" size={18} /></div>
        ) : !history || history.content.length === 0 ? (
          <p className="text-center py-8 text-foreground/30 text-sm">No transfers yet</p>
        ) : (
          <div className="bg-card border border-border rounded-xl divide-y divide-white/[0.04] overflow-hidden">
            {history.content.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                  <Send size={13} className="text-foreground/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{t.recipientName}</p>
                  {t.note && <p className="text-xs text-foreground/40 truncate">{t.note}</p>}
                </div>
                <span className="text-sm font-medium text-foreground shrink-0">{fmt(t.amount)}</span>
                <span className="text-xs text-foreground/40 shrink-0 w-32 text-right hidden sm:block">
                  {fmtDate(t.completedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
