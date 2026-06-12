"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveRequest,
  getApprovals,
  getStoredUser,
  rejectRequest,
  type Approval,
  type Page,
} from "@/lib/admin-api";
import { Check, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, X } from "lucide-react";

const STATUS_TABS = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"] as const;

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  APPROVED: "bg-green-500/10 text-green-400 border-green-500/20",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  EXPIRED: "bg-muted/50 text-foreground/50 border-border",
};

const ACTION_LABELS: Record<string, string> = {
  REVERSE_TRANSACTION: "Transaction Reversal",
  UPDATE_FEE_RULE: "Fee Rule Change",
  UPDATE_USER_LIMITS: "User Limit Change",
  GRANT_STAFF_ROLE: "Staff Role Grant",
  CHANGE_STAFF_ROLE: "Staff Role Change",
  UPDATE_SYSTEM_SETTINGS: "System Settings Change",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("PENDING");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const me = getStoredUser();

  const { data, isLoading } = useQuery<Page<Approval>>({
    queryKey: ["approvals", status, page],
    queryFn: () => getApprovals(status, page, 20),
  });

  const review = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? approveRequest(id) : rejectRequest(id),
    onMutate: ({ id, approve }) => {
      setError("");
      setActing(`${id}:${approve}`);
    },
    onSettled: () => setActing(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals"] }),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Approvals</h1>
        <p className="text-foreground/50 text-sm">
          Sensitive actions need a second pair of eyes. You can&apos;t approve your own requests.
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

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.content.length === 0 ? (
        <div className="text-center py-24 text-foreground/30">
          <ClipboardCheck size={40} className="mx-auto mb-4 opacity-40" />
          <p>No {status.toLowerCase()} requests</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {data.content.map((approval) => {
            const mine = me?.email === approval.requestedByEmail;
            return (
              <div key={approval.id} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {ACTION_LABELS[approval.actionType] ?? approval.actionType}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLES[approval.status]}`}
                    >
                      {approval.status}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/60">{approval.summary}</p>
                  <p className="text-xs text-foreground/40 mt-1">
                    Requested by {approval.requestedByEmail} · {fmt(approval.requestedAt)}
                    {approval.reviewedByEmail && (
                      <> · Reviewed by {approval.reviewedByEmail} · {fmt(approval.reviewedAt)}</>
                    )}
                  </p>
                  {approval.reviewNotes && (
                    <p className="text-xs text-foreground/40 mt-1 italic">“{approval.reviewNotes}”</p>
                  )}
                </div>
                {approval.status === "PENDING" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => review.mutate({ id: approval.id, approve: true })}
                      disabled={mine || review.isPending}
                      title={mine ? "You cannot approve your own request" : "Approve and execute"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium hover:bg-green-500/20 disabled:opacity-30 transition-colors"
                    >
                      {acting === `${approval.id}:true` ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => review.mutate({ id: approval.id, approve: false })}
                      disabled={review.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 disabled:opacity-30 transition-colors"
                    >
                      {acting === `${approval.id}:false` ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <X size={12} />
                      )}
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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
