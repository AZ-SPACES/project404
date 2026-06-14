"use client";

import { useEffect, useState, useCallback } from "react";
import { getAnalytics, AnalyticsSummary } from "@/lib/merchant-api";
import { Loader2, AlertCircle, BarChart2, TrendingUp, TrendingDown, Users, Percent } from "lucide-react";
import { format, parseISO } from "date-fns";

function fmtGHS(n: number) {
  return `GH₵ ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `GH₵ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `GH₵ ${(n / 1_000).toFixed(1)}K`;
  return fmtGHS(n);
}

function fmtDateLabel(iso: string) {
  try { return format(parseISO(iso), "MMM d"); }
  catch { return iso; }
}

function ChangeChip({ pct }: { pct: number }) {
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
      up ? "text-[#B7EE7A] bg-[#B7EE7A]/10" : "text-red-400 bg-red-400/10"
    }`}>
      <Icon size={10} />
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function SummaryCard({
  label,
  value,
  change,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  change?: number;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground/40 font-medium">{label}</p>
        <Icon size={14} className={accent ? "text-[#B7EE7A]" : "text-foreground/20"} />
      </div>
      <div className="flex items-end gap-2">
        <p className={`text-xl font-bold font-mono ${accent ? "text-[#B7EE7A]" : "text-foreground"}`}>
          {value}
        </p>
        {change !== undefined && <ChangeChip pct={change} />}
      </div>
      {sub && <p className="text-[11px] text-foreground/30">{sub}</p>}
    </div>
  );
}

function DailyBarChart({ series }: { series: AnalyticsSummary["dailySeries"] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (!series || series.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-foreground/25 text-sm">
        No data available
      </div>
    );
  }

  const maxRevenue = Math.max(...series.map((d) => d.revenue));

  return (
    <div className="relative">
      {hovered !== null && series[hovered] && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground shadow-lg whitespace-nowrap">
            <span className="text-foreground/50 mr-1.5">{fmtDateLabel(series[hovered].date)}</span>
            <span className="font-mono font-semibold">{fmtGHS(series[hovered].revenue)}</span>
            <span className="text-foreground/40 ml-1.5">{series[hovered].count} payment{series[hovered].count !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}
      <div className="flex items-end gap-1 h-40">
        {series.map((day, i) => {
          const heightPct = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
          const isHovered = hovered === i;
          const showLabel = i % Math.max(1, Math.floor(series.length / 8)) === 0 || i === series.length - 1;
          return (
            <div
              key={day.date}
              className="flex flex-col items-center flex-1 h-full"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-end flex-1 w-full">
                <div className="w-full">
                  {day.revenue > 0 ? (
                    <div
                      className="w-full rounded-t transition-all duration-150"
                      style={{
                        height: `${Math.max(heightPct, 4)}%`,
                        maxHeight: "100%",
                        background: isHovered ? "#c8f590" : "#B7EE7A",
                        opacity: isHovered ? 1 : 0.75,
                      }}
                    />
                  ) : (
                    <div className="w-full rounded-t" style={{ height: "2px", background: "rgba(255,255,255,0.06)" }} />
                  )}
                </div>
              </div>
              {showLabel && (
                <span className="text-[9px] text-foreground/25 mt-1 truncate w-full text-center leading-tight">
                  {fmtDateLabel(day.date)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopCustomersTable({ customers }: { customers: AnalyticsSummary["topCustomers"] }) {
  if (!customers || customers.length === 0) {
    return (
      <div className="py-10 text-center">
        <Users size={24} className="mx-auto mb-2 text-foreground/15" />
        <p className="text-sm text-foreground/30">No customer data yet</p>
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          {["#", "Customer", "Total Paid", "Payments"].map((h, i) => (
            <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-foreground/25 uppercase tracking-wider ${
              i === 0 ? "text-center w-10" : i >= 2 ? "text-right" : "text-left"
            }`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.03]">
        {customers.slice(0, 5).map((c, i) => (
          <tr key={c.userId} className="hover:bg-muted/10 transition-colors">
            <td className="px-5 py-3.5 text-center">
              <span className="text-xs font-bold text-foreground/30">{i + 1}</span>
            </td>
            <td className="px-5 py-3.5">
              <p className="font-medium text-foreground/80 text-xs truncate max-w-[180px]">{c.displayName || "Unknown"}</p>
            </td>
            <td className="px-5 py-3.5 text-right">
              <span className="font-semibold text-foreground font-mono text-xs">{fmtGHS(c.totalPaid)}</span>
            </td>
            <td className="px-5 py-3.5 text-right">
              <span className="text-foreground/50 text-xs">{c.paymentCount}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const PERIOD_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalytics(d);
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  function selectPeriod(d: number) {
    setDays(d);
  }

  const periodLabel = days === 7 ? "7 days" : days === 30 ? "30 days" : `${days} days`;
  const prevLabel = `prev ${periodLabel}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          <p className="text-foreground/40 text-sm mt-0.5">Last {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex bg-muted/30 p-1 rounded-xl gap-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => selectPeriod(opt.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  days === opt.days ? "bg-[#174717] text-foreground" : "text-foreground/45 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(days)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/30 border border-border text-sm text-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40"
          >
            <BarChart2 size={14} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-foreground/30" size={24} />
        </div>
      ) : data ? (
        <>
          {/* Revenue cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              label="Today"
              value={fmtShort(data.todayRevenue)}
              icon={TrendingUp}
              accent
            />
            <SummaryCard
              label={`Last ${periodLabel}`}
              value={fmtShort(data.periodRevenue ?? data.thirtyDayRevenue)}
              change={data.revenueChange}
              sub={`vs ${prevLabel}`}
              icon={TrendingUp}
            />
            <SummaryCard
              label="Completed orders"
              value={(data.periodCompletedCount ?? data.thirtyDayCompletedCount).toLocaleString()}
              change={data.completedChange}
              sub={`vs ${prevLabel}`}
              icon={TrendingUp}
            />
            <SummaryCard
              label="All time"
              value={fmtShort(data.allTimeRevenue)}
              icon={TrendingUp}
            />
          </div>

          {/* Conversion + Avg Order */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-foreground/40 font-medium">Conversion rate ({periodLabel})</p>
                <Percent size={14} className="text-foreground/20" />
              </div>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold font-mono text-foreground">{data.conversionRate.toFixed(1)}%</p>
                {data.prevConversionRate !== undefined && (
                  <ChangeChip pct={data.conversionRate - data.prevConversionRate} />
                )}
              </div>
              <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-[#B7EE7A] transition-all" style={{ width: `${Math.min(data.conversionRate, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-foreground/35 pt-0.5">
                <span>{(data.periodCompletedCount ?? data.thirtyDayCompletedCount).toLocaleString()} completed</span>
                <span>{(data.periodSessionCount ?? data.thirtyDaySessionCount).toLocaleString()} sessions</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-foreground/40 font-medium">Avg order value</p>
                <TrendingUp size={14} className="text-foreground/20" />
              </div>
              <p className="text-2xl font-bold font-mono text-foreground">{fmtGHS(data.avgOrderValue)}</p>
              <p className="text-xs text-foreground/30">
                Across {(data.periodCompletedCount ?? data.thirtyDayCompletedCount).toLocaleString()} paid orders
              </p>
            </div>
          </div>

          {/* Daily revenue chart */}
          <div className="bg-card border border-border rounded-xl px-5 py-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-foreground">Daily revenue</p>
              <p className="text-xs text-foreground/35 mt-0.5">{periodLabel} view</p>
            </div>
            <DailyBarChart series={data.dailySeries} />
          </div>

          {/* Top customers */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Top customers</p>
              <p className="text-xs text-foreground/35 mt-0.5">By total spend, all time</p>
            </div>
            <TopCustomersTable customers={data.topCustomers} />
          </div>
        </>
      ) : null}
    </div>
  );
}
