"use client";

import { useEffect, useState } from "react";
import { getStats, type AdminStats } from "@/lib/admin-api";
import { Users, ShieldCheck, ShieldAlert, DollarSign, TrendingUp, Loader2 } from "lucide-react";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/50 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-semibold mt-1.5 ${color}`}>{value}</p>
          {sub && <p className="text-white/40 text-xs mt-1">{sub}</p>}
        </div>
        <div className="p-2 rounded-xl bg-white/5">
          <Icon size={20} className="text-white/40" />
        </div>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString();
}

function fmtGhs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(e => setError(e.message));
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-white/40" size={28} />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Platform overview</p>
      </div>

      {/* Users */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/30 font-medium mb-4">Users</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={fmt(stats.totalUsers)} icon={Users} />
          <StatCard label="Active" value={fmt(stats.activeUsers)} icon={Users} color="text-emerald-400" />
          <StatCard label="Suspended" value={fmt(stats.suspendedUsers)} icon={ShieldAlert} color="text-amber-400" />
          <StatCard label="Deactivated" value={fmt(stats.deactivatedUsers)} icon={Users} color="text-red-400" />
        </div>
      </section>

      {/* KYC */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/30 font-medium mb-4">KYC</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Verified" value={fmt(stats.kycVerified)} icon={ShieldCheck} color="text-emerald-400" />
          <StatCard label="Pending Review" value={fmt(stats.kycPendingReview)} icon={ShieldAlert} color="text-amber-400" />
          <StatCard label="Rejected" value={fmt(stats.kycRejected)} icon={ShieldAlert} color="text-red-400" />
          <StatCard label="Not Started" value={fmt(stats.kycNotStarted)} icon={ShieldCheck} color="text-white/50" />
        </div>
      </section>

      {/* Transactions */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/30 font-medium mb-4">Transactions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total" value={fmt(stats.totalTransactions)} icon={TrendingUp} />
          <StatCard label="Completed" value={fmt(stats.completedTransactions)} icon={TrendingUp} color="text-emerald-400" />
          <StatCard label="Total Volume" value={fmtGhs(stats.totalTransactionVolume)} icon={DollarSign} />
          <StatCard
            label="Today"
            value={fmt(stats.transactionsToday)}
            sub={fmtGhs(stats.volumeToday)}
            icon={TrendingUp}
            color="text-[#F5A623]"
          />
        </div>
      </section>
    </div>
  );
}
