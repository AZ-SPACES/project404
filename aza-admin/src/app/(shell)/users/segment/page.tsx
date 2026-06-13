"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  segmentUsers,
  exportUserSegment,
  type SegmentFilter,
  type AdminUser,
  type Page,
} from "@/lib/admin-api";
import { Filter, Loader2, Download } from "lucide-react";
import Link from "next/link";

function ghs(value: number) {
  return `GHS ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export default function UserSegmentPage() {
  const [filter, setFilter] = useState<SegmentFilter>({});
  const [appliedFilter, setAppliedFilter] = useState<SegmentFilter>({});
  const [page, setPage] = useState(0);

  // local form state
  const [kycStatus, setKycStatus] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<"" | "true" | "false">("");
  const [minBalance, setMinBalance] = useState("");
  const [maxBalance, setMaxBalance] = useState("");
  const [lastActiveDays, setLastActiveDays] = useState("");

  const { data, isLoading } = useQuery<Page<AdminUser>>({
    queryKey: ["userSegment", appliedFilter, page],
    queryFn: () => segmentUsers(appliedFilter, page, 20),
    enabled: Object.keys(appliedFilter).length > 0,
  });

  const exportMut = useMutation({
    mutationFn: () => exportUserSegment(appliedFilter),
  });

  function buildFilter(): SegmentFilter {
    const f: SegmentFilter = {};
    if (kycStatus) f.kycStatus = kycStatus;
    if (accountStatus) f.accountStatus = accountStatus;
    if (twoFactorEnabled === "true") f.twoFactorEnabled = true;
    if (twoFactorEnabled === "false") f.twoFactorEnabled = false;
    if (minBalance) f.minBalance = Number(minBalance);
    if (maxBalance) f.maxBalance = Number(maxBalance);
    if (lastActiveDays) f.lastActiveDays = Number(lastActiveDays);
    return f;
  }

  function handleApply() {
    const f = buildFilter();
    setAppliedFilter(f);
    setPage(0);
  }

  function handleReset() {
    setKycStatus("");
    setAccountStatus("");
    setTwoFactorEnabled("");
    setMinBalance("");
    setMaxBalance("");
    setLastActiveDays("");
    setAppliedFilter({});
    setPage(0);
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors";
  const selectCls = inputCls;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Filter size={20} className="text-foreground/50" />
          <h1 className="text-2xl font-semibold text-foreground">User Segmentation</h1>
        </div>
        <p className="text-foreground/50 text-sm">Filter users by attributes and export results as CSV.</p>
      </div>

      {/* Filter form */}
      <div className="rounded-xl border border-border p-5 mb-6">
        <h2 className="font-medium text-foreground text-sm mb-4">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-foreground/50 mb-1">KYC Status</label>
            <select value={kycStatus} onChange={(e) => setKycStatus(e.target.value)} className={selectCls}>
              <option value="">Any</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="NOT_STARTED">Not Started</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-foreground/50 mb-1">Account Status</label>
            <select value={accountStatus} onChange={(e) => setAccountStatus(e.target.value)} className={selectCls}>
              <option value="">Any</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="FROZEN">Frozen</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-foreground/50 mb-1">2FA Enabled</label>
            <select
              value={twoFactorEnabled}
              onChange={(e) => setTwoFactorEnabled(e.target.value as "" | "true" | "false")}
              className={selectCls}
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-foreground/50 mb-1">Min Balance (GHS)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-foreground/50 mb-1">Max Balance (GHS)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxBalance}
              onChange={(e) => setMaxBalance(e.target.value)}
              placeholder="Any"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-foreground/50 mb-1">Active in Last N Days</label>
            <input
              type="number"
              min="1"
              value={lastActiveDays}
              onChange={(e) => setLastActiveDays(e.target.value)}
              placeholder="e.g. 30"
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleApply}
            className="px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold transition-colors"
          >
            Apply Filters
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted text-sm transition-colors"
          >
            Reset
          </button>
          {data && data.totalElements > 0 && (
            <button
              onClick={() => exportMut.mutate()}
              disabled={exportMut.isPending}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted text-sm transition-colors disabled:opacity-50"
            >
              {exportMut.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {Object.keys(appliedFilter).length === 0 ? (
        <div className="rounded-xl border border-border text-center py-16 text-foreground/30">
          <Filter size={32} className="mx-auto mb-3 opacity-40" />
          <p>Apply filters to see matching users</p>
        </div>
      ) : isLoading ? (
        <div className="h-48 bg-muted/20 rounded-xl animate-pulse" />
      ) : !data || data.content.length === 0 ? (
        <div className="rounded-xl border border-border text-center py-16 text-foreground/30">
          <p>No users match the selected filters</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-foreground/50">
              <span className="font-semibold text-foreground">{data.totalElements.toLocaleString()}</span> users match
            </p>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/20 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">KYC</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Balance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">2FA</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Last Login</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.content.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-foreground/40">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-foreground/5 text-foreground/60 border-border">
                        {u.kycStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          u.accountStatus === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}
                      >
                        {u.accountStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{ghs(u.walletBalance)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          u.twoFactorEnabled
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-foreground/5 text-foreground/40 border-border"
                        }`}
                      >
                        {u.twoFactorEnabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/50 text-xs">{fmt(u.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/users/${u.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-foreground/70 hover:text-foreground transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-foreground/50">
              <span>
                Page {data.number + 1} of {data.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={page >= data.totalPages - 1}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
