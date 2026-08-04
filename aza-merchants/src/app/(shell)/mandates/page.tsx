"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getMandates,
  getMandateCharges,
  chargeMandate,
  Mandate,
  MandateChargeRecord,
  Page,
} from "@/lib/merchant-api";
import {
  Loader2,
  Repeat,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  XCircle,
  X,
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

function cadenceLabel(periodType: Mandate["periodType"]) {
  switch (periodType) {
    case "DAILY": return "day";
    case "WEEKLY": return "week";
    case "MONTHLY": return "month";
    default: return null;
  }
}

const STATUS_STYLE: Record<string, string> = {
  PENDING_APPROVAL: "bg-foreground/10 text-foreground/50",
  ACTIVE: "bg-[#B7EE7A]/10 text-[#B7EE7A]",
  PAUSED: "bg-amber-400/10 text-amber-400",
  CANCELLED: "bg-foreground/10 text-foreground/40",
  EXPIRED: "bg-foreground/10 text-foreground/40",
};

function ChargeModal({
  mandate,
  onClose,
  onDone,
}: {
  mandate: Mandate;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remainingThisPeriod = mandate.periodLimit != null
    ? Math.max(0, mandate.periodLimit - mandate.periodSpent)
    : null;

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) { setError("Enter an amount greater than zero."); return; }
    if (value > mandate.perChargeLimit) { setError(`Exceeds the per-charge limit of ${fmt(mandate.perChargeLimit)}.`); return; }
    setBusy(true);
    setError(null);
    try {
      // One key per attempt: a retry after a dropped response settles once, not twice.
      const key = `dash-charge-${mandate.id}-${Date.now()}`;
      await chargeMandate(mandate.id, value, reference || mandate.reference, key);
      onDone();
    } catch (e: any) {
      setError(e?.message || "Charge failed");
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

        <h3 className="text-base font-semibold text-foreground mb-1">Charge this mandate</h3>
        <p className="text-xs text-foreground/40 mb-4">
          Debits the payer&apos;s wallet immediately — no prompt to them, they already approved this mandate.
        </p>

        <div className="rounded-xl bg-muted/20 border border-border p-3 mb-4 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-foreground/40">Per charge, up to</span>
            <span className="text-foreground font-medium">{fmt(mandate.perChargeLimit)}</span>
          </div>
          {remainingThisPeriod != null && (
            <div className="flex justify-between">
              <span className="text-foreground/40">Remaining this {cadenceLabel(mandate.periodType)}</span>
              <span className="text-foreground font-medium">{fmt(remainingThisPeriod)}</span>
            </div>
          )}
        </div>

        <label className="block text-xs font-medium text-foreground/50 mb-1.5">Amount (GHS)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm mb-3"
        />

        <label className="block text-xs font-medium text-foreground/50 mb-1.5">
          Reference <span className="text-foreground/25">optional</span>
        </label>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={mandate.reference}
          className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm mb-4"
        />

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-foreground font-semibold text-sm transition-colors"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Charge {amount ? fmt(Number(amount) || 0) : ""}
        </button>
      </div>
    </div>
  );
}

function ChargeHistory({ mandateId }: { mandateId: string }) {
  const [charges, setCharges] = useState<Page<MandateChargeRecord> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMandateCharges(mandateId, 0, 10)
      .then(setCharges)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mandateId]);

  if (loading) return <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-[#B7EE7A]" /></div>;
  if (!charges || charges.content.length === 0) return <p className="text-xs text-foreground/30 py-3 text-center">No charges yet</p>;

  return (
    <div className="divide-y divide-white/[0.04]">
      {charges.content.map((c) => (
        <div key={c.id} className="flex items-center gap-3 py-2.5">
          {c.status === "COMPLETED" ? (
            <CheckCircle2 size={14} className="text-[#B7EE7A] flex-shrink-0" />
          ) : (
            <XCircle size={14} className="text-red-400 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground">{fmt(c.amount)}</p>
            {c.failureReason && <p className="text-[11px] text-red-400/70 truncate">{c.failureReason}</p>}
          </div>
          <span className="text-[11px] text-foreground/30 flex-shrink-0">{fmtDateTime(c.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

export default function MandatesPage() {
  const [page, setPage] = useState<Page<Mandate> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chargingMandate, setChargingMandate] = useState<Mandate | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try { setPage(await getMandates(p, 20)); }
    catch (e: any) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(currentPage); }, [load, currentPage]);

  return (
    <div className="space-y-6">
      {chargingMandate && (
        <ChargeModal
          mandate={chargingMandate}
          onClose={() => setChargingMandate(null)}
          onDone={() => { setChargingMandate(null); load(currentPage); }}
        />
      )}

      <div>
        <h1 className="text-xl font-bold text-foreground">Payment Mandates</h1>
        <p className="text-foreground/40 text-sm mt-0.5">
          Standing authorizations customers have approved for direct debit — charge them on demand
          from your own systems via the API, or manually here for support.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#B7EE7A]" size={22} /></div>
        ) : error ? (
          <div className="flex items-center justify-center h-48"><p className="text-red-400 text-sm">{error}</p></div>
        ) : !page || page.content.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Repeat size={32} className="text-foreground/15" />
            <p className="text-foreground/40 text-sm">No payment mandates yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {page.content.map((m) => {
              const cadence = cadenceLabel(m.periodType);
              const expanded = expandedId === m.id;
              return (
                <div key={m.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(expanded ? null : m.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedId(expanded ? null : m.id); }}
                    className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-muted/10 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{m.reference}</p>
                      <p className="text-xs text-foreground/40 mt-0.5">
                        {fmt(m.perChargeLimit)} per charge
                        {m.periodLimit != null && cadence ? ` · ${fmt(m.periodLimit)} per ${cadence}` : ""}
                        {" · via "}{m.sourceType === "MINI_APP" ? "Mini App" : "OAuth"}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLE[m.status]}`}>
                      {m.status.replace("_", " ")}
                    </span>
                    {m.status === "ACTIVE" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setChargingMandate(m); }}
                        className="px-3 py-1.5 rounded-lg bg-[#174717] hover:bg-[#1e5e1e] text-foreground text-xs font-semibold transition-colors"
                      >
                        Charge
                      </button>
                    )}
                    {expanded ? <ChevronUp size={14} className="text-foreground/30" /> : <ChevronDown size={14} className="text-foreground/30" />}
                  </div>
                  {expanded && (
                    <div className="px-5 pb-4 bg-muted/5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/30 mb-1">Charge history</p>
                      <ChargeHistory mandateId={m.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {page && page.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-foreground/50">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0 || loading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>Page {currentPage + 1} of {page.totalPages}</span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(page.totalPages - 1, p + 1))}
            disabled={currentPage >= page.totalPages - 1 || loading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
