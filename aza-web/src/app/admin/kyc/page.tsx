"use client";

import { useEffect, useState } from "react";
import { getPendingKyc, type KycRecord } from "@/lib/admin-api";
import Link from "next/link";
import { Loader2, ChevronRight, ShieldAlert } from "lucide-react";

function KycBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    UNDER_REVIEW: "bg-amber-400/15 text-amber-400",
    VERIFIED: "bg-emerald-400/15 text-emerald-400",
    REJECTED: "bg-red-400/15 text-red-400",
    PENDING: "bg-white/10 text-white/50",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-white/10 text-white/50"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function KycQueuePage() {
  const [records, setRecords] = useState<KycRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getPendingKyc()
      .then(setRecords)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-white/40" size={28} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">KYC Review</h1>
          <p className="text-white/40 text-sm mt-1">
            {records.length} submission{records.length !== 1 ? "s" : ""} awaiting review
          </p>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {records.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center h-48 text-white/30 gap-3">
          <ShieldAlert size={36} />
          <p className="text-sm">No pending KYC submissions</p>
        </div>
      )}

      <div className="space-y-3">
        {records.map(r => (
          <Link
            key={r.userId}
            href={`/admin/kyc/${r.userId}`}
            className="flex items-center justify-between bg-[#161616] border border-white/5 rounded-2xl p-4 hover:border-white/15 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 text-sm font-medium shrink-0">
                {(r.displayName ?? r.email ?? "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{r.displayName ?? "—"}</p>
                <p className="text-white/40 text-xs mt-0.5">{r.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <KycBadge status={r.status} />
              <div className="text-right hidden sm:block">
                <p className="text-white/50 text-xs">{r.idType ?? "—"}</p>
                <p className="text-white/30 text-xs">{r.completionPercentage}% complete</p>
              </div>
              <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
