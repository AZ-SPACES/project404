"use client";

import { useEffect, useState } from "react";
import { getSupportAnalytics, getSupportStats, SupportAnalytics, SupportStats } from "@/lib/admin-api";
import { Headset, Clock, CheckCircle2, TrendingUp, AlertCircle, Loader2, BarChart3 } from "lucide-react";

function MetricCard({
  label, value, sub, icon: Icon, color = "text-white",
}: { label: string; value: string; sub?: string; icon: React.ElementType; color?: string }) {
  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-semibold mt-1.5 ${color}`}>{value}</p>
          {sub && <p className="text-white/35 text-xs mt-1">{sub}</p>}
        </div>
        <div className="p-2 rounded-xl bg-white/5">
          <Icon size={18} className="text-white/35" />
        </div>
      </div>
    </div>
  );
}

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/50 w-24 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-white/70 w-8 text-right flex-shrink-0">{count}</span>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  BILLING: "bg-blue-500",
  TECHNICAL: "bg-purple-500",
  ACCOUNT: "bg-emerald-500",
  KYC: "bg-amber-500",
  FRAUD: "bg-red-500",
  GENERAL: "bg-white/40",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-amber-500",
  NORMAL: "bg-blue-500",
  LOW: "bg-white/30",
};

export default function SupportAnalyticsPage() {
  const [analytics, setAnalytics] = useState<SupportAnalytics | null>(null);
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getSupportAnalytics().catch(() => null),
      getSupportStats().catch(() => null),
    ]).then(([a, s]) => {
      setAnalytics(a);
      setStats(s);
      setLoading(false);
    }).catch((e) => {
      setError(e.message ?? "Failed to load analytics");
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-white/30" size={28} />
      </div>
    );
  }

  // Show placeholder UI if analytics endpoint not yet available
  const data: SupportAnalytics = analytics ?? {
    totalTickets: stats ? (stats.open + stats.resolved) : 0,
    openTickets: stats?.open ?? 0,
    resolvedToday: 0,
    avgFirstResponseMinutes: 0,
    avgResolutionHours: 0,
    slaComplianceRate: 0,
    byCategory: [],
    byPriority: [],
    recentTrend: [],
  };

  const maxCategory = Math.max(...(data.byCategory.map((c) => c.count)), 1);
  const maxPriority = Math.max(...(data.byPriority.map((p) => p.count)), 1);

  const fmtMinutes = (m: number) => {
    if (!m) return "—";
    if (m < 60) return `${Math.round(m)}m`;
    return `${(m / 60).toFixed(1)}h`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Support Analytics</h1>
        <p className="text-white/40 text-sm mt-0.5">Performance metrics and ticket insights</p>
      </div>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          Some metrics may be unavailable — analytics endpoint not yet connected.
        </div>
      )}

      {/* Key metrics */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/25 font-semibold mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            label="Total Tickets"
            value={data.totalTickets.toLocaleString()}
            icon={Headset}
          />
          <MetricCard
            label="Open Tickets"
            value={data.openTickets.toLocaleString()}
            icon={AlertCircle}
            color="text-amber-400"
          />
          <MetricCard
            label="Resolved Today"
            value={data.resolvedToday.toLocaleString()}
            icon={CheckCircle2}
            color="text-emerald-400"
          />
          <MetricCard
            label="SLA Compliance"
            value={data.slaComplianceRate ? `${data.slaComplianceRate.toFixed(0)}%` : "—"}
            icon={TrendingUp}
            color={data.slaComplianceRate >= 90 ? "text-emerald-400" : data.slaComplianceRate >= 75 ? "text-amber-400" : "text-red-400"}
          />
        </div>
      </section>

      {/* Response times */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/25 font-semibold mb-4">Response Times</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Avg First Response</p>
              <Clock size={16} className="text-white/20" />
            </div>
            <p className="text-3xl font-semibold text-[#F5A623] mt-1.5">{fmtMinutes(data.avgFirstResponseMinutes)}</p>
            <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  data.avgFirstResponseMinutes < 60 ? "bg-emerald-500" :
                  data.avgFirstResponseMinutes < 240 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min((data.avgFirstResponseMinutes / 480) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-white/25 mt-1.5">Target: &lt;60 minutes</p>
          </div>

          <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Avg Resolution Time</p>
              <CheckCircle2 size={16} className="text-white/20" />
            </div>
            <p className="text-3xl font-semibold text-[#F5A623] mt-1.5">{fmtMinutes(data.avgResolutionHours * 60)}</p>
            <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  data.avgResolutionHours < 4 ? "bg-emerald-500" :
                  data.avgResolutionHours < 24 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min((data.avgResolutionHours / 72) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-white/25 mt-1.5">Target: &lt;4 hours</p>
          </div>
        </div>
      </section>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={16} className="text-white/30" />
            <h3 className="text-sm font-semibold text-white/70">Tickets by Category</h3>
          </div>
          {data.byCategory.length === 0 ? (
            <div className="py-8 text-center text-white/20 text-sm">No data available</div>
          ) : (
            <div className="space-y-3">
              {data.byCategory.map(({ category, count }) => (
                <BarRow
                  key={category}
                  label={category.charAt(0) + category.slice(1).toLowerCase()}
                  count={count}
                  max={maxCategory}
                  color={CATEGORY_COLORS[category] ?? "bg-white/40"}
                />
              ))}
            </div>
          )}
        </div>

        {/* By Priority */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <AlertCircle size={16} className="text-white/30" />
            <h3 className="text-sm font-semibold text-white/70">Tickets by Priority</h3>
          </div>
          {data.byPriority.length === 0 ? (
            <div className="py-8 text-center text-white/20 text-sm">No data available</div>
          ) : (
            <div className="space-y-3">
              {data.byPriority.map(({ priority, count }) => (
                <BarRow
                  key={priority}
                  label={priority.charAt(0) + priority.slice(1).toLowerCase()}
                  count={count}
                  max={maxPriority}
                  color={PRIORITY_COLORS[priority] ?? "bg-white/30"}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent trend */}
      {data.recentTrend.length > 0 && (
        <section>
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white/70 mb-5">7-Day Ticket Trend</h3>
            <div className="flex items-end gap-2 h-24">
              {data.recentTrend.map((d) => {
                const maxVal = Math.max(...data.recentTrend.map((x) => Math.max(x.opened, x.resolved)), 1);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-0.5 items-end" style={{ height: "72px" }}>
                      <div
                        className="flex-1 bg-[#F5A623]/60 rounded-t"
                        style={{ height: `${(d.opened / maxVal) * 100}%` }}
                        title={`Opened: ${d.opened}`}
                      />
                      <div
                        className="flex-1 bg-emerald-500/50 rounded-t"
                        style={{ height: `${(d.resolved / maxVal) * 100}%` }}
                        title={`Resolved: ${d.resolved}`}
                      />
                    </div>
                    <span className="text-[9px] text-white/20">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#F5A623]/60" />
                <span className="text-[11px] text-white/35">Opened</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50" />
                <span className="text-[11px] text-white/35">Resolved</span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
