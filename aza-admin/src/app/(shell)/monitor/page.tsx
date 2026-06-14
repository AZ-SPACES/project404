"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLiveTransactions, type AdminTransaction, type Page } from "@/lib/admin-api";
import {
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  AlertCircle,
  Pause,
  Play,
} from "lucide-react";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtAmount(amount: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    currencyDisplay: "symbol",
  })
    .format(amount)
    .replace("GHS", "GH₵");
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
  HELD_FOR_REVIEW: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  REVERSED: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  CANCELLED: "bg-foreground/5 text-foreground/30 border-border",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-foreground/5 text-foreground/30 border-border";
  return (
    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function isSendType(type: string): boolean {
  return ["TRANSFER", "SEND", "PAYMENT", "MERCHANT_PAYMENT", "WITHDRAWAL"].some((t) =>
    type.toUpperCase().includes(t)
  );
}

export default function MonitorPage() {
  const [active, setActive] = useState(true);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, error, dataUpdatedAt } = useQuery<Page<AdminTransaction>>({
    queryKey: ["liveTransactions"],
    queryFn: () => getLiveTransactions(0, 30),
    refetchInterval: active ? 5000 : false,
  });

  // Track which ids are new since last fetch
  useEffect(() => {
    if (!data) return;
    const currentIds = new Set(data.content.map((t) => t.id));
    const fresh = new Set<string>();
    currentIds.forEach((id) => {
      if (!prevIdsRef.current.has(id)) fresh.add(id);
    });
    if (fresh.size > 0) {
      setNewIds(fresh);
      setTimeout(() => setNewIds(new Set()), 2000);
    }
    prevIdsRef.current = currentIds;
  }, [data]);

  // Tick counter
  useEffect(() => {
    setSecondsSinceUpdate(0);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setSecondsSinceUpdate((s) => s + 1);
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [dataUpdatedAt]);

  const transactions = data?.content ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Activity size={22} className="text-foreground/40" />
            Live Monitor
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-semibold ${
              active
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-foreground/5 text-foreground/30 border-border"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                active ? "bg-emerald-400 animate-pulse" : "bg-foreground/30"
              }`}
            />
            {active ? "Live" : "Paused"}
          </span>
        </div>
        <button
          onClick={() => setActive((a) => !a)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/30 border border-border text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
        >
          {active ? <Pause size={14} /> : <Play size={14} />}
          {active ? "Pause" : "Resume"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{(error as Error).message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-foreground/30" size={24} />
        </div>
      )}

      {/* Feed */}
      {!isLoading && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {transactions.length === 0 ? (
            <div className="text-center py-20 text-foreground/25">
              <Activity size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No transactions yet — waiting for activity...</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((tx) => {
                const isNew = newIds.has(tx.id);
                const isSend = isSendType(tx.type);
                const timeField = tx.initiatedAt ?? tx.completedAt ?? tx.cancelledAt;
                return (
                  <div
                    key={tx.id}
                    className={`flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-all ${
                      isNew ? "border-l-2 border-emerald-400 bg-emerald-500/5" : ""
                    }`}
                  >
                    {/* Time */}
                    <div className="w-16 flex-shrink-0">
                      <p className="text-[11px] text-foreground/30 tabular-nums">
                        {timeField ? timeAgo(timeField) : "—"}
                      </p>
                    </div>

                    {/* Direction icon */}
                    <div className="flex-shrink-0">
                      {isSend ? (
                        <ArrowUpRight size={16} className="text-amber-400" />
                      ) : (
                        <ArrowDownLeft size={16} className="text-emerald-400" />
                      )}
                    </div>

                    {/* From → To */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        <span className="font-medium">{tx.senderName}</span>
                        <span className="text-foreground/30 mx-1.5">→</span>
                        <span className="font-medium">{tx.recipientName}</span>
                      </p>
                      <p className="text-[11px] text-foreground/30 truncate">
                        {tx.type.replace(/_/g, " ")}
                        {tx.note ? ` · ${tx.note}` : ""}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground">{fmtAmount(tx.amount)}</p>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0 w-32 text-right">
                      <StatusBadge status={tx.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Last updated */}
      {!isLoading && data && (
        <p className="text-xs text-foreground/25 text-center">
          Last updated {secondsSinceUpdate === 0 ? "just now" : `${secondsSinceUpdate}s ago`}
          {active && " · refreshes every 5s"}
        </p>
      )}
    </div>
  );
}
