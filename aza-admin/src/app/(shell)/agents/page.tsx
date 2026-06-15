"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveAgent,
  getAgents,
  rejectAgent,
  suspendAgent,
  type AgentRecord,
  type Page,
} from "@/lib/admin-api";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Store,
  X,
  Ban,
} from "lucide-react";

const STATUS_TABS = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"] as const;

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ACTIVE: "bg-green-500/10 text-green-400 border-green-500/20",
  SUSPENDED: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
};

const GHS = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("PENDING");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const { data, isLoading } = useQuery<Page<AgentRecord>>({
    queryKey: ["agents", status, page],
    queryFn: () => getAgents(status, page, 20),
  });

  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: "approve" | "reject" | "suspend" }): Promise<unknown> =>
      kind === "approve" ? approveAgent(id) : kind === "reject" ? rejectAgent(id) : suspendAgent(id),
    onMutate: ({ id, kind }) => {
      setError("");
      setNotice("");
      setActing(`${id}:${kind}`);
    },
    onSettled: () => setActing(null),
    onSuccess: (_res, { kind }) => {
      if (kind === "approve") {
        // Maker-checker: approval is queued, not applied — a second COMPLIANCE/ADMIN must confirm.
        setNotice("Activation submitted for approval. A second compliance/admin officer must confirm it in Approvals.");
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Agents</h1>
        <p className="text-foreground/50 text-sm">
          Review applications to become a cash agent. Activation needs a second pair of eyes; rejection and
          suspension take effect immediately.
        </p>
      </div>

      <div className="flex gap-1 mb-6 rounded-lg border border-border p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setStatus(tab);
              setPage(0);
            }}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              status === tab ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-green-400 text-sm mb-6">
          {notice}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.content.length === 0 ? (
        <div className="text-center py-24 text-foreground/30">
          <Store size={40} className="mx-auto mb-4 opacity-40" />
          <p>No {status.toLowerCase()} agents</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {data.content.map((agent) => (
            <div key={agent.id} className="px-5 py-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center text-foreground/50 text-sm font-medium shrink-0">
                {(agent.userName ?? agent.userEmail ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{agent.userName ?? "—"}</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLES[agent.status]}`}
                  >
                    {agent.status}
                  </span>
                  {agent.code && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted/50 text-foreground/60">
                      {agent.code}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/60 truncate">
                  {agent.userEmail ?? "—"}
                  {agent.userPhone && <span className="text-foreground/40"> · {agent.userPhone}</span>}
                </p>
                <div className="flex items-center gap-3 text-xs text-foreground/40 mt-1 flex-wrap">
                  {agent.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} /> {agent.location}
                    </span>
                  )}
                  <span>Tier {agent.tier}</span>
                  <span>Float {GHS.format(agent.floatBalance ?? 0)}</span>
                  {agent.commissionAccruedGhs > 0 && (
                    <span>Commission {GHS.format(agent.commissionAccruedGhs)}</span>
                  )}
                  <span>Applied {fmt(agent.createdAt)}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {agent.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => action.mutate({ id: agent.id, kind: "approve" })}
                      disabled={action.isPending}
                      title="Submit for activation (needs a second approver)"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium hover:bg-green-500/20 disabled:opacity-30 transition-colors"
                    >
                      {acting === `${agent.id}:approve` ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => action.mutate({ id: agent.id, kind: "reject" })}
                      disabled={action.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 disabled:opacity-30 transition-colors"
                    >
                      {acting === `${agent.id}:reject` ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <X size={12} />
                      )}
                      Reject
                    </button>
                  </>
                )}
                {agent.status === "ACTIVE" && (
                  <button
                    onClick={() => action.mutate({ id: agent.id, kind: "suspend" })}
                    disabled={action.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-medium hover:bg-orange-500/20 disabled:opacity-30 transition-colors"
                  >
                    {acting === `${agent.id}:suspend` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Ban size={12} />
                    )}
                    Suspend
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-foreground/50 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>
            Page {page + 1} of {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages - 1, p + 1))}
            disabled={page >= data.totalPages - 1 || isLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
