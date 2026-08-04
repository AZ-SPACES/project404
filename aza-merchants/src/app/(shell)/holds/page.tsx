"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getHeldSessions,
  releaseHold,
  refundHold,
  CheckoutSession,
  Hold,
} from "@/lib/merchant-api";
import {
  Loader2,
  Lock,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Clock,
} from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);
}

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * An unreleased hold reverses to the payer. That deadline is the single most important
 * thing on this page, so it is rendered as time remaining rather than a date the reader
 * has to subtract from today.
 */
function timeLeft(expiresAt: string): { label: string; urgent: boolean; expired: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: "expired", urgent: true, expired: true };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days === 0) return { label: `${hours}h left`, urgent: true, expired: false };
  return { label: `${days}d left`, urgent: days <= 3, expired: false };
}

const HOLD_STATUS_STYLE: Record<string, string> = {
  HELD: "bg-amber-400/10 text-amber-400",
  RELEASED: "bg-[#B7EE7A]/10 text-[#B7EE7A]",
  REFUNDED: "bg-foreground/10 text-foreground/50",
  PARTIALLY_SETTLED: "bg-sky-400/10 text-sky-400",
  FROZEN: "bg-red-500/10 text-red-400",
};

function ActionModal({
  session,
  hold,
  action,
  onClose,
  onDone,
}: {
  session: CheckoutSession;
  hold: Hold;
  action: "release" | "refund";
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const releasing = action === "release";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      // One key per attempt at this action on this hold: a retry after a dropped
      // response settles once, not twice.
      const key = `dash-${action}-${hold.id}`;
      if (releasing) await releaseHold(session.id, key, reason || undefined);
      else await refundHold(session.id, key, reason || undefined);
      onDone();
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-foreground/30 hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <X size={16} />
        </button>

        <h3 className="text-base font-semibold text-foreground mb-1">
          {releasing ? "Release this payment" : "Refund this payment"}
        </h3>
        <p className="text-xs text-foreground/40 mb-4">
          {releasing
            ? "Pays the recipients below and settles your share. This cannot be undone."
            : "Returns the full amount to the payer, including the Aza fee. This cannot be undone."}
        </p>

        <div className="rounded-xl bg-muted/20 border border-border p-3 mb-4 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-foreground/40">Held</span>
            <span className="text-foreground font-medium">{fmt(hold.remainingAmount)}</span>
          </div>
          {releasing &&
            hold.recipients.map((r) => (
              <div key={r.recipient} className="flex justify-between text-xs">
                <span className="text-foreground/40 font-mono">{r.recipient}</span>
                <span className="text-foreground/70">{fmt(r.amount - r.releasedAmount)}</span>
              </div>
            ))}
          {releasing && (
            <div className="flex justify-between text-xs pt-1.5 border-t border-border">
              <span className="text-foreground/40">You keep (after fee)</span>
              <span className="text-[#B7EE7A]">
                {fmt(
                  Math.max(
                    0,
                    hold.remainingAmount -
                      hold.recipients.reduce((s, r) => s + (r.amount - r.releasedAmount), 0) -
                      hold.azaFee
                  )
                )}
              </span>
            </div>
          )}
        </div>

        <label className="block text-xs font-medium text-foreground/50 mb-1.5">
          Reason <span className="text-foreground/25">(your own records — Aza never reads it)</span>
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={releasing ? "e.g. Job completed and approved" : "e.g. Worker no-show"}
          className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm mb-4"
        />

        {error && (
          <p className="text-xs text-red-400 mb-3 flex items-start gap-1.5">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-border text-foreground/60 hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
              releasing
                ? "bg-[#B7EE7A] text-black hover:bg-[#a5dd68]"
                : "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
            }`}
          >
            {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : releasing ? "Release" : "Refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HoldsPage() {
  const [sessions, setSessions] = useState<CheckoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [modal, setModal] = useState<{ s: CheckoutSession; h: Hold; a: "release" | "refund" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getHeldSessions(page, 20);
      // Already filtered to release=MANUAL server-side; only drop rows whose hold has not
      // been created yet (the payer has not paid), which cannot be expressed in the query.
      setSessions(res.content.filter((s) => s.hold));
      setTotalPages(Math.max(1, res.totalPages));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Lock size={18} className="text-[#B7EE7A]" />
          Held payments
        </h1>
        <p className="text-xs text-foreground/40 mt-1">
          Money your customers have paid that has not been settled yet. Release it to pay the
          recipients, or refund it to return it to the payer.
        </p>
      </div>

      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 mb-6 flex items-start gap-2">
        <Clock size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-foreground/60">
          A hold you never release is <strong className="text-foreground/80">returned to the payer</strong> when
          its window runs out. Aza cannot decide whether the work was done — that call, and the
          evidence for it, are yours.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={20} className="animate-spin text-foreground/30" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <Lock size={28} className="mx-auto text-foreground/15 mb-3" />
          <p className="text-sm text-foreground/40">No held payments</p>
          <p className="text-xs text-foreground/25 mt-1">
            Create a session with <code className="font-mono">release: &quot;MANUAL&quot;</code> to hold funds.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const h = s.hold!;
            const t = timeLeft(h.expiresAt);
            const settleable = h.status === "HELD";
            return (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-foreground">{fmt(h.amount)}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${HOLD_STATUS_STYLE[h.status]}`}>
                        {h.status.replace("_", " ")}
                      </span>
                      {settleable && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            t.urgent ? "bg-red-500/10 text-red-400" : "bg-foreground/5 text-foreground/40"
                          }`}
                        >
                          {t.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground/40 mt-1 truncate">
                      {s.description || "—"}
                      {s.reference ? ` · ${s.reference}` : ""}
                    </p>
                    <p className="text-[11px] text-foreground/25 font-mono mt-0.5">
                      held {fmtDateTime(h.heldAt)} · expires {fmtDateTime(h.expiresAt)}
                    </p>
                  </div>

                  {settleable && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setModal({ s, h, a: "refund" })}
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-border text-foreground/60 hover:text-foreground transition-colors"
                      >
                        Refund
                      </button>
                      <button
                        onClick={() => setModal({ s, h, a: "release" })}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#B7EE7A] text-black hover:bg-[#a5dd68] transition-colors"
                      >
                        Release
                      </button>
                    </div>
                  )}
                </div>

                {h.recipients.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                    {h.recipients.map((r) => (
                      <div key={r.recipient} className="flex items-center justify-between text-xs">
                        <span className="text-foreground/50 font-mono truncate">{r.recipient}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {r.failureReason && (
                            <span className="text-red-400 text-[10px]">{r.failureReason}</span>
                          )}
                          <span className="text-foreground/70">{fmt(r.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {h.status === "FROZEN" && (
                  <p className="mt-3 pt-3 border-t border-border text-xs text-red-400 flex items-start gap-1.5">
                    <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                    Aza has paused this payment for a compliance review. Release and refund are
                    unavailable until it is resolved, and the expiry clock is stopped.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg border border-border text-foreground/40 disabled:opacity-30 hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-foreground/40">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-lg border border-border text-foreground/40 disabled:opacity-30 hover:text-foreground transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {modal && (
        <ActionModal
          session={modal.s}
          hold={modal.h}
          action={modal.a}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
