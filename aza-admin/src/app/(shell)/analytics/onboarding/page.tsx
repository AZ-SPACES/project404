"use client";

import { useQuery } from "@tanstack/react-query";
import { getOnboardingFunnel, type OnboardingFunnel } from "@/lib/admin-api";
import { Loader2, TrendingDown, Users } from "lucide-react";

interface FunnelStep {
  label: string;
  key: keyof OnboardingFunnel;
  description: string;
}

const STEPS: FunnelStep[] = [
  { label: "Signed Up", key: "totalSignedUp", description: "Registered accounts" },
  { label: "KYC Started", key: "kycStarted", description: "At least started identity verification" },
  { label: "Docs Submitted", key: "docsSubmitted", description: "Submitted documents for review" },
  { label: "Under Review", key: "underReview", description: "Currently being reviewed by compliance" },
  { label: "Verified", key: "kycVerified", description: "Fully KYC verified and active" },
];

function FunnelBar({
  label,
  description,
  value,
  maxValue,
  dropOff,
  dropOffPct,
}: {
  label: string;
  description: string;
  value: number;
  maxValue: number;
  dropOff: number;
  dropOffPct: number;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="font-medium text-foreground">{label}</span>
          <span className="text-foreground/40 text-xs ml-2">{description}</span>
        </div>
        <div className="flex items-center gap-3 text-right">
          {dropOff > 0 && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <TrendingDown size={11} />
              -{dropOff.toLocaleString()} ({dropOffPct}%)
            </span>
          )}
          <span className="font-semibold text-foreground tabular-nums">{value.toLocaleString()}</span>
        </div>
      </div>
      <div className="h-7 rounded-lg bg-foreground/5 overflow-hidden">
        <div
          className="h-full rounded-lg bg-gradient-to-r from-blue-500/60 to-blue-400/40 transition-all duration-500"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
    </div>
  );
}

export default function OnboardingFunnelPage() {
  const { data, isLoading, error } = useQuery<OnboardingFunnel>({
    queryKey: ["onboarding-funnel"],
    queryFn: getOnboardingFunnel,
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
        Failed to load onboarding funnel.
      </div>
    );
  }

  const maxValue = data.totalSignedUp;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Onboarding Funnel</h1>
        <p className="text-sm text-foreground/50 mt-0.5">
          User drop-off across the registration and identity verification journey
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-foreground/50">KYC Started</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{data.kycStartedRate}%</p>
          <p className="text-xs text-foreground/40">of signups</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-foreground/50">Docs Submitted</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{data.docsSubmittedRate}%</p>
          <p className="text-xs text-foreground/40">of signups</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-foreground/50">Verified</p>
          <p className="text-2xl font-semibold text-emerald-400 mt-1">{data.verifiedRate}%</p>
          <p className="text-xs text-foreground/40">of signups</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-foreground/50">KYC Rejected</p>
          <p className="text-2xl font-semibold text-red-400 mt-1">{data.kycRejected.toLocaleString()}</p>
          <p className="text-xs text-foreground/40">users rejected</p>
        </div>
      </div>

      <div className="rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Users size={15} className="text-foreground/40" />
          <h2 className="text-sm font-medium text-foreground">Funnel breakdown</h2>
        </div>
        {STEPS.map((step, i) => {
          const value = data[step.key] as number;
          const prevValue = i > 0 ? (data[STEPS[i - 1].key] as number) : value;
          const dropOff = Math.max(0, prevValue - value);
          const dropOffPct = prevValue > 0 ? Math.round((dropOff / prevValue) * 100) : 0;
          return (
            <FunnelBar
              key={step.key}
              label={step.label}
              description={step.description}
              value={value}
              maxValue={maxValue}
              dropOff={dropOff}
              dropOffPct={dropOffPct}
            />
          );
        })}
      </div>

      {data.kycPending > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-300">
          {data.kycPending.toLocaleString()} user{data.kycPending !== 1 ? "s" : ""} submitted docs and are awaiting review.
        </div>
      )}
    </div>
  );
}
