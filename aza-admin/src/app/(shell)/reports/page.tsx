"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlatformReport, getStats, PlatformReport, AdminStats } from "@/lib/admin-api";
import { FileBarChart2, TrendingUp, Users, DollarSign, Coins, Loader2, AlertCircle, Download } from "lucide-react";

type Period = "TODAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";

const PERIOD_LABELS: Record<Period, string> = {
  TODAY: "Today",
  WEEK: "This Week",
  MONTH: "This Month",
  QUARTER: "This Quarter",
  YEAR: "This Year",
};

function fmtGhs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MetricCard({
  label, value, sub, icon: Icon, color = "text-white",
}: { label: string; value: string; sub?: string; icon: React.ElementType; color?: string }) {
  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-semibold mt-1.5 leading-tight ${color}`}>{value}</p>
          {sub && <p className="text-white/35 text-xs mt-1">{sub}</p>}
        </div>
        <div className="p-2 rounded-xl bg-white/5">
          <Icon size={18} className="text-white/30" />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-white">{value}</span>
        {sub && <p className="text-xs text-white/30">{sub}</p>}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("MONTH");

  const { data: report, error: reportError } = useQuery<PlatformReport | null>({
    queryKey: ["platformReport", period],
    queryFn: () => getPlatformReport(period).catch(() => null),
  });

  const { data: stats, isLoading } = useQuery<AdminStats | null>({
    queryKey: ["stats"],
    queryFn: () => getStats().catch(() => null),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reports & Analytics</h1>
          <p className="text-white/40 text-sm mt-0.5">Platform financial performance and user metrics</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-sm text-white/60 hover:text-white transition-all">
          <Download size={15} />
          Export CSV
        </button>
      </div>

      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              period === p ? "bg-[#B7EE7A] text-black" : "text-white/50 hover:text-white"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {reportError && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          Report endpoint not yet connected — showing available platform stats below.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-white/30" size={28} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              label="Transaction Volume"
              value={report ? fmtGhs(report.transactionVolume) : stats ? fmtGhs(stats.totalTransactionVolume) : "—"}
              sub={report ? `${report.transactionCount.toLocaleString()} transactions` : undefined}
              icon={TrendingUp}
              color="text-[#B7EE7A]"
            />
            <MetricCard
              label="Fee Revenue"
              value={report ? fmtGhs(report.feeRevenue) : "—"}
              sub="Platform earnings"
              icon={Coins}
              color="text-emerald-400"
            />
            <MetricCard
              label="New Users"
              value={report ? report.newUsers.toLocaleString() : stats ? stats.totalUsers.toLocaleString() : "—"}
              sub={report ? `of ${report.activeUsers.toLocaleString()} active` : "total users"}
              icon={Users}
            />
            <MetricCard
              label="Avg Transaction"
              value={report ? fmtGhs(report.averageTransactionSize) : "—"}
              sub={report ? `Top type: ${report.topTransactionType}` : undefined}
              icon={DollarSign}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                <FileBarChart2 size={16} className="text-white/30" />
                Financial Summary — {PERIOD_LABELS[period]}
              </h3>
              {report ? (
                <>
                  <SummaryRow label="Transaction Volume" value={fmtGhs(report.transactionVolume)} sub={`${report.transactionCount.toLocaleString()} txns`} />
                  <SummaryRow label="Fee Revenue" value={fmtGhs(report.feeRevenue)} />
                  <SummaryRow label="Total Revenue" value={fmtGhs(report.totalRevenue)} />
                  <SummaryRow label="Average Transaction" value={fmtGhs(report.averageTransactionSize)} />
                  <SummaryRow label="Top Transaction Type" value={report.topTransactionType} />
                  <SummaryRow label="Period" value={`${report.startDate} → ${report.endDate}`} />
                </>
              ) : stats ? (
                <>
                  <SummaryRow label="Total Volume (All Time)" value={fmtGhs(stats.totalTransactionVolume)} />
                  <SummaryRow label="Total Transactions" value={stats.totalTransactions.toLocaleString()} />
                  <SummaryRow label="Completed" value={stats.completedTransactions.toLocaleString()} />
                  <SummaryRow label="Today's Volume" value={fmtGhs(stats.volumeToday)} />
                  <SummaryRow label="Today's Transactions" value={stats.transactionsToday.toLocaleString()} />
                </>
              ) : (
                <div className="py-8 text-center text-white/20 text-sm">No data available</div>
              )}
            </div>

            <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                <Users size={16} className="text-white/30" />
                User Summary — {PERIOD_LABELS[period]}
              </h3>
              {stats ? (
                <>
                  <SummaryRow label="Total Users" value={stats.totalUsers.toLocaleString()} />
                  <SummaryRow label="Active Users" value={stats.activeUsers.toLocaleString()} sub={`${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}% of total`} />
                  <SummaryRow label="Suspended" value={stats.suspendedUsers.toLocaleString()} />
                  <SummaryRow label="KYC Verified" value={stats.kycVerified.toLocaleString()} sub={`${((stats.kycVerified / stats.totalUsers) * 100).toFixed(1)}% verification rate`} />
                  <SummaryRow label="KYC Pending" value={stats.kycPendingReview.toLocaleString()} />
                  {report && <SummaryRow label="New This Period" value={report.newUsers.toLocaleString()} />}
                </>
              ) : (
                <div className="py-8 text-center text-white/20 text-sm">No data available</div>
              )}
            </div>
          </div>

          {stats && (
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-4">KYC Funnel</h3>
              <div className="flex rounded-full overflow-hidden h-3 mb-3">
                {[
                  { label: "Verified", count: stats.kycVerified, color: "bg-emerald-500" },
                  { label: "Pending", count: stats.kycPendingReview, color: "bg-amber-500" },
                  { label: "Rejected", count: stats.kycRejected, color: "bg-red-500" },
                  { label: "Not Started", count: stats.kycNotStarted, color: "bg-white/10" },
                ].map(({ label, count, color }) => {
                  const pct = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
                  return pct > 0 ? (
                    <div key={label} className={`${color} transition-all`} style={{ width: `${pct}%` }} title={`${label}: ${count}`} />
                  ) : null;
                })}
              </div>
              <div className="flex gap-5 flex-wrap">
                {[
                  { label: "Verified", count: stats.kycVerified, color: "bg-emerald-500" },
                  { label: "Pending Review", count: stats.kycPendingReview, color: "bg-amber-500" },
                  { label: "Rejected", count: stats.kycRejected, color: "bg-red-500" },
                  { label: "Not Started", count: stats.kycNotStarted, color: "bg-white/20" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
                    <span className="text-xs text-white/45">{label}: <span className="text-white/70 font-medium">{count.toLocaleString()}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
