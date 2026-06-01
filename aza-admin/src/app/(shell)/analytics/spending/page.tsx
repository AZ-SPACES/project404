"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminCategoryBreakdown, CategoryBreakdown } from "@/lib/admin-api";
import { PieChart } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  FOOD: "#F59E0B",
  TRANSPORT: "#3B82F6",
  BILLS: "#8B5CF6",
  EDUCATION: "#10B981",
  ENTERTAINMENT: "#EC4899",
  SHOPPING: "#F97316",
  HEALTHCARE: "#EF4444",
  SAVINGS: "#14B8A6",
  OTHERS: "#6B7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  FOOD: "Food & Dining",
  TRANSPORT: "Transport",
  BILLS: "Bills & Utilities",
  EDUCATION: "Education",
  ENTERTAINMENT: "Entertainment",
  SHOPPING: "Shopping",
  HEALTHCARE: "Healthcare",
  SAVINGS: "Savings",
  OTHERS: "Others",
};

const PERIOD_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

function ghs(amount: number) {
  return `GHS ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SpendingAnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error } = useQuery<CategoryBreakdown[]>({
    queryKey: ["admin-category-breakdown", days],
    queryFn: () => getAdminCategoryBreakdown(days),
    staleTime: 2 * 60_000,
  });

  const grandTotal = data?.reduce((sum, c) => sum + c.total, 0) ?? 0;
  const grandCount = data?.reduce((sum, c) => sum + c.count, 0) ?? 0;
  const maxTotal = data && data.length > 0 ? Math.max(...data.map(c => c.total)) : 1;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1 flex items-center gap-2">
            <PieChart size={22} className="text-[#B7EE7A]" />
            Spending Analytics
          </h1>
          <p className="text-foreground/50 text-sm">
            Platform-wide spending distribution by category
          </p>
        </div>

        <div className="flex gap-2">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                days === opt.value
                  ? "bg-[#B7EE7A]/15 text-[#B7EE7A] border-[#B7EE7A]/30"
                  : "bg-muted/30 text-foreground/50 border-border hover:text-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {(error as Error).message}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-foreground/40 text-xs uppercase tracking-wider font-medium mb-1">Total Volume</p>
          <p className="text-2xl font-bold text-foreground">{isLoading ? "—" : ghs(grandTotal)}</p>
          <p className="text-foreground/30 text-xs mt-1">Last {days} days</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-foreground/40 text-xs uppercase tracking-wider font-medium mb-1">Transactions</p>
          <p className="text-2xl font-bold text-foreground">{isLoading ? "—" : grandCount.toLocaleString()}</p>
          <p className="text-foreground/30 text-xs mt-1">Categorised transfers</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-24 text-foreground/30">
          <PieChart size={40} className="mx-auto mb-4 opacity-40" />
          <p>No spending data for this period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(cat => {
            const color = CATEGORY_COLORS[cat.category] ?? "#6B7280";
            const label = CATEGORY_LABELS[cat.category] ?? cat.category;
            const barWidth = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
            return (
              <div
                key={cat.category}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-foreground font-medium text-sm">{label}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-foreground font-semibold text-sm">{ghs(cat.total)}</div>
                    <div className="text-foreground/30 text-xs">{cat.count} txn{cat.count !== 1 ? "s" : ""}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-xs text-foreground/40 w-12 text-right shrink-0">
                    {cat.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
