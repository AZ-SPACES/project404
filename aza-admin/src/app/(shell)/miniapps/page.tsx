"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMiniAppReports,
  getMiniAppReportStats,
  resolveMiniAppReport,
  MiniAppReport,
  MiniAppReportStats,
  Page,
} from "@/lib/admin-api";
import { Flag, CheckCircle2, XCircle, Clock, Loader2, X } from "lucide-react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

const REASON_LABELS: Record<string, string> = {
  SPAM:          "Spam",
  INAPPROPRIATE: "Inappropriate",
  NOT_WORKING:   "Not Working",
  MISLEADING:    "Misleading",
  OTHER:         "Other",
};

const STATUS_MAP = {
  OPEN:      { label: "Open",      cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  RESOLVED:  { label: "Resolved",  cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  DISMISSED: { label: "Dismissed", cls: "text-white/30 bg-white/5 border-white/10" },
};

function StatusBadge({ status }: { status: MiniAppReport["status"] }) {
  const cfg = STATUS_MAP[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

type FilterStatus = "ALL" | "OPEN" | "RESOLVED" | "DISMISSED";

export default function MiniAppsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>("OPEN");
  const [page, setPage] = useState(0);
  const [resolving, setResolving] = useState<MiniAppReport | null>(null);
  const [resolution, setResolution] = useState("");

  const { data: stats } = useQuery<MiniAppReportStats>({
    queryKey: ["miniAppStats"],
    queryFn: getMiniAppReportStats,
  });

  const { data, isLoading, error } = useQuery<Page<MiniAppReport>>({
    queryKey: ["miniAppReports", { filter, page }],
    queryFn: () => getMiniAppReports(page, 20, filter === "ALL" ? undefined : filter),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ action }: { action: "RESOLVE" | "DISMISS" }) =>
      resolveMiniAppReport(resolving!.id, action, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniAppReports"] });
      queryClient.invalidateQueries({ queryKey: ["miniAppStats"] });
      setResolving(null);
      setResolution("");
    },
  });

  const reports = data?.content ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mini App Reports</h1>
        <p className="text-white/40 text-sm mt-1">User-submitted reports about mini apps</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total",     value: stats?.total     ?? "—", icon: Flag,          cls: "text-white/60" },
          { label: "Open",      value: stats?.open      ?? "—", icon: Clock,         cls: "text-amber-400" },
          { label: "Resolved",  value: stats?.resolved  ?? "—", icon: CheckCircle2,  cls: "text-emerald-400" },
          { label: "Dismissed", value: stats?.dismissed ?? "—", icon: XCircle,       cls: "text-white/30" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="bg-white/5 border border-white/8 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className={cls} />
              <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-white/5 border border-white/8 rounded-lg p-1 w-fit">
        {(["ALL", "OPEN", "RESOLVED", "DISMISSED"] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(0); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
            }`}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-white/40" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400 text-sm">{(error as Error).message}</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-sm">No reports found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">App</th>
                <th className="text-left px-4 py-3">Reporter</th>
                <th className="text-left px-4 py-3">Reason</th>
                <th className="text-left px-4 py-3">Details</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 font-mono text-white/70">{r.appId}</td>
                  <td className="px-4 py-3 text-white/70">
                    {r.reportedByHandle ? `@${r.reportedByHandle}` : r.reportedByUserId.slice(0, 8) + "…"}
                  </td>
                  <td className="px-4 py-3">{REASON_LABELS[r.reason] ?? r.reason}</td>
                  <td className="px-4 py-3 text-white/50 max-w-xs truncate">{r.details ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-white/40 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    {r.status === "OPEN" && (
                      <button
                        onClick={() => { setResolving(r); setResolution(""); }}
                        className="text-xs text-[#B7EE7A] hover:underline"
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/8 text-sm text-white/40">
            <span>Page {page + 1} of {data.totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded border border-white/10 hover:bg-white/5 disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={page + 1 >= data.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded border border-white/10 hover:bg-white/5 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {resolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Review Report</h2>
                <p className="text-white/40 text-sm mt-0.5">
                  {REASON_LABELS[resolving.reason]} · {resolving.appId}
                </p>
              </div>
              <button
                onClick={() => setResolving(null)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {resolving.details && (
              <div className="bg-white/5 rounded-lg px-4 py-3 mb-4 text-sm text-white/60">
                {resolving.details}
              </div>
            )}

            <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">
              Resolution note
            </label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-white/20 mb-4"
              rows={3}
              placeholder="Describe the action taken…"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />

            {resolveMutation.error && (
              <p className="text-red-400 text-sm mb-3">{(resolveMutation.error as Error).message}</p>
            )}

            <div className="flex gap-3">
              <button
                disabled={resolveMutation.isPending}
                onClick={() => resolveMutation.mutate({ action: "RESOLVE" })}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {resolveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Resolve
              </button>
              <button
                disabled={resolveMutation.isPending}
                onClick={() => resolveMutation.mutate({ action: "DISMISS" })}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/8 hover:bg-white/12 text-white/60 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                <XCircle size={16} />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
