"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getVelocityAlerts, type VelocityAlert } from "@/lib/admin-api";
import { Zap, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function VelocityAlertsPage() {
  const [hours, setHours] = useState<1 | 6 | 24>(1);
  const [threshold, setThreshold] = useState<5 | 10 | 20>(10);

  const { data, isLoading } = useQuery<VelocityAlert[]>({
    queryKey: ["velocityAlerts", hours, threshold],
    queryFn: () => getVelocityAlerts(hours, threshold),
    refetchInterval: 30_000,
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={20} className="text-foreground/50" />
          <h1 className="text-2xl font-semibold text-foreground">Velocity Alert Queue</h1>
        </div>
        <p className="text-foreground/50 text-sm">
          Users exceeding transaction frequency thresholds — refreshes every 30 seconds.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-6 mb-6 rounded-xl border border-border p-4 bg-foreground/5">
        <div>
          <p className="text-xs text-foreground/50 mb-2">Time Window</p>
          <div className="flex gap-2">
            {([1, 6, 24] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  hours === h
                    ? "bg-[#B7EE7A]/15 text-[#B7EE7A] border border-[#B7EE7A]/30"
                    : "bg-muted/30 text-foreground/50 hover:text-foreground border border-transparent"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-foreground/50 mb-2">Min Transactions</p>
          <div className="flex gap-2">
            {([5, 10, 20] as const).map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  threshold === t
                    ? "bg-[#B7EE7A]/15 text-[#B7EE7A] border border-[#B7EE7A]/30"
                    : "bg-muted/30 text-foreground/50 hover:text-foreground border border-transparent"
                }`}
              >
                {t}+
              </button>
            ))}
          </div>
        </div>
        {data && (
          <div className="ml-auto text-sm text-foreground/50">
            <span className="font-semibold text-foreground">{data.length}</span> flagged user{data.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="h-48 bg-muted/20 rounded-xl animate-pulse" />
      ) : !data || data.length === 0 ? (
        <div className="rounded-xl border border-border text-center py-16 text-foreground/30">
          <Zap size={32} className="mx-auto mb-3 opacity-40" />
          <p>No velocity alerts for the selected parameters</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Tx Count</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Window</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((alert) => (
                <tr key={alert.userId} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-foreground font-medium">
                      {alert.firstName || alert.lastName
                        ? `${alert.firstName ?? ""} ${alert.lastName ?? ""}`.trim()
                        : "Unknown"}
                    </p>
                    <p className="text-xs text-foreground/40 font-mono">{alert.userId}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{alert.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-400 border-orange-500/20 font-semibold">
                      {alert.txCount} tx
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/50">{alert.windowHours}h window</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/users/${alert.userId}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-foreground/70 hover:text-foreground transition-colors"
                    >
                      View User
                    </Link>
                  </td>
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

      {data && data.length > 0 && (
        <p className="text-xs text-foreground/30 mt-4 text-center">
          Showing users with {threshold}+ transactions in the last {hours}h
        </p>
      )}
    </div>
  );
}
