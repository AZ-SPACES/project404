"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getBalance, getPayouts, requestPayout,
  getAutoPayoutSettings, updateAutoPayoutSettings,
  MerchantPayout, BalanceInfo, AutoPayoutSettings,
} from "@/lib/merchant-api";
import {
  Loader2, ArrowDownToLine, CheckCircle2, Clock, XCircle,
  AlertCircle, DollarSign, X, RefreshCw, Save,
} from "lucide-react";
import { format, parseISO } from "date-fns";

function fmtGHS(n: number) {
  return `GH₵ ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy"); }
  catch { return iso; }
}

const STATUS_CFG: Record<string, { icon: React.ElementType; bgCls: string; label: string }> = {
  COMPLETED: { icon: CheckCircle2, bgCls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Completed" },
  PENDING:   { icon: Clock,        bgCls: "text-amber-400 bg-amber-500/10 border-amber-500/20",       label: "Pending" },
  FAILED:    { icon: XCircle,      bgCls: "text-red-400 bg-red-500/10 border-red-500/20",              label: "Failed" },
};

// ─── Payout request modal ───────────────────────────────────────────────────

function PayoutModal({
  maxAmount,
  onClose,
  onSuccess,
}: {
  maxAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [passcode, setPasscode] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > maxAmount) { setError(`Amount exceeds available balance of ${fmtGHS(maxAmount)}`); return; }
    if (!passcode) { setError("Passcode is required"); return; }
    setError(null);
    setSubmitting(true);
    try {
      await requestPayout({ amount: amt, passcode, note: note || undefined });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-[#161616] border border-white/8 rounded-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors">
          <X size={16} />
        </button>
        <h3 className="text-base font-semibold text-white mb-5">Request payout</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Amount (GHS)</label>
            <input
              type="number" step="0.01" min="0.01" max={maxAmount} required
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={`Max ${fmtGHS(maxAmount)}`}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Passcode *</label>
            <input
              type="password" required
              value={passcode} onChange={(e) => setPasscode(e.target.value)}
              placeholder="Your AZA passcode"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Note <span className="text-white/25 font-normal">optional</span></label>
            <input
              type="text"
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Weekly payout"
              className={inputCls}
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Auto-payout settings panel ─────────────────────────────────────────────

function AutoPayoutPanel() {
  const [settings, setSettings] = useState<AutoPayoutSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minBalance, setMinBalance] = useState("");
  const [day, setDay] = useState("");

  useEffect(() => {
    getAutoPayoutSettings()
      .then((s) => {
        setSettings(s);
        setMinBalance(s.autoPayoutMinBalance != null ? String(s.autoPayoutMinBalance) : "");
        setDay(s.autoPayoutDay != null ? String(s.autoPayoutDay) : "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof AutoPayoutSettings>(key: K, val: AutoPayoutSettings[K]) {
    setSettings((s) => s ? { ...s, [key]: val } : s);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAutoPayoutSettings({
        autoPayoutEnabled: settings.autoPayoutEnabled,
        autoPayoutSchedule: settings.autoPayoutSchedule ?? undefined,
        autoPayoutMinBalance: minBalance ? parseFloat(minBalance) : undefined,
        autoPayoutDay: day ? parseInt(day) : undefined,
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#B7EE7A]" size={18} /></div>;
  if (!settings) return null;

  const scheduleLabel = {
    DAILY: "Every day at 6 AM",
    WEEKLY: "Every week on the selected day",
    MONTHLY: "Every month on the selected date",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Automatic payouts</p>
          <p className="text-xs text-white/35 mt-0.5">Automatically transfer your balance on a schedule</p>
        </div>
        <button
          type="button"
          onClick={() => set("autoPayoutEnabled", !settings.autoPayoutEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.autoPayoutEnabled ? "bg-[#174717]" : "bg-white/15"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.autoPayoutEnabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {settings.autoPayoutEnabled && (
        <>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Schedule</label>
            <div className="grid grid-cols-3 gap-2">
              {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { set("autoPayoutSchedule", s); setDay(""); }}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${settings.autoPayoutSchedule === s ? "bg-[#B7EE7A]/10 border-[#B7EE7A]/40 text-[#B7EE7A]" : "border-white/8 text-white/50 hover:border-white/15 hover:text-white/70"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {settings.autoPayoutSchedule && (
              <p className="text-xs text-white/30 mt-1.5">{scheduleLabel[settings.autoPayoutSchedule]}</p>
            )}
          </div>

          {settings.autoPayoutSchedule === "WEEKLY" && (
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Day of week</label>
              <div className="grid grid-cols-7 gap-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                  <button
                    key={d}
                    onClick={() => setDay(String(i + 1))}
                    className={`py-2 rounded-lg text-xs font-medium border transition-colors ${day === String(i + 1) ? "bg-[#B7EE7A]/10 border-[#B7EE7A]/40 text-[#B7EE7A]" : "border-white/8 text-white/40 hover:border-white/15"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {settings.autoPayoutSchedule === "MONTHLY" && (
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Day of month (1–28)</label>
              <input
                type="number"
                min="1"
                max="28"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={inputCls}
                placeholder="1"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Minimum balance (GHS)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
              className={inputCls}
              placeholder="10.00 — only payout if balance is above this"
            />
          </div>
        </>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-white font-semibold text-sm transition-colors"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-xs text-[#B7EE7A] flex items-center gap-1"><CheckCircle2 size={13} />Saved</span>}
      </div>
    </div>
  );
}

export default function PayoutsPage() {
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [bal, page] = await Promise.all([
        getBalance().catch(() => null),
        getPayouts(0, 50).catch(() => ({ content: [] as MerchantPayout[], totalElements: 0, totalPages: 0, number: 0, size: 50 })),
      ]);
      setBalance(bal);
      setPayouts(page.content);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-[#B7EE7A]" size={24} />
      </div>
    );
  }

  return (
    <>
      {showModal && balance && (
        <PayoutModal
          maxAmount={balance.balance}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Payouts</h1>
          <p className="text-white/40 text-sm mt-0.5">Transfer your merchant earnings to your AZA wallet</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={15} />{error}
          </div>
        )}

        {/* Balance card */}
        <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Available balance</p>
            <DollarSign size={14} className="text-white/20" />
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {balance ? fmtGHS(balance.balance) : "—"}
          </p>
          <p className="text-xs text-white/30">{balance?.currency ?? "GHS"} · Merchant wallet</p>
          {balance && balance.totalVolume > 0 && (
            <p className="text-xs text-white/25 mt-1">
              Total processed: {fmtGHS(balance.totalVolume)}
            </p>
          )}
          <button
            onClick={() => setShowModal(true)}
            disabled={!balance || balance.balance <= 0}
            className="mt-4 w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <ArrowDownToLine size={15} />
            Request payout
          </button>
        </div>

        {/* Auto-payout schedule */}
        <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw size={15} className="text-white/40" />
            <p className="text-sm font-semibold text-white">Auto-payout schedule</p>
          </div>
          <AutoPayoutPanel />
        </div>

        {/* Payout history */}
        <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-sm font-semibold text-white">Payout history</p>
          </div>
          {payouts.length === 0 ? (
            <div className="py-16 text-center">
              <ArrowDownToLine size={28} className="mx-auto mb-3 text-white/15" />
              <p className="text-sm text-white/30">No payouts yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/4">
                  {["Date", "Amount", "Completed", "Status"].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/25 uppercase tracking-wider text-left ${
                      i === 2 ? "hidden lg:table-cell" : ""
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {payouts.map((p) => {
                  const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.PENDING;
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={p.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-white/60">{fmtDate(p.requestedAt)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-white">{fmtGHS(p.amount)}</span>
                        {p.note && <p className="text-[10px] text-white/30 mt-0.5">{p.note}</p>}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="text-xs text-white/40">{fmtDate(p.completedAt)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bgCls}`}>
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
      </div>
    </>
  );
}

const inputCls = "w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all";
