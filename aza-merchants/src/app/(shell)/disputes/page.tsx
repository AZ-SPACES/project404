"use client";

import { useEffect, useState, useCallback } from "react";
import { getMerchantDisputes, MerchantDispute, Page } from "@/lib/merchant-api";
import { Loader2, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";

function fmt(n: number | null, currency: string | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: currency ?? "GHS" }).format(n);
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-amber-400/10 text-amber-400",
  UNDER_REVIEW: "bg-blue-400/10 text-blue-400",
  RESOLVED: "bg-[#10b981]/10 text-[#10b981]",
  CLOSED: "bg-white/10 text-white/50",
};

export default function DisputesPage() {
  const [page, setPage] = useState<Page<MerchantDispute> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMerchantDisputes(p, 20);
      setPage(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(currentPage); }, [load, currentPage]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Disputes</h1>
        <p className="text-white/40 text-sm mt-0.5">Customer disputes on your transactions</p>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-[#10b981]" size={22} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : !page || page.content.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <ShieldAlert size={32} className="text-white/15" />
            <p className="text-white/40 text-sm">No disputes found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">Reference</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden md:table-cell">Category</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30">Amount</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-white/30">Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden md:table-cell">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {page.content.map((d) => (
                    <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-white font-mono">{d.referenceId ?? d.id.slice(0, 8).toUpperCase()}</p>
                        {d.description && <p className="text-xs text-white/40 mt-0.5 truncate max-w-xs">{d.description}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-white/60 hidden md:table-cell capitalize">
                        {d.category?.replace(/_/g, " ").toLowerCase() ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-medium text-white">{fmt(d.amount, d.currency)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[d.status] ?? "bg-white/10 text-white/50"}`}>
                          {d.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-white/40 hidden md:table-cell">{fmtDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {page.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <p className="text-xs text-white/30">
                  {page.totalElements} disputes · page {page.number + 1} of {page.totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage >= page.totalPages - 1}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
