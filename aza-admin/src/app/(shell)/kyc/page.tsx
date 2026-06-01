"use client";

import { useQuery } from "@tanstack/react-query";
import { getPendingKyc, type KycRecord } from "@/lib/admin-api";
import Link from "next/link";
import { Loader2, ChevronRight, ShieldAlert } from "lucide-react";

function KycBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    UNDER_REVIEW: "bg-amber-400/15 text-amber-400",
    VERIFIED: "bg-emerald-400/15 text-emerald-400",
    REJECTED: "bg-red-400/15 text-red-400",
    PENDING: "bg-muted/50 text-foreground/50",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-muted/50 text-foreground/50"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function KycQueuePage() {
  const { data: records = [], isLoading, error } = useQuery<KycRecord[]>({
    queryKey: ["kycQueue"],
    queryFn: getPendingKyc,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-foreground/40" size={28} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">KYC Review</h1>
        <p className="text-foreground/40 text-sm mt-1">
          {records.length} submission{records.length !== 1 ? "s" : ""} awaiting review
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{(error as Error).message}</p>}

      {records.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center h-48 text-foreground/30 gap-3">
          <ShieldAlert size={36} />
          <p className="text-sm">No pending KYC submissions</p>
        </div>
      )}

      <div className="space-y-3">
        {records.map(r => (
          <Link
            key={r.userId}
            href={`/kyc/${r.userId}`}
            className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 hover:border-foreground/15 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center text-foreground/50 text-sm font-medium shrink-0">
                {(r.displayName ?? r.email ?? "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-foreground font-medium text-sm">{r.displayName ?? "—"}</p>
                <p className="text-foreground/40 text-xs mt-0.5">{r.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <KycBadge status={r.status} />
              <div className="text-right hidden sm:block">
                <p className="text-foreground/50 text-xs">{r.idType ?? "—"}</p>
                <p className="text-foreground/30 text-xs">{r.completionPercentage}% complete</p>
              </div>
              <ChevronRight size={16} className="text-foreground/20 group-hover:text-foreground/50 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
