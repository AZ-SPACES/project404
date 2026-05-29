"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUserDetail,
  updateUserStatus,
  updateUserRole,
  getKycRecord,
  getUserTransactions,
  updateUserLimits,
  type AdminUser,
  type KycRecord,
  type AdminTransaction,
} from "@/lib/admin-api";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Crown,
  ZoomIn,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  return (
    <div>
      <p className="text-white/30 text-xs">{label}</p>
      <p className="text-white text-sm mt-0.5">{value === null || value === undefined ? "—" : String(value)}</p>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-400/15 text-emerald-400 border-emerald-400/20",
  SUSPENDED: "bg-amber-400/15 text-amber-400 border-amber-400/20",
  DEACTIVATED: "bg-red-400/15 text-red-400 border-red-400/20",
};
const KYC_COLORS: Record<string, string> = {
  VERIFIED: "bg-emerald-400/15 text-emerald-400",
  UNDER_REVIEW: "bg-amber-400/15 text-amber-400",
  REJECTED: "bg-red-400/15 text-red-400",
  PENDING: "bg-sky-400/15 text-sky-400",
  NOT_STARTED: "bg-white/10 text-white/40",
};

const TX_STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-500/10 text-green-400 border-green-500/20",
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
  CANCELLED: "bg-white/10 text-white/40 border-white/10",
  DECLINED: "bg-red-500/10 text-red-400 border-red-500/20",
  REVERSED: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function DocImage({ url, label }: { url: string | null; label: string }) {
  const [enlarged, setEnlarged] = useState(false);
  if (!url) return (
    <div className="aspect-video bg-white/5 rounded-xl flex items-center justify-center text-white/20 text-xs border border-white/5">
      Not provided
    </div>
  );
  return (
    <>
      <div
        className="relative aspect-video bg-white/5 rounded-xl overflow-hidden cursor-pointer group border border-white/5"
        onClick={() => setEnlarged(true)}
      >
        <Image src={url} alt={label} fill className="object-cover" unoptimized />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="absolute bottom-2 left-2 text-xs text-white/60 bg-black/50 px-2 py-0.5 rounded">{label}</p>
      </div>
      {enlarged && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setEnlarged(false)}>
          <Image src={url} alt={label} width={1200} height={800} className="object-contain w-full h-auto max-h-[90vh] rounded-xl" unoptimized />
        </div>
      )}
    </>
  );
}

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const queryClient = useQueryClient();

  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [reason, setReason] = useState("");

  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [singleLimit, setSingleLimit] = useState<string>("");

  const { data: user, isLoading, error } = useQuery<AdminUser>({
    queryKey: ["user", userId],
    queryFn: () => getUserDetail(userId),
  });

  const { data: kycRecord } = useQuery<KycRecord>({
    queryKey: ["kycRecord", userId],
    queryFn: () => getKycRecord(userId),
    enabled: !!userId,
    retry: false,
  });

  const { data: txPage } = useQuery({
    queryKey: ["userTxs", userId],
    queryFn: () => getUserTransactions(userId, 0, 5),
    enabled: !!userId,
    retry: false,
  });

  const userTxs: AdminTransaction[] = txPage?.content ?? [];

  const statusMutation = useMutation({
    mutationFn: () => updateUserStatus(userId, newStatus, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData(["user", userId], updated);
      setStatusModal(false);
      setReason("");
    },
  });

  const roleMutation = useMutation({
    mutationFn: () => {
      const next = user?.role === "ADMIN" ? "USER" : "ADMIN";
      return updateUserRole(userId, next);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["user", userId], updated);
    },
  });

  const limitsMutation = useMutation({
    mutationFn: () => updateUserLimits(
      userId,
      dailyLimit !== "" ? Number(dailyLimit) : null,
      singleLimit !== "" ? Number(singleLimit) : null,
    ),
    onSuccess: (updated) => {
      queryClient.setQueryData(["user", userId], updated);
    },
  });

  useEffect(() => {
    if (user) {
      setDailyLimit(user.customDailyLimitGhs != null ? String(user.customDailyLimitGhs) : "");
      setSingleLimit(user.customSingleTransactionLimitGhs != null ? String(user.customSingleTransactionLimitGhs) : "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-white/40" size={28} /></div>;
  if (error && !user) return (
    <div className="space-y-4">
      <p className="text-red-400">{(error as Error).message}</p>
      <Link href="/users" className="text-white/50 text-sm hover:text-white flex items-center gap-1"><ArrowLeft size={14} /> Back</Link>
    </div>
  );
  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "—";
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/users" className="text-white/40 hover:text-white transition-colors"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-white">{fullName}</h1>
          <p className="text-white/40 text-sm">{user.email}</p>
        </div>
        <button onClick={() => { setNewStatus(user.accountStatus); setStatusModal(true); }}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition-colors">
          Change Status
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium border ${STATUS_COLORS[user.accountStatus] ?? "bg-white/10 text-white/40"}`}>
          {user.accountStatus}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${KYC_COLORS[user.kycStatus] ?? "bg-white/10 text-white/40"}`}>
          KYC: {user.kycStatus.replace(/_/g, " ")}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 ${isAdmin ? "bg-[#B7EE7A]/15 text-[#B7EE7A]" : "bg-white/10 text-white/40"}`}>
          {isAdmin && <Crown size={11} />} {user.role}
        </span>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Wallet</p>
        <p className="text-3xl font-semibold text-white">
          {user.walletCurrency} {Number(user.walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-white/30 text-xs uppercase tracking-wider mb-4">Profile</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Handle" value={user.username ? `@${user.username}` : null} />
          <InfoRow label="Phone" value={user.phone} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Date of Birth" value={user.dateOfBirth} />
          <InfoRow label="Nationality" value={user.nationality} />
          <InfoRow label="City" value={user.city} />
          <InfoRow label="Employment" value={user.employmentStatus} />
          <InfoRow label="Joined" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : null} />
          <InfoRow label="Last Login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : null} />
        </div>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-white/30 text-xs uppercase tracking-wider mb-4">Security</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            {user.twoFactorEnabled ? <ShieldCheck size={16} className="text-emerald-400" /> : <ShieldAlert size={16} className="text-white/30" />}
            <span className="text-sm text-white/70">2FA {user.twoFactorEnabled ? "enabled" : "disabled"}</span>
          </div>
          <div className="flex items-center gap-2">
            {user.biometricsEnabled ? <ShieldCheck size={16} className="text-emerald-400" /> : <ShieldAlert size={16} className="text-white/30" />}
            <span className="text-sm text-white/70">Biometrics {user.biometricsEnabled ? "enabled" : "disabled"}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-white/30 text-xs uppercase tracking-wider mb-4">KYC Documents</p>
        {!kycRecord ? (
          <p className="text-white/20 text-sm">No KYC submission found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div>
                <p className="text-white/30 text-xs mb-1">ID Type</p>
                <p className="text-white text-sm font-medium">{kycRecord.idType ?? "—"}</p>
              </div>
              <div className="ml-6">
                <p className="text-white/30 text-xs mb-1">Status</p>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  KYC_COLORS[kycRecord.status] ?? "bg-white/10 text-white/40"
                } border-transparent`}>
                  {kycRecord.status.replace(/_/g, " ")}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DocImage url={kycRecord.idFrontUrl} label="ID Front" />
              <DocImage url={kycRecord.idBackUrl} label="ID Back" />
              <DocImage url={kycRecord.selfieUrl} label="Selfie" />
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-white/30 text-xs uppercase tracking-wider mb-4">Recent Transactions</p>
        {userTxs.length === 0 ? (
          <p className="text-white/20 text-sm">No transactions found.</p>
        ) : (
          <div className="space-y-1">
            {userTxs.map(tx => {
              const isOutgoing = tx.senderId === userId;
              const counterparty = isOutgoing ? tx.recipientName : tx.senderName;
              const dateStr = tx.initiatedAt
                ? new Date(tx.initiatedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                : "—";
              return (
                <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    isOutgoing ? "bg-red-500/10" : "bg-emerald-500/10"
                  }`}>
                    {isOutgoing
                      ? <ArrowUpRight size={14} className="text-red-400" />
                      : <ArrowDownLeft size={14} className="text-emerald-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{counterparty}</p>
                    <p className="text-white/30 text-xs">{dateStr}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-semibold ${isOutgoing ? "text-red-400" : "text-emerald-400"}`}>
                      {isOutgoing ? "-" : "+"}GHS {Number(tx.amount).toFixed(2)}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                      TX_STATUS_COLORS[tx.status] ?? "bg-white/10 text-white/40 border-white/10"
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-white/30 text-xs uppercase tracking-wider mb-4">Transaction Limits</p>
        <p className="text-white/30 text-xs mb-4">Leave blank to use the platform default.</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Max Daily Transfer</p>
              <p className="text-xs text-white/35 mt-0.5">Maximum total transfers per day</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/40 font-medium">GHS</span>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                placeholder="default"
                className="w-28 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-white/20 transition-colors placeholder-white/20"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div>
              <p className="text-sm font-medium text-white/80">Max Single Transaction</p>
              <p className="text-xs text-white/35 mt-0.5">Maximum amount per transaction</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/40 font-medium">GHS</span>
              <input
                type="number"
                value={singleLimit}
                onChange={(e) => setSingleLimit(e.target.value)}
                placeholder="default"
                className="w-28 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-white/20 transition-colors placeholder-white/20"
              />
            </div>
          </div>
        </div>
        {limitsMutation.error && (
          <p className="text-red-400 text-xs mt-3">{(limitsMutation.error as Error).message}</p>
        )}
        {limitsMutation.isSuccess && (
          <p className="text-emerald-400 text-xs mt-3">Limits saved.</p>
        )}
        <button
          onClick={() => limitsMutation.mutate()}
          disabled={limitsMutation.isPending}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#B7EE7A]/10 text-[#B7EE7A] border border-[#B7EE7A]/20 text-sm font-medium hover:bg-[#B7EE7A]/20 disabled:opacity-50 transition-colors"
        >
          {limitsMutation.isPending && <Loader2 size={14} className="animate-spin" />}
          Save Limits
        </button>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Admin Access</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">{isAdmin ? "This user is an admin" : "Regular user"}</p>
            <p className="text-white/40 text-xs mt-0.5">
              {isAdmin ? "Can access the admin dashboard" : "No admin privileges"}
            </p>
          </div>
          <button
            onClick={() => roleMutation.mutate()}
            disabled={roleMutation.isPending}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${
              isAdmin
                ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                : "bg-[#B7EE7A]/10 text-[#B7EE7A] border border-[#B7EE7A]/20 hover:bg-[#B7EE7A]/20"
            }`}
          >
            {roleMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {isAdmin ? "Revoke Admin" : "Make Admin"}
          </button>
        </div>
      </div>

      {user.kycStatus === "UNDER_REVIEW" && (
        <Link href={`/kyc/${user.id}`}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 text-sm font-medium hover:bg-amber-400/15 transition-colors">
          <ShieldCheck size={16} /> Review KYC Submission
        </Link>
      )}

      {(statusMutation.error || roleMutation.error) && (
        <p className="text-red-400 text-sm">{((statusMutation.error || roleMutation.error) as Error).message}</p>
      )}

      {statusModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-white font-semibold">Change Account Status</h3>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none">
              {["ACTIVE","SUSPENDED","DEACTIVATED"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Reason (optional)" rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none resize-none" />
            <div className="flex gap-3">
              <button onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending || !newStatus}
                className="flex-1 py-2.5 rounded-xl bg-[#B7EE7A] text-black font-semibold text-sm hover:bg-[#B7EE7A]/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {statusMutation.isPending && <Loader2 size={14} className="animate-spin" />} Apply
              </button>
              <button onClick={() => setStatusModal(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
