"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DirectionBadge, StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/states";
import { Stat } from "@/components/stat";
import { dateTime, ghs } from "@/lib/format";
import {
  getDistributions,
  getSubAgent,
  type FloatDistribution,
  type SubAgent,
} from "@/lib/superagent-api";

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [agent, setAgent] = useState<SubAgent | null>(null);
  const [history, setHistory] = useState<FloatDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([getSubAgent(id), getDistributions({ subAgentId: id, size: 25 })])
      .then(([a, ledger]) => {
        if (cancelled) return;
        setAgent(a);
        setHistory(ledger.content ?? []);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <BackLink />
        <ErrorNote message={error ?? "That agent isn't in your network."} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {agent.userName ?? agent.businessName ?? "Agent"}
            </h1>
            <StatusBadge status={agent.status} />
          </div>
          <p className="tnum mt-1 text-sm text-muted-foreground">
            {agent.code ?? "No till code yet"}
            {agent.location ? ` · ${agent.location}` : ""}
          </p>
        </div>
        {agent.status === "ACTIVE" ? (
          <Link href={`/distribute?agent=${agent.id}`} className={buttonClasses()}>
            <Send aria-hidden />
            Move float
          </Link>
        ) : null}
      </div>

      {agent.status === "PENDING" ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          This agent is waiting on approval from AZA compliance. Float can&apos;t move to them
          until they&apos;re active.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Float held" value={ghs(agent.floatBalance)} emphasis />
        <Stat
          label="Net received from you"
          value={ghs(agent.netFloatReceived)}
          sub="Sent down, less recalled"
        />
        <Stat
          label="Commission accrued"
          value={ghs(agent.commissionAccruedGhs)}
          sub="Owed by AZA, not by you"
        />
      </div>

      <Card>
        <CardHeader title="Business" />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Business name" value={agent.businessName} />
            <Detail label="Phone" value={agent.userPhone} />
            <Detail label="Location" value={agent.location} />
            <Detail label="Float limit" value={agent.floatLimit ? ghs(agent.floatLimit) : "None set"} />
            <Detail label="Joined your network" value={dateTime(agent.createdAt)} />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Float history" description="Movements between you and this agent." />
        {history.length === 0 ? (
          <EmptyState
            title="No movements yet"
            description="Float you send to this agent will show up here."
            icon={Send}
          />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{d.note || "—"}</p>
                  <p className="text-xs text-muted-foreground">{dateTime(d.createdAt)}</p>
                </div>
                <DirectionBadge direction={d.direction} />
                <p className="tnum w-28 text-right text-sm font-semibold">{ghs(d.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/agents"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      All agents
    </Link>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}
