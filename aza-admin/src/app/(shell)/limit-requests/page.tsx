"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  getLimitRequests,
  getLimitRequestStats,
  approveLimitRequest,
  denyLimitRequest,
  LimitRequest,
  LimitRequestStats,
  Page,
} from "@/lib/admin-api";
import { TrendingUp, Loader2, CheckCircle2, XCircle, Clock, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

type Filter = "PENDING" | "APPROVED" | "DENIED" | "ALL";

function fmtGhs(n: number) {
  return `GHS ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_MAP = {
  PENDING:  { label: "Pending",  cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  APPROVED: { label: "Approved", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  DENIED:   { label: "Denied",   cls: "text-red-400 bg-red-500/10 border-red-500/20" },
};

function StatusBadge({ status }: { status: LimitRequest["status"] }) {
  const cfg = STATUS_MAP[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

function ReviewModal({
  req,
  action,
  onClose,
  onDone,
}: {
  req: LimitRequest;
  action: "approve" | "deny";
  onClose: () => void;
  onDone: (updated: LimitRequest) => void;
}) {
  const [notes, setNotes] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      action === "approve" ? approveLimitRequest(req.id, notes) : denyLimitRequest(req.id, notes),
    onSuccess: (updated) => onDone(updated),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-white font-semibold capitalize">{action} limit request</h3>

        <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">User</span>
            <Link href={`/users/${req.userId}`} className="text-[#B7EE7A] hover:underline font-mono text-xs">{req.userId.slice(0, 8)}…</Link>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Daily: current → requested</span>
            <span className="text-white">{fmtGhs(req.currentDailyLimitGhs)} → <strong>{fmtGhs(req.requestedDailyLimitGhs)}</strong></span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Single: current → requested</span>
            <span className="text-white">{fmtGhs(req.currentSingleTransactionLimitGhs)} → <strong>{fmtGhs(req.requestedSingleTransactionLimitGhs)}</strong></span>
          </div>
          {req.reason && (
            <div className="pt-2 border-t border-white/5">
              <p className="text-white/40 text-xs mb-1">User's reason</p>
              <p className="text-white/80">{req.reason}</p>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-white/40 mb-1 block">
            Notes {action === "deny" ? "(shown to user)" : "(internal)"}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={action === "deny" ? "Reason for denial shown to user…" : "Internal notes…"}
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none resize-none"
          />
        </div>

        {mutation.error && (
          <p className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={14} /> {(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${
              action === "approve"
                ? "bg-[#B7EE7A] text-black hover:bg-[#B7EE7A]/90"
                : "bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25"
            }`}
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {action === "approve" ? "Approve & notify user" : "Deny & notify user"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:text-white">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LimitRequestsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<{ req: LimitRequest; action: "approve" | "deny" } | null>(null);

  const { data: stats } = useQuery<LimitRequestStats>({
    queryKey: ["limitRequestStats"],
    queryFn: getLimitRequestStats,
  });

  const { data, isLoading, error } = useQuery<Page<LimitRequest>>({
    queryKey: ["limitRequests", { filter, page }],
    queryFn: () => getLimitRequests(page, 20, filter === "ALL" ? undefined : filter),
  });

  function handleDone(updated: LimitRequest) {
    queryClient.setQueryData<Page<LimitRequest>>(["limitRequests", { filter, page }], (prev) =>
      prev ? { ...prev, content: prev.content.map((r) => (r.id === updated.id ? updated : r)) } : prev
    );
    queryClient.invalidateQueries({ queryKey: ["limitRequestStats"] });
    setModal(null);
  }

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: "PENDING",  label: "Pending",  count: stats?.pending },
    { key: "APPROVED", label: "Approved", count: stats?.approved },
    { key: "DENIED",   label: "Denied",   count: stats?.denied },
    { key: "ALL",      label: "All" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Limit Increase Requests</h1>
        <p className="text-white/40 text-sm mt-0.5">Review and action user-submitted requests to raise transaction limits</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending", value: stats?.pending ?? 0, color: "text-amber-400", icon: Clock },
          { label: "Approved", value: stats?.approved ?? 0, color: "text-emerald-400", icon: CheckCircle2 },
          { label: "Denied", value: stats?.denied ?? 0, color: "text-red-400", icon: XCircle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[#161616] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className={color} />
              <p className="text-white/40 text-xs font-medium">{label}</p>
            </div>
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setPage(0); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              filter === key ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                filter === key ? "bg-white/15 text-white" : "bg-white/8 text-white/50"
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-white/30" size={24} />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-6 py-8 text-red-400 text-sm">
            <AlertCircle size={16} />{(error as Error).message}
          </div>
        ) : !data?.content.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/20">
            <TrendingUp size={32} className="mb-3" />
            <p className="text-sm">No {filter.toLowerCase()} requests</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["User", "Current limits", "Requested limits", "Reason", "Submitted", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-white/30 text-xs font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.content.map((req) => (
                <tr key={req.id} className="border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/users/${req.userId}`} className="font-mono text-xs text-[#B7EE7A] hover:underline">
                      {req.userId.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-white/70 text-xs">{fmtGhs(req.currentDailyLimitGhs)} / day</p>
                    <p className="text-white/40 text-xs">{fmtGhs(req.currentSingleTransactionLimitGhs)} / tx</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-white text-xs font-semibold">{fmtGhs(req.requestedDailyLimitGhs)} / day</p>
                    <p className="text-white/60 text-xs">{fmtGhs(req.requestedSingleTransactionLimitGhs)} / tx</p>
                  </td>
                  <td className="px-5 py-4 max-w-xs">
                    <p className="text-white/60 text-xs truncate">{req.reason ?? "—"}</p>
                  </td>
                  <td className="px-5 py-4 text-white/40 text-xs whitespace-nowrap">{fmtDate(req.createdAt)}</td>
                  <td className="px-5 py-4"><StatusBadge status={req.status} /></td>
                  <td className="px-5 py-4">
                    {req.status === "PENDING" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setModal({ req, action: "approve" })}
                          className="px-3 py-1.5 rounded-lg bg-[#B7EE7A]/10 text-[#B7EE7A] border border-[#B7EE7A]/20 text-xs font-medium hover:bg-[#B7EE7A]/20 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setModal({ req, action: "deny" })}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    )}
                    {req.status !== "PENDING" && req.adminNotes && (
                      <p className="text-white/30 text-xs max-w-[160px] truncate" title={req.adminNotes}>{req.adminNotes}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-white/40">
          <span>{data.totalElements} total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-white/60">Page {page + 1} of {data.totalPages}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {modal && (
        <ReviewModal
          req={modal.req}
          action={modal.action}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
