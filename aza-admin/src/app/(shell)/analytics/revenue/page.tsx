"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRevenueAnalytics, MonthlyRevenue, RevenueData } from "@/lib/admin-api";
import {
  TrendingUp,
  ArrowLeftRight,
  Users,
  DollarSign,
  Loader2,
} from "lucide-react";

function fmtGhs(n: number): string {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], { month: "short", year: "numeric" });
}

const PERIOD_OPTIONS = [
  { label: "3 months", value: 3 },
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
];

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/50 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-semibold mt-1.5 ${color}`}>{value}</p>
        </div>
        <div className="p-2 rounded-xl bg-white/5">
          <Icon size={18} className="text-white/40" />
        </div>
      </div>
    </div>
  );
}

export default function RevenueDashboardPage() {
  const [months, setMonths] = useState(12);

  const { data, isLoading, error } = useQuery<RevenueData>({
    queryKey: ["revenueAnalytics", months],
    queryFn: () => getRevenueAnalytics(months),
  });

  const monthly: MonthlyRevenue[] = data?.monthly ?? [];
  const totals = data?.totals;

  // Sort monthly ascending for chart, descending for table
  const chartData = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
  const tableData = [...monthly].sort((a, b) => b.month.localeCompare(a.month));

  const maxVolume = Math.max(...chartData.map((m) => m.volume), 1);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Transaction Volume & Revenue</h1>
        <p className="text-white/40 text-sm mt-0.5">Platform transaction activity and trends</p>
      </div>

      {/* Stat cards */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Volume"
            value={fmtGhs(totals.volume)}
            icon={DollarSign}
            color="text-[#B7EE7A]"
          />
          <StatCard
            label="Total Transactions"
            value={totals.count.toLocaleString()}
            icon={ArrowLeftRight}
            color="text-white"
          />
          <StatCard
            label="Avg Transaction"
            value={fmtGhs(totals.avgTransaction)}
            icon={TrendingUp}
            color="text-emerald-400"
          />
          <StatCard
            label="Active Users"
            value={totals.activeUsers.toLocaleString()}
            icon={Users}
            color="text-white"
          />
        </div>
      )}

      {/* Period selector */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMonths(opt.value)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              months === opt.value
                ? "bg-[#B7EE7A] text-black"
                : "text-white/50 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-white/30" size={24} />
        </div>
      ) : (
        <>
          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-1">Monthly Volume</h2>
              <p className="text-xs text-white/35 mb-6">Transaction volume by month</p>
              <div className="flex items-end gap-2" style={{ height: "160px" }}>
                {chartData.map((m) => {
                  const heightPct = (m.volume / maxVolume) * 100;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full">
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className="w-full rounded-t-md transition-all"
                          style={{
                            height: `${heightPct}%`,
                            backgroundColor: "#B7EE7A",
                            minHeight: m.volume > 0 ? "4px" : "0px",
                          }}
                          title={`${fmtMonth(m.month)}: ${fmtGhs(m.volume)}`}
                        />
                      </div>
                      <span className="text-[9px] text-white/35 text-center leading-tight whitespace-nowrap">
                        {fmtMonth(m.month).replace(" ", "\n")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly table */}
          {tableData.length > 0 && (
            <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/35">
                      Month
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-white/35">
                      Volume
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-white/35">
                      Transactions
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-white/35">
                      Avg Transaction
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tableData.map((m, idx) => (
                    <tr
                      key={m.month}
                      className={idx % 2 === 0 ? "bg-white/[0.01]" : ""}
                    >
                      <td className="px-5 py-3 text-sm font-medium text-white">
                        {fmtMonth(m.month)}
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-[#B7EE7A] font-semibold">
                        {fmtGhs(m.volume)}
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-white/70">
                        {m.count.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-white/70">
                        {fmtGhs(m.avgTransaction)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tableData.length === 0 && !isLoading && (
            <div className="text-center py-20 text-white/25">
              <TrendingUp size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No revenue data available</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
