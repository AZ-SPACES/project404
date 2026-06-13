"use client";

import { useQuery } from "@tanstack/react-query";
import { getHealthMetrics, type HealthMetrics } from "@/lib/admin-api";
import { Activity, Database, Cpu, Server, Loader2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

function StatusDot({ up }: { up: boolean }) {
  return (
    <span className={`inline-flex w-2.5 h-2.5 rounded-full ${up ? "bg-emerald-400" : "bg-red-400"}`} />
  );
}

function GaugeBar({ value, max, color = "#B7EE7A" }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-foreground/50 text-sm">{label}</span>
      <span className="text-foreground text-sm font-medium font-mono">{value}</span>
    </div>
  );
}

export default function HealthPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, dataUpdatedAt } = useQuery<HealthMetrics>({
    queryKey: ["healthMetrics"],
    queryFn: getHealthMetrics,
    refetchInterval: 15_000,
  });

  const heapColor = !data ? "#B7EE7A"
    : data.jvm.heapUsedPct > 85 ? "#ef4444"
    : data.jvm.heapUsedPct > 65 ? "#f59e0b"
    : "#B7EE7A";

  const dbUp = data?.db.status === "UP";
  const redisUp = data?.redis.status === "UP";

  const dbPoolPct = data ? (data.db.activeConnections / Math.max(data.db.poolMax, 1)) * 100 : 0;
  const dbPoolColor = dbPoolPct > 80 ? "#ef4444" : dbPoolPct > 50 ? "#f59e0b" : "#B7EE7A";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Platform Health</h1>
          <p className="text-foreground/40 text-sm mt-1">
            JVM, database, and Redis metrics — refreshes every 15 seconds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-foreground/30">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["healthMetrics"] })}
            className="p-2 rounded-xl bg-muted/30 hover:bg-muted border border-border text-foreground/50 hover:text-foreground transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-foreground/30" />
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* JVM */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={15} className="text-foreground/40" />
              <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">JVM Memory</h2>
            </div>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-3xl font-semibold text-foreground">{data.jvm.heapUsedPct}%</span>
              <span className="text-foreground/40 text-sm pb-0.5">heap used</span>
            </div>
            <GaugeBar value={data.jvm.heapUsedPct} max={100} color={heapColor} />
            <div className="mt-4 divide-y divide-border">
              <MetricRow label="Heap Used" value={`${data.jvm.heapUsedMb} MB`} />
              <MetricRow label="Heap Total" value={`${data.jvm.heapTotalMb} MB`} />
              <MetricRow label="Heap Max" value={`${data.jvm.heapMaxMb} MB`} />
              <MetricRow label="CPU Cores" value={data.jvm.processors} />
            </div>
          </div>

          {/* DB Pool */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database size={15} className="text-foreground/40" />
                <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">Database</h2>
              </div>
              <StatusDot up={dbUp} />
            </div>
            {dbUp ? (
              <>
                <div className="flex items-end gap-3 mb-3">
                  <span className="text-3xl font-semibold text-foreground">{data.db.activeConnections}</span>
                  <span className="text-foreground/40 text-sm pb-0.5">active connections</span>
                </div>
                <GaugeBar value={dbPoolPct} max={100} color={dbPoolColor} />
                <div className="mt-4 divide-y divide-border">
                  <MetricRow label="Active" value={data.db.activeConnections} />
                  <MetricRow label="Idle" value={data.db.idleConnections} />
                  <MetricRow label="Total" value={data.db.totalConnections} />
                  <MetricRow label="Pool Max" value={data.db.poolMax} />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-red-400 text-sm py-4">
                <Activity size={16} /> Database unreachable
              </div>
            )}
          </div>

          {/* Redis */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Server size={15} className="text-foreground/40" />
                <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">Redis</h2>
              </div>
              <StatusDot up={redisUp} />
            </div>
            {redisUp ? (
              <>
                <div className="flex items-end gap-3 mb-3">
                  <span className="text-3xl font-semibold text-foreground">{data.redis.usedMemoryMb}</span>
                  <span className="text-foreground/40 text-sm pb-0.5">MB used</span>
                </div>
                {data.redis.maxMemoryMb > 0 && (
                  <GaugeBar
                    value={data.redis.usedMemoryMb}
                    max={data.redis.maxMemoryMb}
                    color={data.redis.usedMemoryMb / data.redis.maxMemoryMb > 0.8 ? "#ef4444" : "#B7EE7A"}
                  />
                )}
                <div className="mt-4 divide-y divide-border">
                  <MetricRow label="Used Memory" value={`${data.redis.usedMemoryMb} MB`} />
                  <MetricRow label="Peak Memory" value={`${data.redis.peakMemoryMb} MB`} />
                  <MetricRow label="Max Memory" value={data.redis.maxMemoryMb > 0 ? `${data.redis.maxMemoryMb} MB` : "Unlimited"} />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-red-400 text-sm py-4">
                <Activity size={16} /> Redis unreachable
              </div>
            )}
          </div>

          {/* Threads */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={15} className="text-foreground/40" />
              <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">Threads</h2>
            </div>
            <div className="flex items-end gap-3 mb-4">
              <span className="text-3xl font-semibold text-foreground">{data.threads.active}</span>
              <span className="text-foreground/40 text-sm pb-0.5">active threads</span>
            </div>
            <div className="divide-y divide-border">
              <MetricRow label="Active Threads" value={data.threads.active} />
              <MetricRow label="All Threads" value={data.threads.daemon} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
