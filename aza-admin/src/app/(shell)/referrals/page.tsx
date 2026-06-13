"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getReferrals,
  getReferralStats,
  rewardReferral,
  type Referral,
  type ReferralStats,
  type Page,
} from "@/lib/admin-api";
import { Gift, ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  REWARDED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-muted/50 text-foreground/40 border-border",
};

function ghs(n: number) {
  return `GHS ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export default function ReferralsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const { data: stats } = useQuery<ReferralStats>({
    queryKey: ["referralStats"],
    queryFn: getReferralStats,
  });

  const { data: referrals, isLoading } = useQuery<Page<Referral>>({
    queryKey: ["referrals", page],
    queryFn: () => getReferrals(page, 20),
  });

  const rewardMut = useMutation({
    mutationFn: (referredUserId: string) => rewardReferral(referredUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      queryClient.invalidateQueries({ queryKey: ["referralStats"] });
      setToast("Reward applied and wallet credited.");
      setTimeout(() => setToast(null), 3000);
    },
  });

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
          <CheckCircle2 size={14} /> {toast}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Gift size={20} className="text-[#B7EE7A]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Referral Program</h1>
          <p className="text-foreground/40 text-sm">Track invite conversions and reward payments.</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Referrals", value: stats.total },
            { label: "Rewarded", value: stats.rewarded },
            { label: "Pending", value: stats.pending },
            { label: "Total Paid Out", value: ghs(stats.totalRewardsGhs) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-foreground/40 text-xs">{label}</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Code</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Referrer ID</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Referred User ID</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Reward</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Status</th>
              <th className="text-left px-4 py-3 text-foreground/40 font-medium text-xs">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center">
                <Loader2 size={20} className="animate-spin mx-auto text-foreground/30" />
              </td></tr>
            ) : referrals?.content.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-foreground/30 text-sm">No referrals yet.</td></tr>
            ) : referrals?.content.map(r => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-[#B7EE7A] text-xs tracking-wider">{r.code}</td>
                <td className="px-4 py-3 font-mono text-foreground/50 text-xs truncate max-w-[120px]">{r.referrerId.slice(0, 8)}…</td>
                <td className="px-4 py-3 font-mono text-foreground/50 text-xs truncate max-w-[120px]">{r.referredUserId.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-foreground">{ghs(r.rewardAmount)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[r.status] ?? ""}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground/50 text-xs">{fmt(r.createdAt)}</td>
                <td className="px-4 py-3">
                  {r.status === "PENDING" && (
                    <button
                      onClick={() => rewardMut.mutate(r.referredUserId)}
                      disabled={rewardMut.isPending}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#B7EE7A]/10 text-[#B7EE7A] border border-[#B7EE7A]/20 hover:bg-[#B7EE7A]/20 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      {rewardMut.isPending ? <Loader2 size={10} className="animate-spin" /> : <Gift size={10} />}
                      Reward
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {referrals && referrals.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/30 hover:bg-muted border border-border text-foreground/60 text-sm disabled:opacity-30 transition-colors">
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-foreground/40 text-sm">{page + 1} / {referrals.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= referrals.totalPages - 1}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/30 hover:bg-muted border border-border text-foreground/60 text-sm disabled:opacity-30 transition-colors">
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
