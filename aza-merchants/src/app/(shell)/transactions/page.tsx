"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getSessions,
  CheckoutSession,
  Page,
} from "@/lib/merchant-api";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  ArrowLeftRight,
  Search,
} from "lucide-react";
import { format, parseISO } from "date-fns";

function fmtGHS(n: number) {
  return `GH₵ ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "MMM d, yyyy · h:mm a"); }
  catch { return iso; }
}

const STATUS_CFG: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  COMPLETED: { icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Paid" },
  PENDING:   { icon: Clock,        cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",       label: "Pending" },
  CANCELLED: { icon: XCircle,      cls: "text-red-400 bg-red-500/10 border-red-500/20",              label: "Cancelled" },
  EXPIRED:   { icon: Ban,          cls: "text-white/30 bg-white/5 border-white/10",                  label: "Expired" },
};

const STATUS_TABS = ["ALL", "COMPLETED", "PENDING", "EXPIRED", "CANCELLED"];

export default function TransactionsPage() {
  const [data, setData] = useState<Page<CheckoutSession> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);

  const load = useCallback(async (p: number, s: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSessions({
        page: p, size: 20,
        status: s !== "ALL" ? s : undefined,
      });
      setData(res);
      setPage(p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0, status);
  }, [load, status]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Transactions</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {data ? `${data.totalElements.toLocaleString()} total` : "All payment sessions"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <FilterTabs options={STATUS_TABS} value={status} onChange={setStatus} />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} />{error}
        </div>
      )}

      <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-white/30" size={22} />
          </div>
        ) : data?.content.length === 0 ? (
          <div className="py-16 text-center">
            <ArrowLeftRight size={28} className="mx-auto mb-3 text-white/15" />
            <p className="text-sm text-white/30">No transactions found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["Description", "Date", "Amount", "Fee", "Net", "Status"].map((h, i) => (
                  <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/25 uppercase tracking-wider text-left ${
                    i === 1 ? "hidden sm:table-cell" : ""
                  } ${i === 3 ? "hidden md:table-cell" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3">
              {data?.content.map((session) => {
                const cfg = STATUS_CFG[session.status] ?? STATUS_CFG.PENDING;
                const StatusIcon = cfg.icon;
                return (
                  <tr key={session.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-white/80 text-xs truncate max-w-[160px]">
                        {session.description || "Payment"}
                      </p>
                      <p className="text-[10px] text-white/30 font-mono mt-0.5 truncate max-w-[160px]">{session.id}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-xs text-white/40">
                        {fmtDate(session.completedAt ?? session.createdAt)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-white font-mono">{fmtGHS(session.amount)}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-white/35 font-mono text-xs">
                        {session.platformFee != null ? `-${fmtGHS(session.platformFee)}` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-white/70 font-mono text-xs">
                        {session.netAmount != null ? fmtGHS(session.netAmount) : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
                        <StatusIcon size={10} />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button onClick={() => load(page - 1, status)} disabled={page === 0 || loading} className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5">
            Previous
          </button>
          <span className="text-sm text-white/35">{page + 1} / {data.totalPages}</span>
          <button onClick={() => load(page + 1, status)} disabled={page >= data.totalPages - 1 || loading} className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function FilterTabs({
  options,
  value,
  onChange,
  colorActive = "bg-[#10b981] text-white",
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  colorActive?: string;
}) {
  return (
    <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === o ? colorActive : "text-white/45 hover:text-white"
          }`}
        >
          {o.charAt(0) + o.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  );
}
