"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuditLogs, MerchantAuditLog, Page } from "@/lib/merchant-api";
import { Loader2, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";

function fmtDate(s: string) {
  return new Date(s).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatAction(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function AuditLogsPage() {
  const [page, setPage] = useState<Page<MerchantAuditLog> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditLogs(p, 25);
      setPage(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(currentPage); }, [load, currentPage]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
        <p className="text-foreground/40 text-sm mt-0.5">Record of important actions taken on your account</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-[#B7EE7A]" size={22} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : !page || page.content.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <ClipboardList size={32} className="text-foreground/15" />
            <p className="text-foreground/40 text-sm">No audit events yet</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/[0.04]">
              {page.content.map((log) => (
                <div key={log.id} className="px-5 py-4 flex items-start gap-4 hover:bg-muted/10 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-[#B7EE7A]/60 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{formatAction(log.action)}</p>
                      <p className="text-xs text-foreground/30 flex-shrink-0">{fmtDate(log.createdAt)}</p>
                    </div>
                    {log.actorEmail && (
                      <p className="text-xs text-foreground/40 mt-0.5">by {log.actorEmail}</p>
                    )}
                    {log.details && (
                      <p className="text-xs text-foreground/30 mt-1 truncate">{log.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {page.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-foreground/30">
                  {page.totalElements} events · page {page.number + 1} of {page.totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage >= page.totalPages - 1}
                    className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
