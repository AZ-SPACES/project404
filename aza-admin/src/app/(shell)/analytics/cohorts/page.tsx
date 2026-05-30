"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCohortAnalytics, CohortData } from "@/lib/admin-api";
import { Users2, Loader2 } from "lucide-react";

function parseMY(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month: m };
}

function fmtMonthLabel(ym: string): string {
  const { year, month } = parseMY(ym);
  return new Date(year, month - 1, 1).toLocaleDateString([], { month: "short", year: "numeric" });
}

function retentionBg(pct: number): string {
  return `rgba(183,238,122,${(pct / 100).toFixed(2)})`;
}

function retentionTextColor(pct: number): string {
  return pct > 50 ? "text-black" : "text-white/80";
}

const PERIOD_OPTIONS = [
  { label: "3 months", value: 3 },
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
];

export default function CohortRetentionPage() {
  const [months, setMonths] = useState(6);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cohortAnalytics", months],
    queryFn: () => getCohortAnalytics(months),
  });

  const cohorts: CohortData[] = data?.cohorts ?? [];

  // Determine max columns (longest retention array)
  const maxCols = cohorts.reduce((acc, c) => Math.max(acc, c.retention.length), 0);

  // Average retention by month index across all cohorts
  const avgRetention: number[] = Array.from({ length: maxCols }, (_, i) => {
    const values = cohorts
      .map((c) => c.retention[i])
      .filter((v) => v !== undefined);
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  });

  const maxAvg = Math.max(...avgRetention, 1);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Cohort Retention Analysis</h1>
        <p className="text-white/40 text-sm mt-0.5">
          How well each signup cohort retains users over subsequent months
        </p>
      </div>

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
      ) : cohorts.length === 0 ? (
        <div className="text-center py-20 text-white/25">
          <Users2 size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No cohort data available</p>
        </div>
      ) : (
        <>
          {/* Heatmap table */}
          <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/35 min-w-[160px]">
                      Cohort
                    </th>
                    {Array.from({ length: maxCols }, (_, i) => (
                      <th
                        key={i}
                        className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-white/35 min-w-[64px]"
                      >
                        M+{i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cohorts.map((cohort, rowIdx) => (
                    <tr key={cohort.month} className={rowIdx % 2 === 0 ? "" : "bg-white/[0.01]"}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-medium text-white">{fmtMonthLabel(cohort.month)}</p>
                        <p className="text-xs text-white/35 mt-0.5">{cohort.cohortSize.toLocaleString()} users</p>
                      </td>
                      {Array.from({ length: maxCols }, (_, colIdx) => {
                        const pct = cohort.retention[colIdx];
                        const isFuture = pct === undefined;
                        return (
                          <td key={colIdx} className="px-1 py-1">
                            {isFuture ? (
                              <div className="mx-auto w-14 h-10 rounded-lg bg-white/3 flex items-center justify-center">
                                <span className="text-xs text-white/20">—</span>
                              </div>
                            ) : (
                              <div
                                className={`mx-auto w-14 h-10 rounded-lg flex items-center justify-center transition-colors ${retentionTextColor(pct)}`}
                                style={{ backgroundColor: retentionBg(pct) }}
                                title={`${pct}% retention`}
                              >
                                <span className="text-xs font-semibold">{pct}%</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Average retention bar chart */}
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-1">
              Average Retention by Month
            </h2>
            <p className="text-xs text-white/35 mb-6">
              Average across all {cohorts.length} cohort{cohorts.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-end gap-2 h-40">
              {avgRetention.map((avg, i) => {
                const heightPct = maxAvg > 0 ? (avg / maxAvg) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-white/50 font-medium">
                      {Math.round(avg)}%
                    </span>
                    <div className="w-full flex items-end" style={{ height: "96px" }}>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: `rgba(183,238,122,${0.3 + 0.7 * (avg / 100)})`,
                          minHeight: avg > 0 ? "4px" : "0px",
                        }}
                        title={`M+${i}: ${avg.toFixed(1)}% avg retention`}
                      />
                    </div>
                    <span className="text-[10px] text-white/35">M+{i}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
