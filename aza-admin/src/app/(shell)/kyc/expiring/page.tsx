"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getKycExpiryStats,
  getExpiringKycDocs,
  type KycExpiryRecord,
  type KycExpiryStats,
} from "@/lib/admin-api";
import { CalendarClock, Loader2, AlertTriangle } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ days }: { days: number }) {
  if (days < 0)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">
        Expired
      </span>
    );
  if (days <= 7)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">
        {days}d
      </span>
    );
  if (days <= 30)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-400 border-orange-500/20">
        {days}d
      </span>
    );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full border bg-foreground/5 text-foreground/50 border-border">
      {days}d
    </span>
  );
}

export default function KycExpiringPage() {
  const [days, setDays] = useState(30);

  const { data: stats, isLoading: statsLoading } = useQuery<KycExpiryStats>({
    queryKey: ["kycExpiryStats"],
    queryFn: getKycExpiryStats,
  });

  const { data: docs, isLoading: docsLoading } = useQuery<KycExpiryRecord[]>({
    queryKey: ["kycExpiringDocs", days],
    queryFn: () => getExpiringKycDocs(days),
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock size={20} className="text-foreground/50" />
          <h1 className="text-2xl font-semibold text-foreground">KYC Document Expiry</h1>
        </div>
        <p className="text-foreground/50 text-sm">Track identity documents approaching expiry or already expired.</p>
      </div>

      {/* Stat cards */}
      {statsLoading ? (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border p-5 animate-pulse bg-muted/20 h-24" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <p className="text-xs text-foreground/50 mb-1">Already Expired</p>
            <p className="text-3xl font-semibold text-red-400">{stats.alreadyExpired}</p>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5">
            <p className="text-xs text-foreground/50 mb-1">Expiring in 7 Days</p>
            <p className="text-3xl font-semibold text-orange-400">{stats.expiringIn7Days}</p>
          </div>
          <div className="rounded-xl border border-border bg-foreground/5 p-5">
            <p className="text-xs text-foreground/50 mb-1">Expiring in 30 Days</p>
            <p className="text-3xl font-semibold text-foreground">{stats.expiringIn30Days}</p>
          </div>
        </div>
      ) : null}

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-foreground/50">Show expiring within:</span>
        {[7, 14, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              days === d
                ? "bg-[#B7EE7A]/15 text-[#B7EE7A] border border-[#B7EE7A]/30"
                : "bg-muted/30 text-foreground/50 hover:text-foreground hover:bg-muted border border-transparent"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Table */}
      {docsLoading ? (
        <div className="h-48 bg-muted/20 rounded-xl animate-pulse" />
      ) : !docs || docs.length === 0 ? (
        <div className="rounded-xl border border-border text-center py-16 text-foreground/30">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
          <p>No documents expiring within {days} days</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">User ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">ID Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">ID Number</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Expiry Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Days Left</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">KYC Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/50 uppercase tracking-wider">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((doc) => {
                const d = daysUntil(doc.idExpiryDate);
                return (
                  <tr key={doc.userId} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground/60">{doc.userId}</td>
                    <td className="px-4 py-3 text-foreground">{doc.idType}</td>
                    <td className="px-4 py-3 text-foreground/70">{doc.idNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground">{fmt(doc.idExpiryDate)}</td>
                    <td className="px-4 py-3">
                      <ExpiryBadge days={d} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-foreground/5 text-foreground/60 border-border">
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/50 text-xs">
                      {doc.submittedAt ? fmt(doc.submittedAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {docsLoading && (
        <div className="flex justify-center mt-8">
          <Loader2 size={20} className="animate-spin text-foreground/30" />
        </div>
      )}
    </div>
  );
}
