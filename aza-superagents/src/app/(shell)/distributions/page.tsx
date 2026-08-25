"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DirectionBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/states";
import { dateTime, ghs } from "@/lib/format";
import {
  getDistributions,
  getSubAgents,
  type Direction,
  type FloatDistribution,
  type SubAgent,
} from "@/lib/superagent-api";

const PAGE_SIZE = 20;

/** Every movement this master has made, filterable by direction and by agent. */
export default function DistributionsPage() {
  const [rows, setRows] = useState<FloatDistribution[]>([]);
  const [agents, setAgents] = useState<SubAgent[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [direction, setDirection] = useState<Direction | "">("");
  const [subAgentId, setSubAgentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSubAgents().then(setAgents).catch(() => setAgents([]));
  }, []);

  // The effect only kicks off the request; every setState it causes happens in a callback, so
  // a filter change never cascades a render before the data it asked for exists.
  const load = useCallback(() => {
    let cancelled = false;
    getDistributions({
      page,
      size: PAGE_SIZE,
      direction: direction || undefined,
      subAgentId: subAgentId || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.content ?? []);
        setTotalPages(res.totalPages ?? 0);
        setTotalElements(res.totalElements ?? 0);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, direction, subAgentId]);

  useEffect(load, [load]);

  /** Any filter change invalidates the current page number, so go back to the first. */
  function filter(next: () => void) {
    setLoading(true);
    setPage(0);
    next();
  }

  function goToPage(next: number) {
    setLoading(true);
    setPage(next);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every movement of float between you and your agents.
        </p>
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <Card>
        <CardHeader
          title={
            loading
              ? "Movements"
              : `${totalElements} movement${totalElements === 1 ? "" : "s"}`
          }
          action={
            <div className="flex gap-2">
              <Select
                aria-label="Filter by direction"
                className="h-8 w-36 text-xs"
                value={direction}
                onChange={(e) => filter(() => setDirection(e.target.value as Direction | ""))}
              >
                <option value="">All directions</option>
                <option value="DISTRIBUTE">Sent down</option>
                <option value="RECALL">Recalled</option>
              </Select>
              <Select
                aria-label="Filter by agent"
                className="h-8 w-44 text-xs"
                value={subAgentId}
                onChange={(e) => filter(() => setSubAgentId(e.target.value))}
              >
                <option value="">All agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.userName ?? a.businessName ?? a.code}
                  </option>
                ))}
              </Select>
            </div>
          }
        />

        {loading ? (
          <CardBody className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardBody>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description={
              direction || subAgentId
                ? "No movements match those filters."
                : "Float movements appear here as you make them."
            }
            icon={ArrowLeftRight}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 font-medium">Agent</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Direction</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Amount</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Note</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-secondary/30">
                    <td className="px-5 py-3">
                      <p className="font-medium">{d.subAgentName ?? "Agent"}</p>
                      <p className="tnum text-xs text-muted-foreground">{d.subAgentCode ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      <DirectionBadge direction={d.direction} />
                    </td>
                    <td className="tnum px-5 py-3 text-right font-semibold">{ghs(d.amount)}</td>
                    <td className="max-w-xs px-5 py-3 text-muted-foreground">
                      <span className="line-clamp-1">{d.note || "—"}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                      {dateTime(d.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => goToPage(Math.max(0, page - 1))}
              >
                <ChevronLeft aria-hidden />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Next
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
