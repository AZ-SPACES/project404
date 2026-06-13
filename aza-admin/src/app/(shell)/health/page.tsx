"use client";

import { useQuery } from "@tanstack/react-query";
import { getHealthMetrics, getCircuitBreakers, type HealthMetrics, type CircuitBreakerStatus } from "@/lib/admin-api";
import { Activity, Database, Cpu, Server, Loader2, RefreshCw, Zap } from "lucide-react";
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

function CircuitBreakersCard() {
  const { data, isLoading } = useQuery<CircuitBreakerStatus[]>({
    queryKey: ["circuitBreakers"],
    queryFn: getCircuitBreakers,
    refetchInterval: 15_000,
  });

  const stateColors: Record<CircuitBreakerStatus["state"], string> = {
    CLOSED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    OPEN: "bg-red-500/10 text-red-400 border-red-500/20",
    HALF_OPEN: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };

  const stateDot: Record<CircuitBreakerStatus["state"], string> = {
    CLOSED: "bg-emerald-400",
    OPEN: "bg-red-400",
    HALF_OPEN: "bg-yellow-400",
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={15} className="text-foreground/40" />
        <h2 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">Circuit Breakers</h2>
      </div>

      {isLoading ? (
        <div className="h-24 bg-muted/20 rounded-lg animate-pulse" />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-foreground/40">No circuit breakers registered</p>
      ) : (
        <div className="space-y-3">
          {data.map((cb) => (
            <div key={cb.name} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex w-2 h-2 rounded-full ${stateDot[cb.state]}`} />
                  <span className="text-sm font-medium text-foreground font-mono">{cb.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${stateColors[cb.state]}`}>
                  {cb.state.replace("_", " ")}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-foreground/50">
                <div>
                  <span className="block text-foreground/30">Failure Rate</span>
                  <span className={`font-medium ${cb.failureRate > 50 ? "text-red-400" : "text-foreground"}`}>
                    {cb.failureRate.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="block text-foreground/30">Slow Call Rate</span>
                  <span className={`font-medium ${cb.slowCallRate > 50 ? "text-yellow-400" : "text-foreground"}`}>
                    {cb.slowCallRate.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="block text-foreground/30">Buffered Calls</span>
                  <span className="font-medium text-foreground">{cb.bufferedCalls}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
        <>
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

        {/* Circuit Breakers */}
        <CircuitBreakersCard />
        </>
      )}
    </div>
  );
}
