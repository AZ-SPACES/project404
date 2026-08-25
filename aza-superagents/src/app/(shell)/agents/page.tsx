"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { ghs } from "@/lib/format";
import { getSubAgents, type AgentStatus, type SubAgent } from "@/lib/superagent-api";

const FILTERS: { label: string; value: AgentStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Pending", value: "PENDING" },
  { label: "Suspended", value: "SUSPENDED" },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<SubAgent[]>([]);
  const [status, setStatus] = useState<AgentStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSubAgents()
      .then(setAgents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Filtering client-side: a single master's downline is small enough that a round trip per
  // keystroke would be slower than the filter itself.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (status !== "ALL" && a.status !== status) return false;
      if (!q) return true;
      return [a.userName, a.businessName, a.code, a.location, a.userPhone]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q));
    });
  }, [agents, status, query]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone drawing float from you.
          </p>
        </div>
        <Link href="/agents/invite" className={buttonClasses()}>
          <UserPlus aria-hidden />
          Add an agent
        </Link>
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <Card>
        <CardHeader
          title={`${shown.length} agent${shown.length === 1 ? "" : "s"}`}
          action={
            <div className="relative w-56">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                aria-label="Search agents"
                className="h-8 pl-8 text-xs"
                placeholder="Name, code or place"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          }
        />

        <div className="flex gap-1 border-b border-border px-5 py-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              aria-pressed={status === f.value}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                status === f.value
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <CardBody className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardBody>
        ) : shown.length === 0 ? (
          <EmptyState
            title={agents.length === 0 ? "No agents yet" : "Nothing matches"}
            description={
              agents.length === 0
                ? "Add an agent to start distributing float down your network."
                : "Try a different search or filter."
            }
            icon={Users}
            action={
              agents.length === 0 ? (
                <Link href="/agents/invite" className={buttonClasses({ size: "sm" })}>
                  Add an agent
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 font-medium">Agent</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Location</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Float held</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Net received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((a) => (
                  <tr key={a.id} className="hover:bg-secondary/30">
                    <td className="px-5 py-3">
                      <Link href={`/agents/${a.id}`} className="font-medium hover:text-primary">
                        {a.userName ?? a.businessName ?? "Agent"}
                      </Link>
                      <p className="tnum text-xs text-muted-foreground">{a.code ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{a.location || "—"}</td>
                    <td className="tnum px-5 py-3 text-right font-semibold">{ghs(a.floatBalance)}</td>
                    <td className="tnum px-5 py-3 text-right text-muted-foreground">
                      {ghs(a.netFloatReceived)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
