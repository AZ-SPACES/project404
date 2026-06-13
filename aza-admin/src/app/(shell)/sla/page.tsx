"use client";

import { useQuery } from "@tanstack/react-query";
import { getSlaDashboard, type SlaDashboard } from "@/lib/admin-api";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  Loader2,
  MessageSquare,
  Shield,
  Timer,
} from "lucide-react";

function StatusBadge({ breaching, value }: { breaching: boolean; value: number }) {
  const color = breaching
    ? "text-red-400 bg-red-500/10 border-red-500/20"
    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  const Icon = breaching ? AlertTriangle : CheckCircle2;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
      <Icon size={11} />
      {value}
    </span>
  );
}

function SlaCard({
  title,
  subtitle,
  breaching,
  breachingLabel,
  total,
  totalLabel,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  breaching: number;
  breachingLabel: string;
  total: number;
  totalLabel: string;
  icon: React.ElementType;
}) {
  const isOk = breaching === 0;
  return (
    <div
      className={`rounded-xl border p-5 ${
        isOk ? "border-border" : "border-red-500/30 bg-red-500/5"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={isOk ? "text-foreground/40" : "text-red-400"} />
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-foreground/50">{subtitle}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge breaching={!isOk} value={breaching} />
        </div>
      </div>
      <div className="flex gap-6 text-sm">
        <div>
          <p className="text-foreground/50 text-xs">{breachingLabel}</p>
          <p className={`font-semibold text-lg ${breaching > 0 ? "text-red-400" : "text-foreground"}`}>
            {breaching}
          </p>
        </div>
        <div>
          <p className="text-foreground/50 text-xs">{totalLabel}</p>
          <p className="font-semibold text-lg text-foreground">{total}</p>
        </div>
      </div>
    </div>
  );
}

export default function SlaPage() {
  const { data, isLoading, error } = useQuery<SlaDashboard>({
    queryKey: ["sla-dashboard"],
    queryFn: getSlaDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-foreground/40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">
        Failed to load SLA dashboard.
      </div>
    );
  }

  const allClear =
    data.kycPendingOver48h === 0 &&
    data.complaintsBreachingAck === 0 &&
    data.complaintsBreachingResolve === 0 &&
    data.dsarOverdue === 0 &&
    data.approvalsStale === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">SLA Dashboard</h1>
        <p className="text-sm text-foreground/50 mt-0.5">
          Real-time view of deadlines and overdue items across all work queues
        </p>
      </div>

      {allClear && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 size={15} />
          All SLAs are currently met — no overdue items.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SlaCard
          title="KYC Review Queue"
          subtitle="Pending submissions awaiting review"
          breaching={data.kycPendingOver48h}
          breachingLabel="Pending &gt;48 h"
          total={data.kycPendingTotal}
          totalLabel="Total pending"
          icon={Shield}
        />
        <SlaCard
          title="Under Active Review"
          subtitle="KYC cases currently being reviewed"
          breaching={0}
          breachingLabel="No SLA target"
          total={data.kycUnderReview}
          totalLabel="Under review"
          icon={Clock}
        />
        <SlaCard
          title="Complaint — Acknowledgement"
          subtitle="Open complaints past ack deadline"
          breaching={data.complaintsBreachingAck}
          breachingLabel="Breaching ack SLA"
          total={data.complaintsOpen}
          totalLabel="Open complaints"
          icon={MessageSquare}
        />
        <SlaCard
          title="Complaint — Resolution"
          subtitle="Open/acknowledged complaints past resolve deadline"
          breaching={data.complaintsBreachingResolve}
          breachingLabel="Breaching resolve SLA"
          total={data.complaintsOpen}
          totalLabel="Open complaints"
          icon={MessageSquare}
        />
        <SlaCard
          title="Data Subject Access Requests"
          subtitle="DSARs overdue the statutory 30-day window"
          breaching={data.dsarOverdue}
          breachingLabel="Overdue DSARs"
          total={data.dsarOpen}
          totalLabel="Open DSARs"
          icon={FileSearch}
        />
        <SlaCard
          title="Pending Approvals"
          subtitle="Maker-checker approvals older than 7 days"
          breaching={data.approvalsStale}
          breachingLabel="Stale (&gt;7 days)"
          total={data.approvalsPending}
          totalLabel="Total pending"
          icon={Timer}
        />
      </div>
    </div>
  );
}
