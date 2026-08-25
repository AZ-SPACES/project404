"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Send, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DirectionBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/states";
import { Stat } from "@/components/stat";
import { ghs, relative } from "@/lib/format";
import {
  getDistributions,
  getSubAgents,
  getSummary,
  type FloatDistribution,
  type SubAgent,
  type SuperAgentSummary,
} from "@/lib/superagent-api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<SuperAgentSummary | null>(null);
  const [recent, setRecent] = useState<FloatDistribution[]>([]);
  const [lowFloat, setLowFloat] = useState<SubAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSummary(), getDistributions({ size: 6 }), getSubAgents("ACTIVE")])
      .then(([s, ledger, agents]) => {
        if (cancelled) return;
        setSummary(s);
        setRecent(ledger.content ?? []);
        // "Running dry" is relative to the agent's own ceiling where they have one, and a flat
        // GHS 200 where they don't — either way it is the list worth acting on this morning.
        setLowFloat(
          [...agents]
            .filter((a) => a.floatBalance < (a.floatLimit ? a.floatLimit * 0.2 : 200))
            .sort((a, b) => a.floatBalance - b.floatBalance)
            .slice(0, 5)
        );
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your float, and where it is across the network.
          </p>
        </div>
        <Link href="/distribute" className={buttonClasses()}>
          <Send aria-hidden />
          Move float
        </Link>
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Available float"
          value={ghs(summary?.floatBalance)}
          sub="Yours to distribute"
          emphasis
          loading={loading}
        />
        <Stat
          label="Out in the network"
          value={ghs(summary?.downlineFloat)}
          sub={`Across ${summary?.subAgentsActive ?? 0} active agents`}
          loading={loading}
        />
        <Stat label="Sent today" value={ghs(summary?.distributedToday)} loading={loading} />
        <Stat
          label="Sent this month"
          value={ghs(summary?.distributedThirtyDays)}
          sub={
            summary && summary.recalledThirtyDays > 0
              ? `${ghs(summary.recalledThirtyDays)} recalled`
              : undefined
          }
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Recent movements"
            description="The last few times float changed hands."
            action={
              <Link
                href="/distributions"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Full ledger
                <ArrowUpRight className="size-3" aria-hidden />
              </Link>
            }
          />
          {loading ? (
            <CardBody className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </CardBody>
          ) : recent.length === 0 ? (
            <EmptyState
              title="No float has moved yet"
              description="Once you send float to an agent it shows up here."
              icon={Send}
              action={
                <Link href="/distribute" className={buttonClasses({ size: "sm" })}>
                  Move float
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {d.subAgentName ?? d.subAgentCode ?? "Agent"}
                    </p>
                    <p className="text-xs text-muted-foreground">{relative(d.createdAt)}</p>
                  </div>
                  <DirectionBadge direction={d.direction} />
                  <p className="tnum w-28 text-right text-sm font-semibold">{ghs(d.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Running low"
            description="Agents close to the bottom of their float."
          />
          {loading ? (
            <CardBody className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </CardBody>
          ) : lowFloat.length === 0 ? (
            <EmptyState
              title="Everyone's stocked"
              description="No agent in your network is close to running out."
              icon={Users}
            />
          ) : (
            <ul className="divide-y divide-border">
              {lowFloat.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/agents/${a.id}`}
                      className="truncate text-sm font-medium hover:text-primary"
                    >
                      {a.userName ?? a.businessName ?? "Agent"}
                    </Link>
                    <p className="tnum text-xs text-muted-foreground">{a.code ?? "—"}</p>
                  </div>
                  <Link
                    href={`/distribute?agent=${a.id}`}
                    className="tnum text-sm font-semibold text-warning hover:underline"
                    aria-label={`Top up ${a.userName ?? a.businessName ?? "agent"}`}
                  >
                    {ghs(a.floatBalance)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Active agents"
          value={summary?.subAgentsActive ?? 0}
          loading={loading}
        />
        <Stat
          label="Awaiting approval"
          value={summary?.subAgentsPending ?? 0}
          sub="Approved by AZA compliance"
          loading={loading}
        />
        <Stat
          label="Downline commission"
          value={ghs(summary?.downlineCommissionAccrued)}
          sub="Owed by AZA, not by you"
          loading={loading}
        />
      </div>
    </div>
  );
}
