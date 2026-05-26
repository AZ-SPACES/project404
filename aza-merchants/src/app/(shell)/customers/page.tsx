"use client";

import { useEffect, useState, useCallback } from "react";
import { getCustomers, Customer, Page } from "@/lib/merchant-api";
import { Loader2, Users, ChevronLeft, ChevronRight } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function CustomersPage() {
  const [page, setPage] = useState<Page<Customer> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomers(p, 20);
      setPage(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(currentPage); }, [load, currentPage]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Customers</h1>
        <p className="text-white/40 text-sm mt-0.5">Customers who have paid you at least once</p>
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
            <Users size={32} className="text-white/15" />
            <p className="text-white/40 text-sm">No customers yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">Customer</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30">Payments</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30">Total Spend</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden md:table-cell">First Payment</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden md:table-cell">Last Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {page.content.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#10b981]/15 border border-[#10b981]/25 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-[#10b981]">{initials(c.name)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{c.name}</p>
                            {c.email && <p className="text-xs text-white/40">{c.email}</p>}
                            {c.phone && !c.email && <p className="text-xs text-white/40">{c.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-white/70">{c.totalPayments}</td>
                      <td className="px-5 py-3.5 text-right text-sm font-medium text-white">{fmt(c.totalSpend)}</td>
                      <td className="px-5 py-3.5 text-right text-xs text-white/40 hidden md:table-cell">{fmtDate(c.firstPaymentAt)}</td>
                      <td className="px-5 py-3.5 text-right text-xs text-white/40 hidden md:table-cell">{fmtDate(c.lastPaymentAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {page.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <p className="text-xs text-white/30">
                  {page.totalElements} customers · page {page.number + 1} of {page.totalPages}
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
