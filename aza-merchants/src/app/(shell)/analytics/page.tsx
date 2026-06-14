"use client";

import { useEffect, useState, useCallback } from "react";
import { getAnalytics, AnalyticsSummary } from "@/lib/merchant-api";
import { Loader2, AlertCircle, BarChart2, TrendingUp, Users, Percent } from "lucide-react";
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
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return iso;
  }
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground/40 font-medium">{label}</p>
        <Icon size={14} className={accent ? "text-[#B7EE7A]" : "text-foreground/20"} />
      </div>
      <p className={`text-xl font-bold font-mono ${accent ? "text-[#B7EE7A]" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────

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
      {/* Tooltip */}
      {hovered !== null && series[hovered] && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground shadow-lg whitespace-nowrap">
            <span className="text-foreground/50 mr-1.5">{fmtDateLabel(series[hovered].date)}</span>
            <span className="font-mono font-semibold">{fmtGHS(series[hovered].revenue)}</span>
            <span className="text-foreground/40 ml-1.5">{series[hovered].count} payment{series[hovered].count !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}

      {/* Chart bars */}
      <div className="flex items-end gap-1 h-40">
        {series.map((day, i) => {
          const heightPct = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
          const isHovered = hovered === i;
          // Show date label every 5 days (and the last day)
          const showLabel = i % 5 === 0 || i === series.length - 1;

          return (
            <div
              key={day.date}
              className="flex flex-col items-center flex-1 h-full group"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-end flex-1 w-full">
                <div className="w-full relative">
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
                    <div
                      className="w-full rounded-t"
                      style={{ height: "2px", background: "rgba(255,255,255,0.06)" }}
                    />
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

// ─── Top Customers Table ──────────────────────────────────────────────────────

function TopCustomersTable({
  customers,
}: {
  customers: AnalyticsSummary["topCustomers"];
}) {
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
            <th
              key={h}
              className={`px-5 py-3 text-[10px] font-semibold text-foreground/25 uppercase tracking-wider ${
                i === 0 ? "text-center w-10" : i >= 2 ? "text-right" : "text-left"
              }`}
            >
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
              <p className="font-medium text-foreground/80 text-xs truncate max-w-[180px]">
                {c.displayName || "Unknown"}
              </p>
              <p className="text-[10px] text-foreground/30 font-mono mt-0.5 truncate max-w-[180px]">
                {c.userId}
              </p>
            </td>
            <td className="px-5 py-3.5 text-right">
              <span className="font-semibold text-foreground font-mono text-xs">
                {fmtGHS(c.totalPaid)}
              </span>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalytics();
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          <p className="text-foreground/40 text-sm mt-0.5">Last 30 days</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/30 border border-border text-sm text-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors flex-shrink-0 disabled:opacity-40"
        >
          <BarChart2 size={14} />
          Refresh
        </button>
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
          {/* Revenue Summary Cards (4 across) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              label="Today"
              value={fmtShort(data.todayRevenue)}
              icon={TrendingUp}
              accent
            />
            <SummaryCard
              label="Last 7 days"
              value={fmtShort(data.sevenDayRevenue)}
              icon={TrendingUp}
            />
            <SummaryCard
              label="Last 30 days"
              value={fmtShort(data.thirtyDayRevenue)}
              icon={TrendingUp}
            />
            <SummaryCard
              label="All time"
              value={fmtShort(data.allTimeRevenue)}
              icon={TrendingUp}
            />
          </div>

          {/* Conversion + Avg Order row (2 cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Conversion Rate */}
            <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-foreground/40 font-medium">Conversion rate (30d)</p>
                <Percent size={14} className="text-foreground/20" />
              </div>
              <p className="text-2xl font-bold font-mono text-foreground">
                {data.conversionRate.toFixed(1)}%
              </p>
              {/* Progress bar */}
              <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#B7EE7A] transition-all"
                  style={{ width: `${Math.min(data.conversionRate, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-foreground/35 pt-0.5">
                <span>{data.thirtyDayCompletedCount.toLocaleString()} completed</span>
                <span>{data.thirtyDaySessionCount.toLocaleString()} sessions</span>
              </div>
            </div>

            {/* Avg Order Value */}
            <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-foreground/40 font-medium">Avg order value (30d)</p>
                <TrendingUp size={14} className="text-foreground/20" />
              </div>
              <p className="text-2xl font-bold font-mono text-foreground">
                {fmtGHS(data.avgOrderValue)}
              </p>
              <p className="text-xs text-foreground/30">
                Across {data.thirtyDayCompletedCount.toLocaleString()} paid order
                {data.thirtyDayCompletedCount !== 1 ? "s" : ""} in the last 30 days
              </p>
            </div>
          </div>

          {/* Daily Revenue Bar Chart */}
          <div className="bg-card border border-border rounded-xl px-5 py-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-foreground">Daily revenue</p>
              <p className="text-xs text-foreground/35 mt-0.5">30-day view</p>
            </div>
            <DailyBarChart series={data.dailySeries} />
          </div>

          {/* Top Customers */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Top customers</p>
              <p className="text-xs text-foreground/35 mt-0.5">By total spend, last 30 days</p>
            </div>
            <TopCustomersTable customers={data.topCustomers} />
          </div>
        </>
      ) : null}
    </div>
  );
}
