"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getAuditAnchors,
  getAuditLog,
  getStaff,
  verifyAuditAnchors,
  AuditLogEntry,
  Page,
  type AnchorVerification,
  type StaffMember,
} from "@/lib/admin-api";
import { ScrollText, ChevronLeft, ChevronRight, Loader2, ShieldCheck, ShieldX } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ACTION_STYLES: Record<string, string> = {
  APPROVE_KYC: "bg-green-500/10 text-green-400 border-green-500/20",
  REJECT_KYC: "bg-red-500/10 text-red-400 border-red-500/20",
  SUSPEND_USER: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  DEACTIVATE_USER: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  ACTIVATE_USER: "bg-green-500/10 text-green-400 border-green-500/20",
  CHANGE_ROLE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  FREEZE_WALLET: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  UNFREEZE_WALLET: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  BROADCAST_NOTIFICATION: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_STYLES[action] ?? "bg-muted/50 text-foreground/50 border-border";
  const label = action.replace(/_/g, " ");
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

function IntegrityCard() {
  const [results, setResults] = useState<AnchorVerification[] | null>(null);

  const { data: anchors } = useQuery({
    queryKey: ["auditAnchors"],
    queryFn: getAuditAnchors,
  });

  const verify = useMutation({
    mutationFn: verifyAuditAnchors,
    onSuccess: setResults,
  });

  const latest = anchors?.[0];
  const invalid = results?.filter((r) => !r.valid) ?? [];

  return (
    <div className="rounded-xl border border-border px-5 py-4 mb-6 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Log integrity</p>
        <p className="text-xs text-foreground/40">
          {latest
            ? `Hash-chained daily at 02:30 · last anchor ${latest.anchorDate} (${latest.entryCount} entries)`
            : "No anchors yet — the first runs at 02:30 tonight"}
        </p>
        {results && (
          <p className={`text-xs mt-1 ${invalid.length === 0 ? "text-emerald-400" : "text-red-400"}`}>
            {invalid.length === 0
              ? `All ${results.length} anchored day(s) verified — no tampering detected.`
              : `TAMPERING DETECTED on: ${invalid.map((r) => r.date).join(", ")}`}
          </p>
        )}
      </div>
      <button
        onClick={() => verify.mutate()}
        disabled={verify.isPending || !anchors || anchors.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-xs disabled:opacity-30 transition-colors flex-shrink-0"
      >
        {verify.isPending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : invalid.length > 0 ? (
          <ShieldX size={12} className="text-red-400" />
        ) : (
          <ShieldCheck size={12} />
        )}
        Verify chain
      </button>
    </div>
  );
}

export default function AuditLogPage() {
  const [page, setPage] = useState(0);
  const [staffFilter, setStaffFilter] = useState("");

  const { data: staff } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: getStaff,
  });

  const { data, isLoading, error } = useQuery<Page<AuditLogEntry>>({
    queryKey: ["auditLog", page, staffFilter],
    queryFn: () => getAuditLog(page, 20, staffFilter || undefined),
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Audit Log</h1>
          <p className="text-foreground/50 text-sm">All admin actions, newest first</p>
        </div>
        <select
          value={staffFilter}
          onChange={(e) => {
            setStaffFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
        >
          <option value="">All staff</option>
          {staff?.map((m) => (
            <option key={m.userId} value={m.userId}>{m.name}</option>
          ))}
        </select>
      </div>

      <IntegrityCard />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-24 text-foreground/30">
          <ScrollText size={40} className="mx-auto mb-4 opacity-40" />
          <p>No audit entries yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-foreground/40 font-medium">Admin</th>
                <th className="text-left px-4 py-3 text-foreground/40 font-medium">Action</th>
                <th className="text-left px-4 py-3 text-foreground/40 font-medium">Target User</th>
                <th className="text-left px-4 py-3 text-foreground/40 font-medium">Details</th>
                <th className="text-right px-4 py-3 text-foreground/40 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {data?.content.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-b border-border transition-colors ${
                    i % 2 === 0 ? "" : "bg-muted/10"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="text-foreground font-medium text-sm">{entry.adminName}</div>
                    <div className="text-foreground/40 text-xs">{entry.adminEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-4 py-3 text-foreground/60 text-sm">
                    {entry.targetUserEmail ?? (
                      <span className="text-foreground/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/50 text-xs max-w-[220px]">
                    <span className="line-clamp-2">
                      {entry.details ?? <span className="text-foreground/25">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground/40 text-xs whitespace-nowrap">
                    {fmt(entry.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-foreground/50 mt-8">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || isLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>Page {page + 1} of {data.totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
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
