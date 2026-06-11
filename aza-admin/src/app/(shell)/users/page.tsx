"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  NOT_STARTED: "bg-muted/50 text-foreground/40",
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[value] ?? "bg-muted/50 text-foreground/40"}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function PresenceCell({ user }: { user: AdminUser }) {
  const online = user.onlineStatus === "ONLINE";
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400" : "bg-foreground/15"}`} />
      <span className={online ? "text-emerald-400 font-medium" : "text-foreground/40"}>
        {online ? "Online" : relativeTime(user.lastSeenAt)}
      </span>
    </span>
  );
}

export default function UsersPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [kycStatus, setKycStatus] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [page, setPage] = useState(0);

  const { data: result, isLoading, error } = useQuery<Page<AdminUser>>({
    queryKey: ["users", { query, status, kycStatus, onlineOnly, page }],
    queryFn: () => getUsers({ query: query || undefined, status: status || undefined, kycStatus: kycStatus || undefined, online: onlineOnly || undefined, page, size: 20 }),
    // Presence changes by the minute — keep the list live while it's open.
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Users</h1>
        <p className="text-foreground/40 text-sm mt-1">{result ? `${result.totalElements.toLocaleString()} total` : ""}</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); setPage(0); }} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search name, email, phone, handle…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/25 text-sm" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-xl bg-muted/30 border border-border text-sm text-foreground/70 focus:outline-none">
          <option value="">All statuses</option>
          {["ACTIVE","SUSPENDED","DEACTIVATED"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={kycStatus} onChange={e => { setKycStatus(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-xl bg-muted/30 border border-border text-sm text-foreground/70 focus:outline-none">
          <option value="">All KYC</option>
          {["NOT_STARTED","PENDING","UNDER_REVIEW","VERIFIED","REJECTED"].map(s =>
            <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>
        <button type="button" onClick={() => { setOnlineOnly(v => !v); setPage(0); }}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors ${
            onlineOnly
              ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-400"
              : "bg-muted/30 border-border text-foreground/70 hover:bg-muted"
          }`}>
          <span className={`w-2 h-2 rounded-full ${onlineOnly ? "bg-emerald-400" : "bg-foreground/30"}`} />
          Online now
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{(error as Error).message}</p>}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-foreground/40" size={24} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["User","Presence","Phone","Account Status","KYC","Wallet","Joined"].map(h => (
                    <th key={h} className="text-left text-xs text-foreground/30 font-medium uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result?.content.map(u => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium">{`${u.firstName} ${u.lastName}`.trim() || u.username}</p>
                      <p className="text-foreground/40 text-xs mt-0.5">{u.email}</p>
                    </td>
                    <td className="px-4 py-3"><PresenceCell user={u} /></td>
                    <td className="px-4 py-3 text-foreground/60">{u.phone}</td>
                    <td className="px-4 py-3"><Badge value={u.accountStatus} map={STATUS_COLORS} /></td>
                    <td className="px-4 py-3"><Badge value={u.kycStatus} map={KYC_COLORS} /></td>
                    <td className="px-4 py-3 text-foreground/60">
                      {u.walletCurrency} {Number(u.walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-foreground/40 text-xs">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/users/${u.id}`} className="text-foreground/30 hover:text-foreground transition-colors">
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {result?.content.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-foreground/30 text-sm">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-foreground/50">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors">
            <ChevronLeft size={14} /> Prev
          </button>
          <span>Page {page + 1} of {result.totalPages}</span>
          <button onClick={() => setPage(p => Math.min(result.totalPages - 1, p + 1))} disabled={page >= result.totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors">
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
