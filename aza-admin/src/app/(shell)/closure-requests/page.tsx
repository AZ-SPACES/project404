"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveClosureRequest,
  getClosureRequests,
  getClosureStats,
  rejectClosureRequest,
  type ClosureRequest,
  type Page,
} from "@/lib/admin-api";
import { CheckCircle2, Loader2, UserX, XCircle } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: ClosureRequest["status"] }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status]}`}>{status}</span>
  );
}

export default function ClosureRequestsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);

  const { data: stats } = useQuery<{ pending: number; approved: number; rejected: number }>({
    queryKey: ["closure-stats"],
    queryFn: getClosureStats,
  });

  const { data, isLoading } = useQuery<Page<ClosureRequest>>({
    queryKey: ["closure-requests", filter, page],
    queryFn: () => getClosureRequests(filter || undefined, page, 20),
  });

  const approve = useMutation({
    mutationFn: ({ id }: { id: string }) => approveClosureRequest(id, notes[id]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["closure-requests"] });
      qc.invalidateQueries({ queryKey: ["closure-stats"] });
    },
  });

  const reject = useMutation({
    mutationFn: ({ id }: { id: string }) => rejectClosureRequest(id, notes[id] ?? ""),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["closure-requests"] });
      qc.invalidateQueries({ queryKey: ["closure-stats"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Account Closure Requests</h1>
        <p className="text-sm text-foreground/50 mt-0.5">
          Review and process user requests to permanently close their accounts
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending", value: stats.pending, color: "text-yellow-400" },
            { label: "Approved", value: stats.approved, color: "text-emerald-400" },
            { label: "Rejected", value: stats.rejected, color: "text-red-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-border p-4">
              <p className="text-xs text-foreground/50">{label}</p>
              <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {["", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(0); }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filter === s
                ? "bg-foreground/10 border-foreground/20 text-foreground"
                : "border-border text-foreground/50 hover:text-foreground"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={18} className="animate-spin text-foreground/40" />
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.content ?? []).map((req) => (
            <div key={req.id} className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <UserX size={15} className="text-foreground/40 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground font-mono">{req.userId}</p>
                    <p className="text-xs text-foreground/50">Requested {fmt(req.requestedAt)}</p>
                  </div>
                </div>
                <StatusBadge status={req.status} />
              </div>

              <div className="bg-foreground/[0.03] rounded-lg px-3 py-2 text-sm text-foreground/70">
                {req.reason}
              </div>

              {req.notes && (
                <p className="text-xs text-foreground/50">
                  <span className="font-medium">Notes:</span> {req.notes}
                </p>
              )}

              {req.status === "PENDING" && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Internal notes (optional)"
                    value={notes[req.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    className="flex-1 text-xs bg-foreground/5 border border-border rounded-lg px-3 py-1.5 text-foreground placeholder-foreground/30 outline-none"
                  />
                  <button
                    onClick={() => approve.mutate({ id: req.id })}
                    disabled={approve.isPending}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} />
                    Approve
                  </button>
                  <button
                    onClick={() => reject.mutate({ id: req.id })}
                    disabled={reject.isPending}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <XCircle size={12} />
                    Reject
                  </button>
                </div>
              )}

              {req.processedBy && (
                <p className="text-xs text-foreground/40">
                  Processed by {req.processedBy}
                  {req.processedAt ? ` on ${fmt(req.processedAt)}` : ""}
                </p>
              )}
            </div>
          ))}
          {(data?.content ?? []).length === 0 && (
            <div className="rounded-xl border border-border py-12 text-center text-sm text-foreground/40">
              No closure requests found.
            </div>
          )}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground/50 hover:text-foreground disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-foreground/40 self-center">
            {page + 1} / {data.totalPages}
          </span>
          <button
            disabled={page + 1 >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground/50 hover:text-foreground disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
