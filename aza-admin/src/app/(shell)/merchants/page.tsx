"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getMerchants,
  getMerchantStats,
  AdminMerchant,
  MerchantStats,
  Page,
} from "@/lib/admin-api";
import {
  Store,
  Search,
  Loader2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

function fmtAmount(n: number, currency = "GHS") {
  return `${currency === "GHS" ? "GH₵" : currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  ACTIVE:            { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Active" },
  PENDING_KYB:       { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",       label: "Pending KYB" },
  KYB_SUBMITTED:     { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",           label: "KYB Submitted" },
  KYB_UNDER_REVIEW:  { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",           label: "Under Review" },
  MORE_INFO_REQUIRED:{ cls: "text-orange-400 bg-orange-500/10 border-orange-500/20",    label: "More Info" },
  SUSPENDED:         { cls: "text-red-400 bg-red-500/10 border-red-500/20",              label: "Suspended" },
  REJECTED:          { cls: "text-red-400 bg-red-500/10 border-red-500/20",              label: "Rejected" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { cls: "text-white/40 bg-white/5 border-white/10", label: status };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const STATUS_FILTERS = [
  "ALL", "ACTIVE", "PENDING_KYB", "KYB_SUBMITTED", "KYB_UNDER_REVIEW",
  "MORE_INFO_REQUIRED", "SUSPENDED", "REJECTED",
];
const STATUS_FILTER_LABELS: Record<string, string> = {
  ALL: "All", ACTIVE: "Active", PENDING_KYB: "Pending KYB", KYB_SUBMITTED: "KYB Submitted",
  KYB_UNDER_REVIEW: "Under Review", MORE_INFO_REQUIRED: "More Info",
  SUSPENDED: "Suspended", REJECTED: "Rejected",
};

function MerchantAvatar({ merchant }: { merchant: AdminMerchant }) {
  if (merchant.logoUrl) {
    return (
      <img
        src={merchant.logoUrl}
        alt={merchant.businessName}
        className="w-8 h-8 rounded-lg object-cover border border-white/10 flex-shrink-0"
      />
    );
  }
  const initials = merchant.businessName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-bold text-white/50">{initials}</span>
    </div>
  );
}

export default function MerchantsPage() {
  const router = useRouter();
  const [data, setData] = useState<Page<AdminMerchant> | null>(null);
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(0);

  // Load global stats once (accurate totals independent of current page)
  useEffect(() => {
    getMerchantStats().then(setStats).catch(() => null);
  }, []);

  const load = useCallback(async (p: number, q: string, st: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMerchants({
        query: q || undefined,
        status: st !== "ALL" ? st : undefined,
        page: p,
        size: 20,
      });
      setData(res);
      setPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load merchants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(0, query, statusFilter), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, query, statusFilter]);

  const reviewQueue = (stats?.kybUnderReview ?? 0) + (stats?.kybSubmitted ?? 0) + (stats?.moreInfoRequired ?? 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Merchants</h1>
          <p className="text-white/40 text-sm mt-0.5">Business accounts, KYB review, and status management</p>
        </div>
      </div>

      {/* KYB review queue alert */}
      {reviewQueue > 0 && (
        <div
          onClick={() => setStatusFilter("KYB_UNDER_REVIEW")}
          className="cursor-pointer bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-amber-500/12 transition-colors"
        >
          <ShieldCheck size={16} className="text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm text-amber-300 font-medium">
              {reviewQueue} merchant{reviewQueue !== 1 ? "s" : ""} awaiting KYB review
            </span>
            {(stats?.moreInfoRequired ?? 0) > 0 && (
              <span className="ml-2 text-xs text-orange-400">
                · {stats!.moreInfoRequired} responded to info request
              </span>
            )}
          </div>
          <span className="text-xs text-amber-400/60 flex-shrink-0">Click to filter →</span>
        </div>
      )}

      {/* Summary cards — sourced from stats endpoint, not current page */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Total",
            value: stats?.total ?? data?.totalElements ?? "—",
            color: "text-white",
            icon: Store,
          },
          {
            label: "Active",
            value: stats?.active ?? "—",
            color: "text-emerald-400",
            icon: Store,
          },
          {
            label: "Awaiting KYB",
            value: reviewQueue || "—",
            color: reviewQueue > 0 ? "text-amber-400" : "text-white/40",
            icon: ShieldCheck,
          },
          {
            label: "Total Volume",
            value: stats ? fmtAmount(stats.totalVolume) : "—",
            color: "text-[#B7EE7A]",
            icon: TrendingUp,
          },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[#161616] border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium">{label}</p>
              <Icon size={13} className="text-white/20" />
            </div>
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Balance breakdown */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-[#161616] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium mb-0.5">Total Merchant Balances</p>
              <p className="text-lg font-semibold text-white">{fmtAmount(stats.totalBalance)}</p>
            </div>
            <DollarSign size={18} className="text-white/15" />
          </div>
          <div className="bg-[#161616] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium mb-0.5">Suspended / Rejected</p>
              <p className="text-lg font-semibold text-red-400">{(stats.suspended + stats.rejected).toLocaleString()}</p>
            </div>
            <AlertTriangle size={18} className="text-white/15" />
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search name or handle…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/8 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20"
          />
        </div>

        <div className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl w-fit">
          {STATUS_FILTERS.slice(0, 5).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s ? "bg-[#B7EE7A] text-black" : "text-white/50 hover:text-white"
              }`}
            >
              {STATUS_FILTER_LABELS[s]}
              {s === "KYB_UNDER_REVIEW" && (stats?.kybUnderReview ?? 0) > 0 && statusFilter !== s && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 bg-white/5 p-1 rounded-xl w-fit">
          {STATUS_FILTERS.slice(5).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s ? "bg-[#B7EE7A] text-black" : "text-white/50 hover:text-white"
              }`}
            >
              {STATUS_FILTER_LABELS[s]}
              {s === "MORE_INFO_REQUIRED" && (stats?.moreInfoRequired ?? 0) > 0 && statusFilter !== s && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-white/30" size={24} />
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-20 text-white/25">
          <Store size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No merchants found</p>
        </div>
      ) : (
        <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Business</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden lg:table-cell">Balance</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden lg:table-cell">Volume</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden sm:table-cell">Created</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {data?.content.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => router.push(`/merchants/${m.id}`)}
                  className="hover:bg-white/3 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <MerchantAvatar merchant={m} />
                      <div>
                        <p className="font-semibold text-white leading-tight">{m.businessName}</p>
                        <p className="text-xs text-white/35 font-mono">@{m.businessHandle}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-white/50 text-xs capitalize">
                      {m.category ? m.category.replace(/_/g, " ").toLowerCase() : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right hidden lg:table-cell">
                    <span className="text-white/70 font-mono text-xs">{fmtAmount(m.balance, m.currency)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right hidden lg:table-cell">
                    <span className="text-white/50 font-mono text-xs">{fmtAmount(m.totalVolume, m.currency)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                    <span className="text-white/35 text-xs">{fmtDate(m.createdAt)}</span>
                  </td>
                  <td className="px-3 py-3.5">
                    <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button
            onClick={() => load(page - 1, query, statusFilter)}
            disabled={page === 0 || loading}
            className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5"
          >
            Previous
          </button>
          <span className="text-sm text-white/40">{page + 1} / {data.totalPages}</span>
          <button
            onClick={() => load(page + 1, query, statusFilter)}
            disabled={page >= data.totalPages - 1 || loading}
            className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 border border-white/5"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
