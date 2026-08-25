"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/states";
import { Stat } from "@/components/stat";
import { cn } from "@/lib/utils";
import { ghs } from "@/lib/format";
import { getReconciliation, type Reconciliation } from "@/lib/superagent-api";

/**
 * Where the float sits, against what was sent.
 *
 * The variance column is the point of the page, and it is not an error report: an agent who has
 * been trading spends float on cash-in and takes it back on cash-out, so a non-zero variance is
 * the normal state of a working till. What it flags is the shape of the gap — a deeply negative
 * agent has turned float into cash they are holding, and a positive one is sitting on float
 * someone should probably recall.
 */
export default function ReconciliationPage() {
  const [data, setData] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReconciliation()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reconciliation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Float held across your network, against what you sent.
        </p>
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Your float" value={ghs(data?.masterFloat)} loading={loading} emphasis />
        <Stat label="Held by agents" value={ghs(data?.downlineFloat)} loading={loading} />
        <Stat
          label="Net sent down"
          value={ghs(data?.netDistributed)}
          sub="Lifetime, less recalls"
          loading={loading}
        />
        <Stat
          label="Variance"
          value={ghs(data?.variance)}
          sub="Held, less sent"
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader
          title="By agent"
          description="Trading moves float in and out of a till, so a gap here is expected — its size and direction are what to read."
        />

        {loading ? (
          <CardBody className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardBody>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            title="Nothing to reconcile"
            description="Once you have agents holding float, their positions appear here."
            icon={Scale}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 font-medium">Agent</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Held</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Net sent</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((r) => (
                  <tr key={r.subAgentId} className="hover:bg-secondary/30">
                    <td className="px-5 py-3">
                      <Link
                        href={`/agents/${r.subAgentId}`}
                        className="font-medium hover:text-primary"
                      >
                        {r.userName ?? "Agent"}
                      </Link>
                      <p className="tnum text-xs text-muted-foreground">{r.code ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="tnum px-5 py-3 text-right font-semibold">{ghs(r.heldFloat)}</td>
                    <td className="tnum px-5 py-3 text-right text-muted-foreground">
                      {ghs(r.netDistributed)}
                    </td>
                    <td
                      className={cn(
                        "tnum px-5 py-3 text-right font-medium",
                        r.variance < 0 ? "text-warning" : "text-muted-foreground"
                      )}
                    >
                      {r.variance > 0 ? "+" : ""}
                      {ghs(r.variance)}
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
