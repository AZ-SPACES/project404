"use client";

import { useEffect, useState, useCallback } from "react";
import { getUsers, type AdminUser, type Page } from "@/lib/admin-api";
import Link from "next/link";
import { Search, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-400/15 text-emerald-400",
  SUSPENDED: "bg-amber-400/15 text-amber-400",
  DEACTIVATED: "bg-red-400/15 text-red-400",
};
const KYC_COLORS: Record<string, string> = {
  VERIFIED: "bg-emerald-400/15 text-emerald-400",
  UNDER_REVIEW: "bg-amber-400/15 text-amber-400",
  REJECTED: "bg-red-400/15 text-red-400",
  PENDING: "bg-sky-400/15 text-sky-400",
  NOT_STARTED: "bg-white/10 text-white/40",
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[value] ?? "bg-white/10 text-white/40"}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

export default function UsersPage() {
  const [result, setResult] = useState<Page<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [kycStatus, setKycStatus] = useState("");
  const [page, setPage] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getUsers({ query: query || undefined, status: status || undefined, kycStatus: kycStatus || undefined, page, size: 20 })
      .then(setResult).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [query, status, kycStatus, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Users</h1>
        <p className="text-white/40 text-sm mt-1">{result ? `${result.totalElements.toLocaleString()} total` : ""}</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); setPage(0); load(); }} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search name, email, phone, handle…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/25 text-sm" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 focus:outline-none">
          <option value="">All statuses</option>
          {["ACTIVE","SUSPENDED","DEACTIVATED"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={kycStatus} onChange={e => { setKycStatus(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 focus:outline-none">
          <option value="">All KYC</option>
          {["NOT_STARTED","PENDING","UNDER_REVIEW","VERIFIED","REJECTED"].map(s =>
            <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-white/40" size={24} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["User","Phone","Account Status","KYC","Wallet","Joined"].map(h => (
                    <th key={h} className="text-left text-xs text-white/30 font-medium uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {result?.content.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{`${u.firstName} ${u.lastName}`.trim() || u.username}</p>
                      <p className="text-white/40 text-xs mt-0.5">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-white/60">{u.phone}</td>
                    <td className="px-4 py-3"><Badge value={u.accountStatus} map={STATUS_COLORS} /></td>
                    <td className="px-4 py-3"><Badge value={u.kycStatus} map={KYC_COLORS} /></td>
                    <td className="px-4 py-3 text-white/60">
                      {u.walletCurrency} {Number(u.walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/users/${u.id}`} className="text-white/30 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {result?.content.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-white/30 text-sm">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-white/50">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">
            <ChevronLeft size={14} /> Prev
          </button>
          <span>Page {page + 1} of {result.totalPages}</span>
          <button onClick={() => setPage(p => Math.min(result.totalPages - 1, p + 1))} disabled={page >= result.totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
