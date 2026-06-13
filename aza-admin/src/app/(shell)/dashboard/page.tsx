"use client";

import { useQuery } from "@tanstack/react-query";
import { getStats, getLiveStats, getRevenueAnalytics, type AdminStats, type LiveStats, type MonthlyRevenue } from "@/lib/admin-api";
import { Users, ShieldCheck, ShieldAlert, DollarSign, TrendingUp, Loader2, Activity, Store, Banknote } from "lucide-react";

function Sparkline({ data, color = "#B7EE7A" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80, h = 28;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SparkCard({ label, value, sub, data, color }: {
  label: string; value: string; sub?: string; data: number[]; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start justify-between gap-3">
      <div>
        <p className="text-foreground/50 text-xs font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-semibold mt-1.5 text-foreground">{value}</p>
        {sub && <p className="text-foreground/40 text-xs mt-1">{sub}</p>}
      </div>
      <div className="flex-shrink-0 mt-1">
        <Sparkline data={data} color={color} />
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, icon: Icon, color = "text-foreground",
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-foreground/50 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-semibold mt-1.5 ${color}`}>{value}</p>
          {sub && <p className="text-foreground/40 text-xs mt-1">{sub}</p>}
        </div>
        <div className="p-2 rounded-xl bg-muted/50">
          <Icon size={20} className="text-foreground/40" />
        </div>
      </div>
    </div>
  );
}

function LiveCard({
  label, value, icon: Icon,
}: {
  label: string; value: number; icon: React.ElementType;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
      <div className="p-2 rounded-xl bg-muted/50">
        <Icon size={18} className="text-foreground/40" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-foreground/50 text-xs font-medium uppercase tracking-wider truncate">{label}</p>
        <p className="text-2xl font-semibold text-foreground mt-0.5">{value.toLocaleString()}</p>
      </div>
      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString();
const fmtGhs = (n: number) =>
  `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DashboardPage() {
  const { data: stats, error: statsError } = useQuery<AdminStats>({
    queryKey: ["stats"],
    queryFn: getStats,
  });

  const { data: liveStats } = useQuery<LiveStats>({
    queryKey: ["liveStats"],
    queryFn: getLiveStats,
    refetchInterval: 30_000,
  });

  const { data: revenueData } = useQuery({
    queryKey: ["revenueAnalytics", 6],
    queryFn: () => getRevenueAnalytics(6),
  });

  const monthly: MonthlyRevenue[] = revenueData?.monthly ?? [];

  if (statsError) return <p className="text-red-400">{(statsError as Error).message}</p>;
  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-foreground/40" size={28} />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-foreground/40 text-sm mt-1">Platform overview</p>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-foreground/30 font-medium mb-4">Users</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={fmt(stats.totalUsers)} icon={Users} />
          <StatCard label="Active" value={fmt(stats.activeUsers)} icon={Users} color="text-emerald-400" />
          <StatCard label="Suspended" value={fmt(stats.suspendedUsers)} icon={ShieldAlert} color="text-amber-400" />
          <StatCard label="Deactivated" value={fmt(stats.deactivatedUsers)} icon={Users} color="text-red-400" />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-foreground/30 font-medium mb-4">KYC</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Verified" value={fmt(stats.kycVerified)} icon={ShieldCheck} color="text-emerald-400" />
          <StatCard label="Pending Review" value={fmt(stats.kycPendingReview)} icon={ShieldAlert} color="text-amber-400" />
          <StatCard label="Rejected" value={fmt(stats.kycRejected)} icon={ShieldAlert} color="text-red-400" />
          <StatCard label="Not Started" value={fmt(stats.kycNotStarted)} icon={ShieldCheck} color="text-foreground/50" />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-foreground/30 font-medium mb-4">Transactions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total" value={fmt(stats.totalTransactions)} icon={TrendingUp} />
          <StatCard label="Completed" value={fmt(stats.completedTransactions)} icon={TrendingUp} color="text-emerald-400" />
          <StatCard label="Total Volume" value={fmtGhs(stats.totalTransactionVolume)} icon={DollarSign} />
          <StatCard label="Today" value={fmt(stats.transactionsToday)} sub={fmtGhs(stats.volumeToday)} icon={TrendingUp} color="text-[#B7EE7A]" />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-foreground/30 font-medium mb-4">Merchants</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Merchants" value={fmt(stats.totalMerchants)} icon={Store} />
          <StatCard label="Active" value={fmt(stats.activeMerchants)} icon={Store} color="text-emerald-400" />
          <StatCard label="Pending KYB" value={fmt(stats.pendingKybMerchants)} icon={ShieldAlert} color="text-amber-400" />
          <StatCard label="Merchant Volume" value={fmtGhs(stats.totalMerchantVolume)} icon={DollarSign} color="text-[#B7EE7A]" />
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-foreground/30 font-medium mb-2">Platform Funds</h2>
        <p className="text-foreground/30 text-xs mb-4">Total money held across all accounts right now</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="User Wallets"
            value={fmtGhs(stats.totalWalletBalance)}
            sub="Sum of all personal wallet balances"
            icon={Banknote}
            color="text-emerald-400"
          />
          <StatCard
            label="Merchant Accounts"
            value={fmtGhs(stats.totalMerchantBalance)}
            sub="Pending payouts across all merchants"
            icon={Store}
            color="text-[#B7EE7A]"
          />
          <StatCard
            label="Total on Platform"
            value={fmtGhs(stats.totalWalletBalance + stats.totalMerchantBalance)}
            sub="Combined wallet + merchant balances"
            icon={DollarSign}
            color="text-foreground"
          />
        </div>
      </section>

      {liveStats && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xs uppercase tracking-widest text-foreground/30 font-medium">Live</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <LiveCard label="Users Online" value={liveStats.onlineUsers} icon={Users} />
            <LiveCard label="Transactions (1h)" value={liveStats.transactionsLastHour} icon={Activity} />
            <LiveCard label="Pending KYC" value={liveStats.pendingKycCount} icon={ShieldAlert} />
          </div>
        </section>
      )}

      {monthly.length >= 2 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-foreground/30 font-medium mb-4">Trends (last {monthly.length} months)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SparkCard
              label="Transaction Volume"
              value={fmtGhs(monthly[monthly.length - 1].volume)}
              sub={`${monthly[monthly.length - 1].month}`}
              data={monthly.map(m => m.volume)}
              color="#B7EE7A"
            />
            <SparkCard
              label="Transaction Count"
              value={fmt(monthly[monthly.length - 1].count)}
              sub={`${monthly[monthly.length - 1].month}`}
              data={monthly.map(m => m.count)}
              color="#60a5fa"
            />
            <SparkCard
              label="Avg Transaction"
              value={fmtGhs(monthly[monthly.length - 1].avgTransaction)}
              sub={`${monthly[monthly.length - 1].month}`}
              data={monthly.map(m => m.avgTransaction)}
              color="#a78bfa"
            />
          </div>
        </section>
      )}
    </div>
  );
}
