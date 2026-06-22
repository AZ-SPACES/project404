"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAiUsageOverview,
  getAiUsageTopUsers,
  setUserAiDisabled,
  resetUserAiQuota,
  type AiUsageOverview,
  type AiUsageUserRow,
} from "@/lib/admin-api";
import { Bot, MessageSquare, ShieldAlert, Users, Ban, Power, RotateCcw, Loader2 } from "lucide-react";

const PERIODS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

// Repeated quota hits or lots of off-finance ("OTHER") questions = possible misuse.
const BLOCKED_ALERT = 3;
const OTHER_ALERT = 10;

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const ENDPOINT_LABELS: Record<string, string> = {
  chat: "Financial assistant",
  insight: "Transfer insights",
  support: "Support bot",
};

const TOPIC_LABELS: Record<string, string> = {
  BALANCE: "Balance",
  SPENDING: "Spending",
  BUDGET: "Budgeting",
  TRANSFER: "Transfers",
  FEES: "Fees",
  ACCOUNT: "Account",
  INSIGHT: "Auto insight",
  SUPPORT: "Support",
  OTHER: "Other / off-topic",
};

function StatCard({
  icon: Icon, label, value, tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: "default" | "warn";
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2 text-foreground/40">
        <Icon size={15} className={tone === "warn" ? "text-yellow-400" : "text-[#B7EE7A]"} />
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${tone === "warn" ? "text-yellow-400" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function BreakdownBars({
  title, rows, labels,
}: {
  title: string;
  rows: { key: string; count: number }[];
  labels: Record<string, string>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-medium text-foreground mb-4">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-foreground/30 text-sm">No data for this period.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const isOther = r.key === "OTHER";
            return (
              <div key={r.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={isOther ? "text-yellow-400" : "text-foreground/70"}>
                    {labels[r.key] ?? r.key}
                  </span>
                  <span className="text-foreground/40">{r.count.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isOther ? "bg-yellow-400" : "bg-[#B7EE7A]"}`}
                    style={{ width: `${Math.round((r.count / max) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DailyChart({ daily }: { daily: { date: string; count: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-medium text-foreground mb-4">Daily volume</h3>
      {daily.length === 0 ? (
        <p className="text-foreground/30 text-sm">No data for this period.</p>
      ) : (
        <div className="flex items-end gap-1 h-32">
          {daily.map((d) => (
            <div key={d.date} className="flex-1 group relative flex flex-col justify-end">
              <div
                className="w-full bg-[#B7EE7A]/70 group-hover:bg-[#B7EE7A] rounded-t transition-colors"
                style={{ height: `${Math.max(2, Math.round((d.count / max) * 100))}%` }}
              />
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-card border border-border rounded px-2 py-1 text-[10px] text-foreground whitespace-nowrap z-10">
                {d.date}: {d.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserActions({ user }: { user: AiUsageUserRow }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ai-usage-users"] });

  const toggle = useMutation({
    mutationFn: () => setUserAiDisabled(user.userId, !user.aiDisabled),
    onSuccess: invalidate,
  });

  const reset = useMutation({
    mutationFn: () => resetUserAiQuota(user.userId),
  });

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={() => reset.mutate()}
        disabled={reset.isPending}
        title="Clear this user's hourly + daily AI quota"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/30 text-foreground/60 border border-border text-xs font-medium hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
      >
        {reset.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
        {reset.isSuccess ? "Reset" : "Reset quota"}
      </button>
      <button
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        title={user.aiDisabled ? "Re-enable the AI assistant for this user" : "Disable the AI assistant for this user"}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium disabled:opacity-40 transition-colors ${
          user.aiDisabled
            ? "bg-[#B7EE7A]/10 text-[#B7EE7A] border-[#B7EE7A]/20 hover:bg-[#B7EE7A]/20"
            : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
        }`}
      >
        {toggle.isPending ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
        {user.aiDisabled ? "Enable AI" : "Disable AI"}
      </button>
    </div>
  );
}

export default function AiUsagePage() {
  const [days, setDays] = useState(30);

  const { data: overview, isLoading, error } = useQuery<AiUsageOverview>({
    queryKey: ["ai-usage-overview", days],
    queryFn: () => getAiUsageOverview(days),
  });

  const { data: users } = useQuery<AiUsageUserRow[]>({
    queryKey: ["ai-usage-users", days],
    queryFn: () => getAiUsageTopUsers(days, 50),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1 flex items-center gap-2">
            <Bot size={22} className="text-[#B7EE7A]" />
            AI Assistant Usage
          </h1>
          <p className="text-foreground/50 text-sm">
            Volume, cost/abuse signals, and what the assistant is used for. Metadata only —
            no chat content is stored.
          </p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                days === p.value
                  ? "bg-[#B7EE7A]/15 text-[#B7EE7A] border-[#B7EE7A]/30"
                  : "bg-muted/30 text-foreground/50 border-border hover:text-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {(error as Error).message}
        </div>
      )}

      {isLoading || !overview ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={MessageSquare} label="Total calls" value={overview.totalCalls.toLocaleString()} />
            <StatCard icon={Users} label="Unique users" value={overview.uniqueUsers.toLocaleString()} />
            <StatCard
              icon={Ban}
              label="Quota-blocked"
              value={overview.blockedCalls.toLocaleString()}
              tone={overview.blockedCalls > 0 ? "warn" : "default"}
            />
            <StatCard
              icon={ShieldAlert}
              label="Off-topic (OTHER)"
              value={(overview.byTopic.find((t) => t.key === "OTHER")?.count ?? 0).toLocaleString()}
              tone={(overview.byTopic.find((t) => t.key === "OTHER")?.count ?? 0) > 0 ? "warn" : "default"}
            />
          </div>

          <div className="mb-6">
            <DailyChart daily={overview.daily} />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <BreakdownBars title="By surface" rows={overview.byEndpoint} labels={ENDPOINT_LABELS} />
            <BreakdownBars title="What it's used for" rows={overview.byTopic} labels={TOPIC_LABELS} />
          </div>
        </>
      )}

      {/* Top users / abuse alerts */}
      <h2 className="text-base font-semibold text-foreground mb-1">Top users</h2>
      <p className="text-foreground/40 text-sm mb-4">
        Rows highlighted amber repeatedly hit their AI quota or asked mostly off-topic questions.
      </p>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/10">
              <th className="text-left px-4 py-3 text-foreground/40 font-medium">User</th>
              <th className="text-right px-4 py-3 text-foreground/40 font-medium">Calls</th>
              <th className="text-right px-4 py-3 text-foreground/40 font-medium">Quota hits</th>
              <th className="text-right px-4 py-3 text-foreground/40 font-medium">Off-topic</th>
              <th className="text-right px-4 py-3 text-foreground/40 font-medium">Last used</th>
              <th className="text-right px-4 py-3 text-foreground/40 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!users || users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-foreground/30">
                  No AI usage in this period.
                </td>
              </tr>
            ) : (
              users.map((u, i) => {
                const flagged = u.blockedCalls >= BLOCKED_ALERT || u.otherTopicCalls >= OTHER_ALERT;
                return (
                  <tr
                    key={u.userId}
                    className={`border-b border-border transition-colors ${
                      flagged ? "bg-yellow-500/5 hover:bg-yellow-500/10" : i % 2 === 0 ? "" : "bg-muted/10"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {flagged && <ShieldAlert size={13} className="text-yellow-400 shrink-0" />}
                        <div>
                          <div className="text-foreground font-medium flex items-center gap-2">
                            {u.name}
                            {u.aiDisabled && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                AI off
                              </span>
                            )}
                          </div>
                          {u.username && <div className="text-foreground/30 text-xs">@{u.username}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground font-semibold">
                      {u.totalCalls.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right ${u.blockedCalls >= BLOCKED_ALERT ? "text-yellow-400 font-semibold" : "text-foreground/40"}`}>
                      {u.blockedCalls}
                    </td>
                    <td className={`px-4 py-3 text-right ${u.otherTopicCalls >= OTHER_ALERT ? "text-yellow-400 font-semibold" : "text-foreground/40"}`}>
                      {u.otherTopicCalls}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground/40 text-xs whitespace-nowrap">
                      {fmt(u.lastUsedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <UserActions user={u} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
