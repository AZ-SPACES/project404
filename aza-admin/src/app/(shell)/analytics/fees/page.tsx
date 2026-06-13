"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFeeSummary, getDailyFees, type FeeSummary, type DailyFee } from "@/lib/admin-api";
import { Coins, Loader2 } from "lucide-react";

function ghs(value: number) {
  return `GHS ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-5">
      <p className="text-xs text-foreground/50 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{ghs(value)}</p>
    </div>
  );
}

export default function FeeRevenuePage() {
  const [days, setDays] = useState(30);

  const { data: summary, isLoading: summaryLoading } = useQuery<FeeSummary>({
    queryKey: ["feeSummary"],
    queryFn: getFeeSummary,
  });

  const { data: daily, isLoading: dailyLoading } = useQuery<DailyFee[]>({
    queryKey: ["dailyFees", days],
    queryFn: () => getDailyFees(days),
  });

  const maxFee = daily ? Math.max(...daily.map((d) => d.fees), 1) : 1;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Coins size={20} className="text-foreground/50" />
          <h1 className="text-2xl font-semibold text-foreground">Fee Revenue Analytics</h1>
        </div>
        <p className="text-foreground/50 text-sm">Transaction fee income across all time periods.</p>
      </div>

      {/* Summary cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border p-5 animate-pulse bg-muted/20 h-24" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Today" value={summary.today} />
          <StatCard label="This Week" value={summary.thisWeek} />
          <StatCard label="This Month" value={summary.thisMonth} />
          <StatCard label="All Time" value={summary.allTime} />
        </div>
      ) : null}

      {/* Daily chart */}
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-foreground text-sm">Daily Fee Revenue</h2>
          <div className="flex gap-2">
            {[7, 14, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  days === d
                    ? "bg-[#B7EE7A]/15 text-[#B7EE7A] border border-[#B7EE7A]/30"
                    : "bg-muted/30 text-foreground/50 hover:text-foreground border border-transparent"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {dailyLoading ? (
          <div className="h-48 bg-muted/20 rounded-lg animate-pulse" />
        ) : daily && daily.length > 0 ? (
          <>
            <div className="flex items-end gap-0.5 h-48 mb-2">
              {daily.map((d) => {
                const heightPct = maxFee > 0 ? (d.fees / maxFee) * 100 : 0;
                return (
                  <div
                    key={d.date}
                    className="group relative flex-1 flex flex-col justify-end"
                    title={`${d.date}: ${ghs(d.fees)} (${d.txCount} tx)`}
                  >
                    <div
                      className="rounded-t bg-[#B7EE7A]/60 hover:bg-[#B7EE7A] transition-colors"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-card border border-border rounded-lg px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <p className="font-medium text-foreground">{ghs(d.fees)}</p>
                      <p className="text-foreground/50">{d.txCount} tx</p>
                      <p className="text-foreground/30">{d.date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-foreground/30 px-0.5">
              <span>{daily[0]?.date}</span>
              <span>{daily[daily.length - 1]?.date}</span>
            </div>
          </>
        ) : (
          <div className="h-48 flex items-center justify-center text-foreground/30 text-sm">
            No fee data for this period
          </div>
        )}
      </div>
    </div>
  );
}
