"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuditLog, AuditLogEntry, Page } from "@/lib/admin-api";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";

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
  const cls = ACTION_STYLES[action] ?? "bg-white/10 text-white/50 border-white/10";
  const label = action.replace(/_/g, " ");
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  );
}

export default function AuditLogPage() {
  const [data, setData] = useState<Page<AuditLogEntry> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAuditLog(p, 20);
      setData(res);
      setPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Audit Log</h1>
        <p className="text-white/50 text-sm">All admin actions, newest first</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-24 text-white/30">
          <ScrollText size={40} className="mx-auto mb-4 opacity-40" />
          <p>No audit entries yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-white/40 font-medium">Admin</th>
                <th className="text-left px-4 py-3 text-white/40 font-medium">Action</th>
                <th className="text-left px-4 py-3 text-white/40 font-medium">Target User</th>
                <th className="text-left px-4 py-3 text-white/40 font-medium">Details</th>
                <th className="text-right px-4 py-3 text-white/40 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {data?.content.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-b border-white/5 transition-colors ${
                    i % 2 === 0 ? "" : "bg-white/[0.02]"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-sm">{entry.adminName}</div>
                    <div className="text-white/40 text-xs">{entry.adminEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-4 py-3 text-white/60 text-sm">
                    {entry.targetUserEmail ?? (
                      <span className="text-white/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs max-w-[220px]">
                    <span className="line-clamp-2">
                      {entry.details ?? <span className="text-white/25">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white/40 text-xs whitespace-nowrap">
                    {fmt(entry.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-white/50 mt-8">
          <button
            onClick={() => load(page - 1)}
            disabled={page === 0 || loading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>
            Page {page + 1} of {data.totalPages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= data.totalPages - 1 || loading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
