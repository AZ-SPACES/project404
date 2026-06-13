"use client";

import { useQuery } from "@tanstack/react-query";
import { getTwoFactorStats, type TwoFactorStats } from "@/lib/admin-api";
import { ShieldCheck, Loader2 } from "lucide-react";

function MethodBar({
  label,
  count,
  total,
  pct,
  color,
}: {
  label: string;
  count: number;
  total: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground/70">{label}</span>
        <span className="text-foreground font-medium">
          {count.toLocaleString()} <span className="text-foreground/40 font-normal">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function TwoFaStatsPage() {
  const { data, isLoading } = useQuery<TwoFactorStats>({
    queryKey: ["twoFactorStats"],
    queryFn: getTwoFactorStats,
  });

  const enrollmentPct = data ? data.anyTwoFactorPct : 0;
  const enrollmentColor =
    enrollmentPct >= 80 ? "#22c55e" : enrollmentPct >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={20} className="text-foreground/50" />
          <h1 className="text-2xl font-semibold text-foreground">2FA Enrollment Stats</h1>
        </div>
        <p className="text-foreground/50 text-sm">Two-factor authentication adoption across the user base.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center h-48 items-center">
          <Loader2 size={24} className="animate-spin text-foreground/30" />
        </div>
      ) : data ? (
        <>
          {/* Big enrollment stat */}
          <div className="rounded-xl border border-border p-8 mb-8 flex flex-col items-center">
            <div
              className="text-7xl font-bold mb-2"
              style={{ color: enrollmentColor }}
            >
              {data.anyTwoFactorPct.toFixed(1)}%
            </div>
            <p className="text-foreground/50 text-sm mb-1">of users have at least one 2FA method</p>
            <p className="text-xs text-foreground/30">
              {data.anyTwoFactor.toLocaleString()} of {data.totalUsers.toLocaleString()} total users
            </p>
            {/* Ring indicator */}
            <div className="mt-6 w-48 h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(data.anyTwoFactorPct, 100)}%`,
                  backgroundColor: enrollmentColor,
                }}
              />
            </div>
          </div>

          {/* Method breakdown */}
          <div className="rounded-xl border border-border p-5 space-y-5">
            <h2 className="font-medium text-foreground text-sm">Breakdown by Method</h2>
            <MethodBar
              label="SMS"
              count={data.sms}
              total={data.totalUsers}
              pct={data.smsPct}
              color="#3b82f6"
            />
            <MethodBar
              label="Email OTP"
              count={data.email}
              total={data.totalUsers}
              pct={data.emailPct}
              color="#8b5cf6"
            />
            <MethodBar
              label="Authenticator App"
              count={data.app}
              total={data.totalUsers}
              pct={data.appPct}
              color="#B7EE7A"
            />
            <MethodBar
              label="Passkeys"
              count={data.passkeys}
              total={data.totalUsers}
              pct={data.totalUsers > 0 ? (data.passkeys / data.totalUsers) * 100 : 0}
              color="#f59e0b"
            />
            <MethodBar
              label="Biometrics"
              count={data.biometrics}
              total={data.totalUsers}
              pct={data.totalUsers > 0 ? (data.biometrics / data.totalUsers) * 100 : 0}
              color="#ec4899"
            />
          </div>

          <p className="text-xs text-foreground/30 mt-4 text-center">
            Users can have multiple methods — percentages are of total user base.
          </p>
        </>
      ) : null}
    </div>
  );
}
