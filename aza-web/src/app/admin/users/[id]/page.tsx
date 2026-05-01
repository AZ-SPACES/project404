"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getUserDetail, updateUserStatus, type AdminUser } from "@/lib/admin-api";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display = value === null || value === undefined ? "—" : String(value);
  return (
    <div>
      <p className="text-white/30 text-xs">{label}</p>
      <p className="text-white text-sm mt-0.5">{display}</p>
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

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [reason, setReason] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    getUserDetail(userId)
      .then(setUser)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  async function applyStatus() {
    if (!newStatus) return;
    setUpdating(true);
    try {
      const updated = await updateUserStatus(userId, newStatus, reason);
      setUser(updated);
      setStatusModal(false);
      setReason("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-white/40" size={28} />
    </div>
  );

  if (error) return (
    <div className="space-y-4">
      <p className="text-red-400">{error}</p>
      <Link href="/admin/users" className="text-white/50 text-sm hover:text-white flex items-center gap-1">
        <ArrowLeft size={14} /> Back
      </Link>
    </div>
  );

  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.displayName || "—";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-white">{fullName}</h1>
          <p className="text-white/40 text-sm">{user.email}</p>
        </div>
        <button
          onClick={() => { setNewStatus(user.accountStatus); setStatusModal(true); }}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition-colors"
        >
          Change Status
        </button>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium border ${STATUS_COLORS[user.accountStatus] ?? "bg-white/10 text-white/40"}`}>
          {user.accountStatus}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${KYC_COLORS[user.kycStatus] ?? "bg-white/10 text-white/40"}`}>
          KYC: {user.kycStatus.replace(/_/g, " ")}
        </span>
        <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-white/50">
          {user.role}
        </span>
      </div>

      {/* Wallet */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Wallet</p>
        <p className="text-3xl font-semibold text-white">
          {user.walletCurrency}{" "}
          {Number(user.walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Profile */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-white/30 text-xs uppercase tracking-wider mb-4">Profile</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Handle" value={user.handle ? `@${user.handle}` : null} />
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

      {/* Security */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-white/30 text-xs uppercase tracking-wider mb-4">Security</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            {user.twoFactorEnabled
              ? <ShieldCheck size={16} className="text-emerald-400" />
              : <ShieldAlert size={16} className="text-white/30" />}
            <span className="text-sm text-white/70">2FA {user.twoFactorEnabled ? "enabled" : "disabled"}</span>
          </div>
          <div className="flex items-center gap-2">
            {user.biometricsEnabled
              ? <ShieldCheck size={16} className="text-emerald-400" />
              : <ShieldAlert size={16} className="text-white/30" />}
            <span className="text-sm text-white/70">Biometrics {user.biometricsEnabled ? "enabled" : "disabled"}</span>
          </div>
        </div>
      </div>

      {/* KYC link */}
      {user.kycStatus === "UNDER_REVIEW" && (
        <Link
          href={`/admin/kyc/${user.id}`}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 text-sm font-medium hover:bg-amber-400/15 transition-colors"
        >
          <ShieldCheck size={16} />
          Review KYC Submission
        </Link>
      )}

      {/* Status modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-white font-semibold">Change Account Status</h3>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none"
            >
              {["ACTIVE", "SUSPENDED", "DEACTIVATED"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={applyStatus}
                disabled={updating || !newStatus}
                className="flex-1 py-2.5 rounded-xl bg-[#F5A623] text-black font-semibold text-sm hover:bg-[#F5A623]/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updating && <Loader2 size={14} className="animate-spin" />}
                Apply
              </button>
              <button
                onClick={() => setStatusModal(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
