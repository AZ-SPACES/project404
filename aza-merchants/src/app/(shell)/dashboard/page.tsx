"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getMe,
  getReportSummary,
  getSessions,
  createSession,
  Merchant,
  ReportSummary,
  CheckoutSession,
} from "@/lib/merchant-api";
import {
  TrendingUp,
  ArrowUpRight,
  Link2,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  DollarSign,
  Activity,
  CreditCard,
  Percent,
  Copy,
  Check,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";

function fmtGHS(n: number) {
  return `GH₵ ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `GH₵ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `GH₵ ${(n / 1_000).toFixed(1)}K`;
  return fmtGHS(n);
}

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "MMM d, h:mm a"); }
  catch { return iso; }
}

const TX_STATUS: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  COMPLETED: { icon: CheckCircle2, cls: "text-emerald-400", label: "Paid" },
  PENDING:   { icon: Clock,        cls: "text-amber-400",   label: "Pending" },
  CANCELLED: { icon: XCircle,      cls: "text-red-400",     label: "Cancelled" },
  EXPIRED:   { icon: Ban,          cls: "text-white/30",    label: "Expired" },
};

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: { revenue: number }[] }) {
  if (data.length < 2) return null;
  const W = 300;
  const H = 60;
  const values = data.map((d) => d.revenue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H * 0.85 - 4;
    return `${x},${y}`;
  });
  const path = `M${points.join(" L")}`;
  const area = `${path} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B7EE7A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#B7EE7A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={path} fill="none" stroke="#B7EE7A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Payment Link Modal ───────────────────────────────────────────────────────

function PaymentLinkModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutSession | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid amount");
      const res = await createSession({ amount: amt, description: description || undefined });
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
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
        <h3 className="text-base font-semibold text-white mb-4">Generate payment link</h3>
        {!result ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Amount (GHS)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">GH₵</span>
                <input
                  type="number" step="0.01" min="0.01" required
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Description <span className="text-white/25 font-normal">(optional)</span></label>
              <input
                type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Order #1234"
                className="w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Generating…" : "Generate link"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-[#B7EE7A]/8 border border-[#B7EE7A]/20 rounded-xl">
              <CheckCircle2 size={16} className="text-[#B7EE7A] flex-shrink-0" />
              <p className="text-sm text-[#B7EE7A] font-medium">Payment link created</p>
            </div>
            <div className="bg-black/30 border border-white/8 rounded-xl p-3">
              <p className="text-[10px] text-white/35 mb-1.5 uppercase tracking-wider font-medium">Checkout URL</p>
              <p className="text-xs text-white/70 font-mono break-all">{result.checkoutUrl}</p>
            </div>
            <button onClick={copyLink} className="w-full py-2.5 rounded-xl bg-white/6 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 font-medium text-sm transition-colors flex items-center justify-center gap-2">
              {copied ? <Check size={14} className="text-[#B7EE7A]" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button onClick={onClose} className="w-full py-2 text-sm text-white/35 hover:text-white/60 transition-colors">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [sessions, setSessions] = useState<CheckoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, rep, sessData] = await Promise.all([
        getMe(),
        getReportSummary().catch(() => null),
        getSessions({ page: 0, size: 6 }).catch(() => null),
      ]);
      setMerchant(me);
      setSummary(rep);
      setSessions(sessData?.content ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#B7EE7A]" size={24} />
      </div>
    );
  }

  const metricCards = [
    {
      label: "Today",
      value: summary ? fmtShort(Number(summary.todayRevenue)) : "—",
      sub: `${summary?.todayPayments ?? 0} payments`,
      icon: DollarSign,
      color: "text-[#B7EE7A]",
    },
    {
      label: "Last 7 days",
      value: summary ? fmtShort(Number(summary.sevenDayRevenue)) : "—",
      sub: `${summary?.sevenDayPayments ?? 0} payments`,
      icon: TrendingUp,
      color: "text-blue-400",
    },
    {
      label: "Last 30 days",
      value: summary ? fmtShort(Number(summary.thirtyDayRevenue)) : "—",
      sub: `${summary?.thirtyDayPayments ?? 0} payments`,
      icon: Activity,
      color: "text-purple-400",
    },
    {
      label: "Success rate",
      value: summary ? `${Number(summary.successRate).toFixed(1)}%` : "—",
      sub: `${summary?.allTimePayments ?? 0} total`,
      icon: Percent,
      color: "text-amber-400",
    },
  ];

  return (
    <>
      {showLinkModal && <PaymentLinkModal onClose={() => { setShowLinkModal(false); load(); }} />}

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{merchant?.businessName ?? "Dashboard"}</h1>
            <p className="text-white/40 text-sm mt-0.5">
              @{merchant?.businessHandle} ·{" "}
              <span className={merchant?.status === "ACTIVE" ? "text-[#B7EE7A]" : "text-amber-400"}>
                {merchant?.status === "ACTIVE" ? "Live" : merchant?.status?.replace(/_/g, " ") ?? ""}
              </span>
            </p>
          </div>
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-white font-semibold text-sm transition-colors"
          >
            <Link2 size={15} />
            <span className="hidden sm:block">Generate payment link</span>
            <span className="sm:hidden">Payment link</span>
          </button>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricCards.map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-[#161616] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium">{label}</p>
                <Icon size={13} className="text-white/20" />
              </div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-white/30 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue chart + balance side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <div className="lg:col-span-2 bg-[#161616] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-white">Revenue — last 30 days</p>
                <p className="text-2xl font-bold text-[#B7EE7A] mt-0.5">
                  {summary ? fmtGHS(Number(summary.thirtyDayRevenue)) : "—"}
                </p>
              </div>
              {summary && Number(summary.thirtyDayRevenue) > 0 && (
                <div className="flex items-center gap-1 text-xs text-[#B7EE7A] bg-[#B7EE7A]/10 px-2.5 py-1 rounded-full">
                  <ArrowUpRight size={12} />
                  Live
                </div>
              )}
            </div>
            {summary?.dailySeries && summary.dailySeries.length > 1 ? (
              <Sparkline data={summary.dailySeries.map(d => ({ revenue: Number(d.revenue) }))} />
            ) : (
              <div className="h-14 flex items-center justify-center">
                <p className="text-xs text-white/20">No revenue data yet</p>
              </div>
            )}
            {summary?.dailySeries && summary.dailySeries.length > 1 && (
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-white/25">
                  {summary.dailySeries[0]?.date ? format(parseISO(summary.dailySeries[0].date), "MMM d") : ""}
                </span>
                <span className="text-[10px] text-white/25">
                  {summary.dailySeries.at(-1)?.date ? format(parseISO(summary.dailySeries.at(-1)!.date), "MMM d") : ""}
                </span>
              </div>
            )}
          </div>

          {/* Balance card */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-5 flex flex-col">
            <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium mb-3">Available balance</p>
            <p className="text-2xl font-bold text-white">{merchant ? fmtGHS(Number(merchant.balance)) : "—"}</p>
            <p className="text-xs text-white/30 mt-1 mb-4">{merchant?.currency ?? "GHS"} · Merchant wallet</p>
            {merchant && Number(merchant.totalVolume) > 0 && (
              <div className="bg-white/4 rounded-lg px-3 py-2 mb-4">
                <p className="text-[10px] text-white/30 mb-0.5">Total processed</p>
                <p className="text-sm font-semibold text-white/50">{fmtGHS(Number(merchant.totalVolume))}</p>
              </div>
            )}
            <div className="mt-auto">
              <button
                onClick={() => router.push("/payouts")}
                className="w-full py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors font-medium"
              >
                View payouts
              </button>
            </div>
          </div>
        </div>

        {/* Recent sessions */}
        <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <p className="text-sm font-semibold text-white">Recent transactions</p>
            <button
              onClick={() => router.push("/transactions")}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-[#B7EE7A] transition-colors"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          {sessions.length === 0 ? (
            <div className="py-12 text-center">
              <CreditCard size={28} className="mx-auto mb-3 text-white/15" />
              <p className="text-sm text-white/30">No transactions yet</p>
              <p className="text-xs text-white/20 mt-1">Generate a payment link to start accepting payments</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/4">
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-white/25 uppercase tracking-wider">Description</th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-white/25 uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-white/25 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-white/25 uppercase tracking-wider hidden md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3">
                {sessions.map((session) => {
                  const cfg = TX_STATUS[session.status] ?? TX_STATUS.PENDING;
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={session.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-white/80 text-sm truncate max-w-[150px]">
                          {session.description || "Payment"}
                        </p>
                        <p className="text-[10px] text-white/30 font-mono truncate max-w-[150px]">{session.id}</p>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className="text-xs text-white/35">
                          {fmtDate(session.completedAt ?? session.createdAt)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <p className="font-semibold text-white">{fmtGHS(Number(session.amount))}</p>
                        {session.netAmount != null && (
                          <p className="text-[10px] text-white/25">{fmtGHS(Number(session.netAmount))} net</p>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.cls}`}>
                          <StatusIcon size={13} />
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
