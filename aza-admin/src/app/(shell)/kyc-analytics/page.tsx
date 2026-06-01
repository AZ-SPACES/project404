"use client";

import { useQuery } from "@tanstack/react-query";
import { getKycAnalytics, KycAnalytics } from "@/lib/admin-api";
import {
  ShieldCheck,
  ShieldX,
  Clock,
  AlertCircle,
  Circle,
  TrendingUp,
  Loader2,
} from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
}

function StatCard({ label, value, icon, accent, sub }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-foreground/50 text-sm">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      {sub && <div className="text-foreground/30 text-xs mt-1">{sub}</div>}
    </div>
  );
}

function StackedBar({ data }: { data: KycAnalytics }) {
  const total =
    data.notStarted + data.pending + data.underReview + data.verified + data.rejected;
  if (total === 0) return null;

  const segments = [
    { key: "verified", value: data.verified, bg: "bg-green-400", label: "Verified" },
    { key: "pending", value: data.pending, bg: "bg-yellow-400", label: "Pending" },
    { key: "underReview", value: data.underReview, bg: "bg-orange-400", label: "Under Review" },
    { key: "rejected", value: data.rejected, bg: "bg-red-400", label: "Rejected" },
    { key: "notStarted", value: data.notStarted, bg: "bg-white/20", label: "Not Started" },
  ];

  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-4 gap-px">
        {segments.map((s) => {
          const pct = (s.value / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={s.key}
              className={`${s.bg} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${s.value} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs text-foreground/50">
            <div className={`w-2.5 h-2.5 rounded-full ${s.bg}`} />
            <span>{s.label}</span>
            <span className="text-foreground/30">
              {s.value.toLocaleString()} ({total > 0 ? ((s.value / total) * 100).toFixed(1) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KycAnalyticsPage() {
  const { data, isLoading, error } = useQuery<KycAnalytics>({
    queryKey: ["kycAnalytics"],
    queryFn: getKycAnalytics,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-foreground/40" size={28} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const approvalRatePct = (data.approvalRate * 100).toFixed(1);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground mb-1">KYC Analytics</h1>
        <p className="text-foreground/50 text-sm">Verification funnel and approval rates</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Not Started"
          value={data.notStarted.toLocaleString()}
          icon={<Circle size={18} />}
          accent="text-foreground/30"
        />
        <StatCard
          label="Pending"
          value={data.pending.toLocaleString()}
          icon={<Clock size={18} />}
          accent="text-yellow-400"
        />
        <StatCard
          label="Under Review"
          value={data.underReview.toLocaleString()}
          icon={<AlertCircle size={18} />}
          accent="text-orange-400"
        />
        <StatCard
          label="Verified"
          value={data.verified.toLocaleString()}
          icon={<ShieldCheck size={18} />}
          accent="text-green-400"
        />
        <StatCard
          label="Rejected"
          value={data.rejected.toLocaleString()}
          icon={<ShieldX size={18} />}
          accent="text-red-400"
        />
        <StatCard
          label="Approval Rate"
          value={`${approvalRatePct}%`}
          icon={<TrendingUp size={18} />}
          accent="text-[#B7EE7A]"
          sub="of completed submissions"
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-base font-medium text-foreground mb-5">Last 30 Days</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted/30 rounded-xl p-4 text-center">
            <div className="text-2xl font-semibold text-foreground mb-1">
              {data.submittedLast30Days.toLocaleString()}
            </div>
            <div className="text-xs text-foreground/40">Submitted</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-semibold text-green-400 mb-1">
              {data.approvedLast30Days.toLocaleString()}
            </div>
            <div className="text-xs text-foreground/40">Approved</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-semibold text-red-400 mb-1">
              {data.rejectedLast30Days.toLocaleString()}
            </div>
            <div className="text-xs text-foreground/40">Rejected</div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-base font-medium text-foreground mb-5">Status Breakdown</h2>
        <StackedBar data={data} />
      </div>

      <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-6">
        <div className="flex-shrink-0 w-24 h-24 rounded-full border-4 border-[#B7EE7A]/40 flex items-center justify-center bg-[#B7EE7A]/5">
          <span className="text-2xl font-bold text-[#B7EE7A]">{approvalRatePct}%</span>
        </div>
        <div>
          <div className="text-foreground font-semibold text-lg mb-1">Overall Approval Rate</div>
          <div className="text-foreground/40 text-sm max-w-sm">
            {data.verified.toLocaleString()} users verified out of{" "}
            {(data.verified + data.rejected).toLocaleString()} completed submissions.
            {data.pending + data.underReview > 0 && (
              <span>
                {" "}
                {(data.pending + data.underReview).toLocaleString()} still in the pipeline.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
