"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGlobalPayouts, type GlobalPayout, type Page } from "@/lib/admin-api";
import { ArrowDownToLine, Loader2, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";

const STATUS_CFG: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
  PENDING:   { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",   label: "Pending",   icon: <Clock size={11} /> },
  APPROVED:  { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",      label: "Approved",  icon: <CheckCircle2 size={11} /> },
  COMPLETED: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Completed", icon: <CheckCircle2 size={11} /> },
  REJECTED:  { cls: "text-red-400 bg-red-500/10 border-red-500/20",         label: "Rejected",  icon: <XCircle size={11} /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { cls: "text-foreground/40 bg-muted/30 border-border", label: status, icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";

export default function PayoutsPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const { data, isLoading, error } = useQuery<Page<GlobalPayout>>({
    queryKey: ["globalPayouts", page, statusFilter],
    queryFn: () => getGlobalPayouts(page, 20, statusFilter === "ALL" ? undefined : statusFilter),
  });

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "PENDING", label: "Pending" },
    { key: "APPROVED", label: "Approved" },
    { key: "COMPLETED", label: "Completed" },
    { key: "REJECTED", label: "Rejected" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Merchant Payouts</h1>
        <p className="text-foreground/40 text-sm mt-0.5">All payout requests across every merchant, newest first</p>
      </div>

      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(0); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              statusFilter === tab.key ? "bg-[#B7EE7A] text-black" : "text-foreground/50 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-foreground/30" size={24} />
        </div>
      ) : !data || data.content.length === 0 ? (
        <div className="text-center py-20 text-foreground/25">
          <ArrowDownToLine size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No payout requests found</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Merchant</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Amount</th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden md:table-cell">Note</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden lg:table-cell">Requested</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden lg:table-cell">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.content.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-foreground">{p.merchantName}</p>
                    <p className="text-xs text-foreground/30 font-mono">{p.merchantId.slice(0, 8)}…</p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-sm font-semibold text-foreground">{fmtAmount(p.amount, p.currency)}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <p className="text-xs text-foreground/50 max-w-[180px] truncate">{p.note ?? "—"}</p>
                  </td>
                  <td className="px-5 py-4 text-right hidden lg:table-cell">
                    <p className="text-xs text-foreground/35">{fmtDate(p.requestedAt)}</p>
                  </td>
                  <td className="px-5 py-4 text-right hidden lg:table-cell">
                    <p className="text-xs text-foreground/35">{fmtDate(p.completedAt)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0 || isLoading} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Previous</button>
          <span className="text-sm text-foreground/40">{page + 1} / {data.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages - 1 || isLoading} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Next</button>
        </div>
      )}
    </div>
  );
}
