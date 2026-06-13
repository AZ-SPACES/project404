"use client";

import { useQuery } from "@tanstack/react-query";
import { getMerchantHealth, type MerchantHealth } from "@/lib/admin-api";
import { HeartPulse, Loader2, AlertTriangle } from "lucide-react";

function fmt(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SuccessRateBadge({ rate }: { rate: number }) {
  const pct = rate * 100;
  if (pct >= 90)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
        {pct.toFixed(1)}%
      </span>
    );
  if (pct >= 70)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
        {pct.toFixed(1)}%
      </span>
    );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">
      {pct.toFixed(1)}%
    </span>
  );
}

export default function MerchantHealthPage() {
  const { data, isLoading } = useQuery<MerchantHealth[]>({
    queryKey: ["merchantHealth"],
    queryFn: getMerchantHealth,
    refetchInterval: 30_000,
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <HeartPulse size={20} className="text-foreground/50" />
          <h1 className="text-2xl font-semibold text-foreground">Merchant Health Monitor</h1>
        </div>
        <p className="text-foreground/50 text-sm">
          Checkout success rates and webhook health per merchant — refreshes every 30 seconds.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 bg-muted/20 rounded-xl animate-pulse" />
      ) : !data || data.length === 0 ? (
        <div className="rounded-xl border border-border text-center py-16 text-foreground/30">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
          <p>No merchant health data available</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Merchant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Total Checkouts</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Successful</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Success Rate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Failed Webhooks</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Last Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((m) => (
                <tr key={m.merchantId} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-foreground font-medium">{m.businessName}</p>
                    <p className="text-xs text-foreground/40 font-mono">{m.merchantId}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{m.totalCheckouts.toLocaleString()}</td>
                  <td className="px-4 py-3 text-foreground/70">{m.successfulCheckouts.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <SuccessRateBadge rate={m.successRate} />
                  </td>
                  <td className="px-4 py-3">
                    {m.failedWebhooks > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">
                        {m.failedWebhooks}
                      </span>
                    ) : (
                      <span className="text-foreground/30 text-xs">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/50 text-xs">{fmt(m.lastTransactionAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center mt-8">
          <Loader2 size={20} className="animate-spin text-foreground/30" />
        </div>
      )}
    </div>
  );
}
