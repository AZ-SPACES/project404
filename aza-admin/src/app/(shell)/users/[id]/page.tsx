"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUserDetail,
  updateUserStatus,
  isPendingApproval,
  updateUserRole,
  getKycRecord,
  getUserTransactions,
  getUserSessions,
  getUserNotifications,
  getUserRiskHistory,
  getUserRecoveryContacts,
  revokeUserSession,
  updateUserLimits,
  blockDevice,
  downloadUserStatementPdf,
  downloadUserStatementCsv,
  type AdminUser,
  type KycRecord,
  type AdminTransaction,
  type UserSession,
  type UserNotification,
  type FlaggedTx,
  type RecoveryContact,
  type Page,
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
  Smartphone,
  Monitor,
  Bell,
  Ban,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  AlertTriangle,
  PhoneCall,
} from "lucide-react";

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  return (
    <div>
      <p className="text-foreground/30 text-xs">{label}</p>
      <p className="text-foreground text-sm mt-0.5">{value === null || value === undefined ? "—" : String(value)}</p>
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
  NOT_STARTED: "bg-muted/50 text-foreground/40",
};

const TX_STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-green-500/10 text-green-400 border-green-500/20",
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
  CANCELLED: "bg-muted/50 text-foreground/40 border-border",
  DECLINED: "bg-red-500/10 text-red-400 border-red-500/20",
  REVERSED: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function isDesktopOs(os: string | null): boolean {
  if (!os) return false;
  const lower = os.toLowerCase();
  return ["windows", "linux", "mac", "desktop", "web"].some(k => lower.includes(k));
}

function DocImage({ url, label }: { url: string | null; label: string }) {
  const [enlarged, setEnlarged] = useState(false);
  if (!url) return (
    <div className="aspect-video bg-muted/30 rounded-xl flex items-center justify-center text-foreground/20 text-xs border border-border">
      Not provided
    </div>
  );
  return (
    <>
      <div
        className="relative aspect-video bg-muted/30 rounded-xl overflow-hidden cursor-pointer group border border-border"
        onClick={() => setEnlarged(true)}
      >
        <Image src={url} alt={label} fill className="object-cover" unoptimized />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <ZoomIn size={24} className="text-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="absolute bottom-2 left-2 text-xs text-foreground/60 bg-black/50 px-2 py-0.5 rounded">{label}</p>
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
  const [pendingNotice, setPendingNotice] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [reason, setReason] = useState("");

  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [singleLimit, setSingleLimit] = useState<string>("");

  const { data: user, isLoading, error } = useQuery<AdminUser>({
    queryKey: ["user", userId],
    queryFn: () => getUserDetail(userId),
    // Keeps the Online/Last-seen badge current while the page is open.
    refetchInterval: 30_000,
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

  const { data: sessions = [] } = useQuery<UserSession[]>({
    queryKey: ["userSessions", userId],
    queryFn: () => getUserSessions(userId),
    enabled: !!userId,
    retry: false,
    // Online flags track a 65s server-side TTL — keep the panel live.
    refetchInterval: 30_000,
  });

  const [notifPage, setNotifPage] = useState(0);
  const { data: notifications } = useQuery<Page<UserNotification>>({
    queryKey: ["userNotifications", userId, notifPage],
    queryFn: () => getUserNotifications(userId, notifPage, 10),
    enabled: !!userId,
    retry: false,
  });

  const [riskPage, setRiskPage] = useState(0);
  const { data: riskHistory } = useQuery<Page<FlaggedTx>>({
    queryKey: ["userRiskHistory", userId, riskPage],
    queryFn: () => getUserRiskHistory(userId, riskPage, 10),
    enabled: !!userId,
    retry: false,
  });

  const { data: recoveryContacts = [] } = useQuery<RecoveryContact[]>({
    queryKey: ["userRecoveryContacts", userId],
    queryFn: () => getUserRecoveryContacts(userId),
    enabled: !!userId,
    retry: false,
  });

  const today = new Date().toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [stmtFrom, setStmtFrom] = useState(threeMonthsAgo);
  const [stmtTo, setStmtTo] = useState(today);
  const [stmtBusy, setStmtBusy] = useState<"pdf" | "csv" | null>(null);

  async function handleStatementDownload(format: "pdf" | "csv") {
    setStmtBusy(format);
    try {
      if (format === "pdf") {
        await downloadUserStatementPdf(userId, stmtFrom, stmtTo);
      } else {
        await downloadUserStatementCsv(userId, stmtFrom, stmtTo);
      }
    } finally {
      setStmtBusy(null);
    }
  }

  const [revokeTarget, setRevokeTarget] = useState<UserSession | null>(null);
  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeUserSession(userId, sessionId),
    onSuccess: () => {
      setRevokeTarget(null);
      queryClient.invalidateQueries({ queryKey: ["userSessions", userId] });
    },
  });

  const [blockTarget, setBlockTarget] = useState<UserSession | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockToast, setBlockToast] = useState<string | null>(null);
  const blockMutation = useMutation({
    mutationFn: () => blockDevice(blockTarget!.deviceId!, {
      associatedUserId: userId,
      deviceName: blockTarget!.deviceName ?? undefined,
      deviceOs: blockTarget!.deviceOs ?? undefined,
      reason: blockReason || undefined,
    }),
    onSuccess: () => {
      setBlockTarget(null);
      setBlockReason("");
      setBlockToast("Device blocked — session terminated immediately");
      setTimeout(() => setBlockToast(null), 3500);
      queryClient.invalidateQueries({ queryKey: ["userSessions", userId] });
    },
  });

  const userTxs: AdminTransaction[] = txPage?.content ?? [];

  const statusMutation = useMutation({
    mutationFn: () => updateUserStatus(userId, newStatus, reason),
    onSuccess: (updated) => {
      if (isPendingApproval(updated)) {
        // Maker-checker: reactivation needs a second COMPLIANCE/ADMIN
        setPendingNotice("Reactivation submitted — another COMPLIANCE/ADMIN must approve it in Approvals.");
      } else {
        queryClient.setQueryData(["user", userId], updated);
      }
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
      if (isPendingApproval(updated)) {
        // Maker-checker: granting ADMIN needs a second ADMIN
        setPendingNotice("ADMIN grant submitted — another ADMIN must approve it in Approvals.");
        return;
      }
      queryClient.setQueryData(["user", userId], updated);
    },
  });

  const limitsMutation = useMutation({
    mutationFn: () => updateUserLimits(
      userId,
      dailyLimit !== "" ? Number(dailyLimit) : null,
      singleLimit !== "" ? Number(singleLimit) : null,
    ),
    // Maker-checker: limits don't change until a second COMPLIANCE/ADMIN approves.
  });

  useEffect(() => {
    if (user) {
      setDailyLimit(user.customDailyLimitGhs != null ? String(user.customDailyLimitGhs) : "");
      setSingleLimit(user.customSingleTransactionLimitGhs != null ? String(user.customSingleTransactionLimitGhs) : "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-foreground/40" size={28} /></div>;
  if (error && !user) return (
    <div className="space-y-4">
      <p className="text-red-400">{(error as Error).message}</p>
      <Link href="/users" className="text-foreground/50 text-sm hover:text-foreground flex items-center gap-1"><ArrowLeft size={14} /> Back</Link>
    </div>
  );
  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "—";
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-6 max-w-2xl">
      {blockToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm px-4 py-3 rounded-xl shadow-2xl">
          {blockToast}
        </div>
      )}

      {pendingNotice && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-yellow-400 text-sm">
          {pendingNotice}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Link href="/users" className="text-foreground/40 hover:text-foreground transition-colors"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{fullName}</h1>
          <p className="text-foreground/40 text-sm">{user.email}</p>
        </div>
        <button onClick={() => { setNewStatus(user.accountStatus); setStatusModal(true); }}
          className="px-4 py-2 rounded-xl bg-muted/30 border border-border text-foreground/70 text-sm hover:bg-muted transition-colors">
          Change Status
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium border flex items-center gap-1.5 ${
          user.onlineStatus === "ONLINE"
            ? "bg-emerald-400/15 text-emerald-400 border-emerald-400/20"
            : "bg-muted/50 text-foreground/40 border-transparent"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${user.onlineStatus === "ONLINE" ? "bg-emerald-400" : "bg-foreground/30"}`} />
          {user.onlineStatus === "ONLINE" ? "Online" : `Last seen ${relativeTime(user.lastSeenAt)}`}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium border ${STATUS_COLORS[user.accountStatus] ?? "bg-muted/50 text-foreground/40"}`}>
          {user.accountStatus}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${KYC_COLORS[user.kycStatus] ?? "bg-muted/50 text-foreground/40"}`}>
          KYC: {user.kycStatus.replace(/_/g, " ")}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 ${isAdmin ? "bg-[#B7EE7A]/15 text-[#B7EE7A]" : "bg-muted/50 text-foreground/40"}`}>
          {isAdmin && <Crown size={11} />} {user.role}
        </span>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-foreground/30 text-xs uppercase tracking-wider mb-2">Wallet</p>
        <p className="text-3xl font-semibold text-foreground">
          {user.walletCurrency} {Number(user.walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-foreground/30 text-xs uppercase tracking-wider mb-4">Profile</p>
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

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-foreground/30 text-xs uppercase tracking-wider mb-4">Security</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            {user.twoFactorEnabled ? <ShieldCheck size={16} className="text-emerald-400" /> : <ShieldAlert size={16} className="text-foreground/30" />}
            <span className="text-sm text-foreground/70">2FA {user.twoFactorEnabled ? "enabled" : "disabled"}</span>
          </div>
          <div className="flex items-center gap-2">
            {user.biometricsEnabled ? <ShieldCheck size={16} className="text-emerald-400" /> : <ShieldAlert size={16} className="text-foreground/30" />}
            <span className="text-sm text-foreground/70">Biometrics {user.biometricsEnabled ? "enabled" : "disabled"}</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-foreground/30 text-xs uppercase tracking-wider">Active Sessions</p>
          <span className="text-xs text-foreground/40">{sessions.length} device{sessions.length === 1 ? "" : "s"}</span>
        </div>
        {sessions.length === 0 ? (
          <p className="text-foreground/20 text-sm">No active sessions.</p>
        ) : (
          <div className="space-y-1">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center text-foreground/50">
                  {isDesktopOs(s.deviceOs) ? <Monitor size={15} /> : <Smartphone size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">
                    {s.deviceName ?? s.deviceOs ?? "Unknown device"}
                  </p>
                  <p className="text-foreground/35 text-xs truncate">
                    {s.location ?? s.ipAddress ?? "Unknown location"}
                    {s.deviceOs ? ` · ${s.deviceOs}` : ""}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-xs flex-shrink-0">
                  <span className={`w-2 h-2 rounded-full ${s.online ? "bg-emerald-400" : "bg-foreground/15"}`} />
                  <span className={s.online ? "text-emerald-400 font-medium" : "text-foreground/40"}>
                    {s.online ? "Online" : relativeTime(s.lastUsedAt)}
                  </span>
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {s.deviceId && (
                    <button
                      onClick={() => { setBlockTarget(s); setBlockReason(""); }}
                      title="Block this device across the platform"
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                    >
                      <Ban size={10} /> Block
                    </button>
                  )}
                  <button onClick={() => setRevokeTarget(s)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {revokeMutation.error && (
          <p className="text-red-400 text-xs mt-3">{(revokeMutation.error as Error).message}</p>
        )}
      </div>

      {revokeTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-foreground font-semibold">Revoke session</h3>
            <p className="text-foreground/50 text-sm">
              Sign out <span className="text-foreground">{revokeTarget.deviceName ?? revokeTarget.deviceOs ?? "this device"}</span>?
              The device is logged out immediately and must sign in again.
            </p>
            <div className="flex gap-3">
              <button onClick={() => revokeMutation.mutate(revokeTarget.id)} disabled={revokeMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500/90 text-white font-semibold text-sm hover:bg-red-500 disabled:opacity-50 flex items-center justify-center gap-2">
                {revokeMutation.isPending && <Loader2 size={14} className="animate-spin" />} Revoke
              </button>
              <button onClick={() => setRevokeTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {blockTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-foreground font-semibold flex items-center gap-2">
              <Ban size={16} className="text-amber-400" /> Block Device
            </h3>
            <div className="bg-muted/20 border border-border rounded-xl p-3 text-sm">
              <p className="text-foreground font-medium">{blockTarget.deviceName ?? blockTarget.deviceOs ?? "Unknown device"}</p>
              {blockTarget.deviceOs && <p className="text-foreground/40 text-xs mt-0.5">{blockTarget.deviceOs}</p>}
            </div>
            <p className="text-foreground/50 text-sm">
              This blocks the device platform-wide — not just this user's session. Any account logged in on this device will be signed out immediately and cannot log back in.
            </p>
            <div>
              <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wider block mb-2">Reason (optional)</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Fraud, account takeover, compromised device…"
                rows={2}
                className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none"
              />
            </div>
            {blockMutation.error && (
              <p className="text-red-400 text-xs">{(blockMutation.error as Error).message}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => blockMutation.mutate()}
                disabled={blockMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 font-semibold text-sm hover:bg-amber-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {blockMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                Block Device
              </button>
              <button onClick={() => setBlockTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-foreground/30 text-xs uppercase tracking-wider mb-4">KYC Documents</p>
        {!kycRecord ? (
          <p className="text-foreground/20 text-sm">No KYC submission found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div>
                <p className="text-foreground/30 text-xs mb-1">ID Type</p>
                <p className="text-foreground text-sm font-medium">{kycRecord.idType ?? "—"}</p>
              </div>
              <div className="ml-6">
                <p className="text-foreground/30 text-xs mb-1">Status</p>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  KYC_COLORS[kycRecord.status] ?? "bg-muted/50 text-foreground/40"
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

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-foreground/30 text-xs uppercase tracking-wider mb-4">Recent Transactions</p>
        {userTxs.length === 0 ? (
          <p className="text-foreground/20 text-sm">No transactions found.</p>
        ) : (
          <div className="space-y-1">
            {userTxs.map(tx => {
              const isOutgoing = tx.senderId === userId;
              const counterparty = isOutgoing ? tx.recipientName : tx.senderName;
              const dateStr = tx.initiatedAt
                ? new Date(tx.initiatedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                : "—";
              return (
                <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    isOutgoing ? "bg-red-500/10" : "bg-emerald-500/10"
                  }`}>
                    {isOutgoing
                      ? <ArrowUpRight size={14} className="text-red-400" />
                      : <ArrowDownLeft size={14} className="text-emerald-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">{counterparty}</p>
                    <p className="text-foreground/30 text-xs">{dateStr}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-semibold ${isOutgoing ? "text-red-400" : "text-emerald-400"}`}>
                      {isOutgoing ? "-" : "+"}GHS {Number(tx.amount).toFixed(2)}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                      TX_STATUS_COLORS[tx.status] ?? "bg-muted/50 text-foreground/40 border-border"
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

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-foreground/30 text-xs uppercase tracking-wider mb-4">Transaction Limits</p>
        <p className="text-foreground/30 text-xs mb-4">Leave blank to use the platform default.</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground/80">Max Daily Transfer</p>
              <p className="text-xs text-foreground/35 mt-0.5">Maximum total transfers per day</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-foreground/40 font-medium">GHS</span>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                placeholder="default"
                className="w-28 bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground text-right focus:outline-none focus:border-foreground/20 transition-colors placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground/80">Max Single Transaction</p>
              <p className="text-xs text-foreground/35 mt-0.5">Maximum amount per transaction</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-foreground/40 font-medium">GHS</span>
              <input
                type="number"
                value={singleLimit}
                onChange={(e) => setSingleLimit(e.target.value)}
                placeholder="default"
                className="w-28 bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground text-right focus:outline-none focus:border-foreground/20 transition-colors placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
        </div>
        {limitsMutation.error && (
          <p className="text-red-400 text-xs mt-3">{(limitsMutation.error as Error).message}</p>
        )}
        {limitsMutation.isSuccess && (
          <p className="text-emerald-400 text-xs mt-3">
            Submitted — another COMPLIANCE/ADMIN staff member must approve in Approvals.
          </p>
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

      {/* Statement Generator */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={14} className="text-foreground/30" />
          <p className="text-foreground/30 text-xs uppercase tracking-wider">Generate Statement</p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-foreground/40 block mb-1">From</label>
            <input type="date" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)}
              className="bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-foreground/40 block mb-1">To</label>
            <input type="date" value={stmtTo} onChange={e => setStmtTo(e.target.value)}
              className="bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none" />
          </div>
          <button onClick={() => handleStatementDownload("pdf")} disabled={!!stmtBusy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#B7EE7A]/10 text-[#B7EE7A] border border-[#B7EE7A]/20 text-sm font-medium hover:bg-[#B7EE7A]/20 disabled:opacity-50 transition-colors">
            {stmtBusy === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            PDF
          </button>
          <button onClick={() => handleStatementDownload("csv")} disabled={!!stmtBusy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/30 border border-border text-foreground/70 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            {stmtBusy === "csv" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            CSV
          </button>
        </div>
      </div>

      {/* Risk History */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={14} className="text-foreground/30" />
          <p className="text-foreground/30 text-xs uppercase tracking-wider">Risk History</p>
        </div>
        {!riskHistory || riskHistory.content.length === 0 ? (
          <p className="text-foreground/40 text-sm py-2 text-center">No flagged transactions for this user.</p>
        ) : (
          <div className="space-y-1">
            {riskHistory.content.map((f) => (
              <div key={f.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                <div className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg ${
                  f.riskScore >= 80 ? "bg-red-500/15 text-red-400" :
                  f.riskScore >= 50 ? "bg-amber-500/15 text-amber-400" :
                  "bg-yellow-500/10 text-yellow-400"
                }`}>{f.riskScore}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium">GHS {Number(f.amount).toFixed(2)}</p>
                  <p className="text-foreground/50 text-xs mt-0.5 truncate">{f.flagReason}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    f.status === "CLEARED" ? "bg-emerald-500/10 text-emerald-400" :
                    f.status === "REPORTED" ? "bg-red-500/10 text-red-400" :
                    "bg-amber-500/10 text-amber-400"
                  }`}>{f.status.replace("_", " ")}</span>
                  <span className="text-[10px] text-foreground/25">{new Date(f.flaggedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {riskHistory.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setRiskPage(p => p - 1)} disabled={riskPage === 0}
                  className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-foreground/40">{riskPage + 1} / {riskHistory.totalPages}</span>
                <button onClick={() => setRiskPage(p => p + 1)} disabled={riskPage >= riskHistory.totalPages - 1}
                  className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <PhoneCall size={14} className="text-foreground/30" />
          <p className="text-foreground/30 text-xs uppercase tracking-wider">Recovery Contacts</p>
        </div>
        {recoveryContacts.length === 0 ? (
          <p className="text-foreground/40 text-sm py-2 text-center">No recovery contacts on file.</p>
        ) : (
          <div className="space-y-1">
            {recoveryContacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-mono">{c.contactUserId}</p>
                  <p className="text-foreground/30 text-xs mt-0.5">Added {new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  c.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  c.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                  "bg-muted/50 text-foreground/40 border-border"
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={14} className="text-foreground/30" />
          <p className="text-foreground/30 text-xs uppercase tracking-wider">Notification History</p>
        </div>
        {!notifications || notifications.content.length === 0 ? (
          <p className="text-foreground/40 text-sm py-2 text-center">No notifications sent to this user.</p>
        ) : (
          <div className="space-y-2">
            {notifications.content.map((n) => (
              <div key={n.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.isRead ? "bg-foreground/20" : "bg-[#B7EE7A]"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground font-medium leading-snug">{n.title}</p>
                  <p className="text-xs text-foreground/50 mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-[10px] text-foreground/25 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {notifications.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setNotifPage(p => p - 1)}
                  disabled={notifPage === 0}
                  className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-foreground/40">{notifPage + 1} / {notifications.totalPages}</span>
                <button
                  onClick={() => setNotifPage(p => p + 1)}
                  disabled={notifPage >= notifications.totalPages - 1}
                  className="p-1.5 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-foreground/30 text-xs uppercase tracking-wider mb-3">Admin Access</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-foreground text-sm font-medium">{isAdmin ? "This user is an admin" : "Regular user"}</p>
            <p className="text-foreground/40 text-xs mt-0.5">
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
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-foreground font-semibold">Change Account Status</h3>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-muted/30 border border-border text-foreground text-sm focus:outline-none">
              {["ACTIVE","SUSPENDED","DEACTIVATED"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Reason (optional)" rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none resize-none" />
            <div className="flex gap-3">
              <button onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending || !newStatus}
                className="flex-1 py-2.5 rounded-xl bg-[#B7EE7A] text-black font-semibold text-sm hover:bg-[#B7EE7A]/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {statusMutation.isPending && <Loader2 size={14} className="animate-spin" />} Apply
              </button>
              <button onClick={() => setStatusModal(false)}
                className="px-4 py-2.5 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
