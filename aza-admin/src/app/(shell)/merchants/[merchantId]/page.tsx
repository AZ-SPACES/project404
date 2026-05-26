"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMerchantById,
  getMerchantKyb,
  reviewMerchantKyb,
  setMerchantStatus,
  updateMerchantFeeRate,
  getMerchantPayouts,
  getMerchantSessions,
  resetUserRateLimit,
  AdminMerchant,
  MerchantKyb,
  MerchantPayout,
  MerchantSession,
  Page,
} from "@/lib/admin-api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Key,
  Webhook,
  User,
  ShieldCheck,
  Store,
  Ban,
  RefreshCw,
  ExternalLink,
  X,
  Percent,
  CreditCard,
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

function fmtAmount(n: number, currency = "GHS") {
  return `${currency === "GHS" ? "GH₵" : currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtFee(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

function fmtBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  ACTIVE:            { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Active" },
  PENDING_KYB:       { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",       label: "Pending KYB" },
  KYB_SUBMITTED:     { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",           label: "KYB Submitted" },
  KYB_UNDER_REVIEW:  { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",           label: "Under Review" },
  MORE_INFO_REQUIRED:{ cls: "text-orange-400 bg-orange-500/10 border-orange-500/20",    label: "More Info Needed" },
  SUSPENDED:         { cls: "text-red-400 bg-red-500/10 border-red-500/20",              label: "Suspended" },
  REJECTED:          { cls: "text-red-400 bg-red-500/10 border-red-500/20",              label: "Rejected" },
};

const KYB_STATUS_CFG: Record<string, { cls: string; label: string }> = {
  PENDING:            { cls: "text-white/40 bg-white/5 border-white/10",                 label: "Pending" },
  SUBMITTED:          { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",          label: "Submitted" },
  UNDER_REVIEW:       { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",          label: "Under Review" },
  APPROVED:           { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Approved" },
  REJECTED:           { cls: "text-red-400 bg-red-500/10 border-red-500/20",             label: "Rejected" },
  MORE_INFO_REQUIRED: { cls: "text-orange-400 bg-orange-500/10 border-orange-500/20",   label: "More Info" },
};

const SESSION_STATUS_CFG: Record<string, { cls: string; label: string }> = {
  PENDING:   { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",      label: "Pending" },
  COMPLETED: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",label: "Completed" },
  EXPIRED:   { cls: "text-white/35 bg-white/5 border-white/10",                label: "Expired" },
  CANCELLED: { cls: "text-red-400 bg-red-500/10 border-red-500/20",            label: "Cancelled" },
};

const PAYOUT_STATUS_CFG: Record<string, { cls: string; label: string }> = {
  PENDING:   { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20",      label: "Pending" },
  COMPLETED: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",label: "Completed" },
  FAILED:    { cls: "text-red-400 bg-red-500/10 border-red-500/20",            label: "Failed" },
};

function Badge({ cfg }: { cfg: { cls: string; label: string } }) {
  return <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

function SmBadge({ cfg }: { cfg: { cls: string; label: string } }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-white/4 last:border-0">
      <span className="text-sm text-white/40 flex-shrink-0">{label}</span>
      <span className="text-sm text-white text-right">{value ?? "—"}</span>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex justify-between items-center gap-4 py-2.5 border-b border-white/4 last:border-0">
      <span className="text-sm text-white/40 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-mono text-white/50 truncate max-w-[180px]">{value}</span>
        <button onClick={copy} className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0">
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}

type Modal = "kyb_approve" | "kyb_reject" | "kyb_more_info" | "suspend" | "activate" | "reject_merchant" | "fee_rate" | null;
type Tab = "overview" | "kyb" | "payouts" | "sessions";

export default function MerchantDetailPage() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const router = useRouter();

  const [merchant, setMerchant] = useState<AdminMerchant | null>(null);
  const [kyb, setKyb] = useState<MerchantKyb | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [inputText, setInputText] = useState("");
  const [feeInput, setFeeInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  // Payouts tab state
  const [payouts, setPayouts] = useState<Page<MerchantPayout> | null>(null);
  const [payoutsPage, setPayoutsPage] = useState(0);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  // Sessions tab state
  const [sessions, setSessions] = useState<Page<MerchantSession> | null>(null);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, k] = await Promise.all([
        getMerchantById(merchantId),
        getMerchantKyb(merchantId).catch(() => null),
      ]);
      setMerchant(m);
      setKyb(k);
    } catch (e: any) {
      setError(e.message ?? "Failed to load merchant");
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => { load(); }, [load]);

  // Auto-switch to KYB tab when the merchant needs review action
  useEffect(() => {
    if (merchant && ["KYB_UNDER_REVIEW", "KYB_SUBMITTED", "MORE_INFO_REQUIRED"].includes(merchant.status)) {
      setTab("kyb");
    }
  }, [merchant?.status]);

  const loadPayouts = useCallback(async (p: number) => {
    setPayoutsLoading(true);
    try {
      const res = await getMerchantPayouts(merchantId, p);
      setPayouts(res);
      setPayoutsPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load payouts");
    } finally {
      setPayoutsLoading(false);
    }
  }, [merchantId]);

  const loadSessions = useCallback(async (p: number) => {
    setSessionsLoading(true);
    try {
      const res = await getMerchantSessions(merchantId, p);
      setSessions(res);
      setSessionsPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    if (tab === "payouts" && !payouts) loadPayouts(0);
    if (tab === "sessions" && !sessions) loadSessions(0);
  }, [tab, payouts, sessions, loadPayouts, loadSessions]);

  const handleKybReview = async (approve: boolean, rejectionReason?: string, moreInfoRequest?: string) => {
    setActionLoading(true);
    try {
      const updated = await reviewMerchantKyb(merchantId, approve, rejectionReason, moreInfoRequest);
      setKyb(updated);
      setModal(null);
      setInputText("");
      showToast(approve ? "KYB approved — merchant activated" : "KYB decision saved");
      load();
    } catch (e: any) {
      setError(e.message ?? "KYB review failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setActionLoading(true);
    try {
      const updated = await setMerchantStatus(merchantId, status);
      setMerchant(updated);
      setModal(null);
      setInputText("");
      showToast(`Merchant status set to ${status.toLowerCase()}`);
    } catch (e: any) {
      setError(e.message ?? "Status change failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFeeRateUpdate = async () => {
    const bps = Math.round(parseFloat(feeInput) * 100);
    if (isNaN(bps) || bps < 0 || bps > 10000) {
      setError("Enter a valid fee rate between 0% and 100%");
      return;
    }
    setActionLoading(true);
    try {
      const updated = await updateMerchantFeeRate(merchantId, bps);
      setMerchant(updated);
      setModal(null);
      setFeeInput("");
      showToast(`Fee rate updated to ${fmtFee(bps)}`);
    } catch (e: any) {
      setError(e.message ?? "Fee rate update failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetRateLimit = async () => {
    if (!merchant) return;
    try {
      await resetUserRateLimit(merchant.userId);
      showToast("Rate limits cleared for merchant's user account");
    } catch (e: any) {
      setError(e.message ?? "Failed to reset rate limits");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-white/30" size={24} />
      </div>
    );
  }

  if (error && !merchant) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{error}
        </div>
      </div>
    );
  }

  if (!merchant) return null;

  const statusCfg = STATUS_CFG[merchant.status] ?? { cls: "text-white/40 bg-white/5 border-white/10", label: merchant.status };
  const kybReviewable = kyb && !["APPROVED", "PENDING"].includes(kyb.status) && kyb.ownerFullName != null;
  const canSuspend = merchant.status === "ACTIVE";
  const canActivate = merchant.status === "SUSPENDED";

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Store },
    { id: "kyb", label: "KYB", icon: ShieldCheck },
    { id: "payouts", label: "Payouts", icon: ArrowDownToLine },
    { id: "sessions", label: "Sessions", icon: CreditCard },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm px-4 py-3 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {merchant.logoUrl && (
            <img
              src={merchant.logoUrl}
              alt={merchant.businessName}
              className="w-10 h-10 rounded-xl object-cover border border-white/10 flex-shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-white truncate">{merchant.businessName}</h1>
              <Badge cfg={statusCfg} />
            </div>
            <p className="text-white/35 text-sm mt-0.5 font-mono">@{merchant.businessHandle}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Balance", value: fmtAmount(merchant.balance, merchant.currency), color: "text-white" },
          { label: "Total Volume", value: fmtAmount(merchant.totalVolume, merchant.currency), color: "text-emerald-400" },
          { label: "Platform Fee", value: fmtFee(merchant.feeRateBps), color: "text-[#F5A623]" },
          { label: "Created", value: fmtDate(merchant.createdAt).split(",")[0], color: "text-white/60" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#161616] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium mb-1">{label}</p>
            <p className={`text-lg font-semibold ${color} truncate`}>{value}</p>
          </div>
        ))}
      </div>

      {/* KYB action banner — shown regardless of active tab */}
      {kybReviewable && tab !== "kyb" && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-amber-400 flex-shrink-0" />
            <span className="text-sm text-amber-300">
              KYB submission awaiting review
              {kyb?.status === "MORE_INFO_REQUIRED" && " — merchant responded to info request"}
            </span>
          </div>
          <button
            onClick={() => setTab("kyb")}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-all"
          >
            <CheckCircle2 size={12} /> Review KYB
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? "bg-[#F5A623] text-black" : "text-white/50 hover:text-white"
            }`}
          >
            <Icon size={14} />
            {label}
            {id === "kyb" && kybReviewable && tab !== "kyb" && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Business Info */}
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Store size={16} className="text-white/40" />
                <h2 className="text-sm font-semibold text-white">Business Details</h2>
              </div>
              <CopyField label="Merchant ID" value={merchant.id} />
              <div className="flex justify-between items-center gap-4 py-2.5 border-b border-white/4">
                <span className="text-sm text-white/40 flex-shrink-0">Owner</span>
                <button
                  onClick={() => router.push(`/users/${merchant.userId}`)}
                  className="flex items-center gap-1.5 text-xs text-[#F5A623] hover:underline font-mono"
                >
                  <User size={11} />
                  {merchant.userId.slice(0, 8)}…
                </button>
              </div>
              <Field label="Category" value={merchant.category?.replace(/_/g, " ") ?? "—"} />
              <Field label="Email" value={merchant.businessEmail} />
              <Field label="Phone" value={merchant.businessPhone} />
              <Field label="Description" value={merchant.businessDescription} />
              {merchant.activatedAt && <Field label="Activated" value={fmtDate(merchant.activatedAt)} />}

              {/* API Keys & Webhooks */}
              {(merchant.activeApiKeyCount != null || merchant.activeWebhookCount != null) && (
                <div className="mt-3 pt-3 border-t border-white/4 grid grid-cols-2 gap-2">
                  <div className="bg-white/4 rounded-xl px-3 py-2.5 text-center">
                    <Key size={13} className="text-white/30 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-white">{merchant.activeApiKeyCount ?? 0}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">API Keys</p>
                  </div>
                  <div className="bg-white/4 rounded-xl px-3 py-2.5 text-center">
                    <Webhook size={13} className="text-white/30 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-white">{merchant.activeWebhookCount ?? 0}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Webhooks</p>
                  </div>
                </div>
              )}

              {merchant.rejectionReason && (
                <div className="mt-3 bg-red-500/8 border border-red-500/15 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-red-400/70 uppercase tracking-wider font-medium mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-400">{merchant.rejectionReason}</p>
                </div>
              )}
              {merchant.moreInfoRequest && (
                <div className="mt-3 bg-orange-500/8 border border-orange-500/15 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-orange-400/70 uppercase tracking-wider font-medium mb-1">More Info Requested</p>
                  <p className="text-sm text-orange-300">{merchant.moreInfoRequest}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white mb-3">Account Actions</h2>
                <div className="flex flex-wrap gap-2">
                  {canSuspend && (
                    <button
                      onClick={() => { setModal("suspend"); setInputText(""); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-all"
                    >
                      <Ban size={14} /> Suspend
                    </button>
                  )}
                  {canActivate && (
                    <button
                      onClick={() => { setModal("activate"); setInputText(""); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-all"
                    >
                      <CheckCircle2 size={14} /> Reactivate
                    </button>
                  )}
                  {merchant.status !== "REJECTED" && (
                    <button
                      onClick={() => { setModal("reject_merchant"); setInputText(""); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/15 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-all"
                    >
                      <XCircle size={14} /> Reject Account
                    </button>
                  )}
                  <button
                    onClick={handleResetRateLimit}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-medium hover:bg-white/10 hover:text-white transition-all"
                  >
                    <RefreshCw size={14} /> Reset Rate Limits
                  </button>
                </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                <h2 className="text-sm font-semibold text-white mb-3">Fee Rate</h2>
                <div className="flex items-center justify-between bg-white/4 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-white/35 mb-0.5">Current rate</p>
                    <p className="text-lg font-semibold text-[#F5A623]">{fmtFee(merchant.feeRateBps)}</p>
                  </div>
                  <button
                    onClick={() => { setModal("fee_rate"); setFeeInput((merchant.feeRateBps / 100).toFixed(2)); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F5A623]/15 border border-[#F5A623]/25 text-[#F5A623] text-xs font-semibold hover:bg-[#F5A623]/25 transition-all"
                  >
                    <Percent size={12} /> Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── KYB TAB ── */}
      {tab === "kyb" && (
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck size={16} className="text-white/40" />
            <h2 className="text-sm font-semibold text-white">KYB Verification</h2>
            {kyb && (
              <Badge cfg={KYB_STATUS_CFG[kyb.status] ?? { cls: "text-white/40 bg-white/5 border-white/10", label: kyb.status }} />
            )}
          </div>

          {!kyb ? (
            <p className="text-sm text-white/30 py-8 text-center">No KYB data submitted yet</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <p className="text-[11px] text-white/30 uppercase tracking-wider font-medium mb-2">Business Information</p>
                <Field label="Business Type" value={kyb.businessType?.replace(/_/g, " ")} />
                <Field label="Registration No." value={kyb.registrationNumber} />
                <Field label="Tax ID" value={kyb.taxIdNumber} />
                <Field label="Registered Address" value={kyb.registeredAddress} />
                <Field label="City" value={kyb.city} />
                {kyb.website && (
                  <Field label="Website" value={
                    <a href={kyb.website} target="_blank" rel="noopener noreferrer" className="text-[#F5A623] hover:underline flex items-center gap-1">
                      {kyb.website} <ExternalLink size={11} />
                    </a>
                  } />
                )}
                {kyb.submittedAt && <Field label="Submitted" value={fmtDate(kyb.submittedAt)} />}
                {kyb.reviewedAt && <Field label="Reviewed" value={fmtDate(kyb.reviewedAt)} />}
                {kyb.rejectionReason && (
                  <Field label="Rejection Reason" value={<span className="text-red-400">{kyb.rejectionReason}</span>} />
                )}
                {kyb.moreInfoRequest && (
                  <Field label="More Info Request" value={<span className="text-orange-400">{kyb.moreInfoRequest}</span>} />
                )}
              </div>

              <div>
                <p className="text-[11px] text-white/30 uppercase tracking-wider font-medium mb-2">Owner / Director</p>
                <Field label="Full Name" value={kyb.ownerFullName} />
                <Field label="ID Type" value={kyb.ownerIdType?.replace(/_/g, " ")} />

                {kyb.documents && kyb.documents.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] text-white/30 uppercase tracking-wider font-medium mb-2">Documents</p>
                    <div className="space-y-2">
                      {kyb.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between bg-white/4 rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {doc.mimeType === "application/pdf"
                              ? <FileText size={14} className="text-white/40 flex-shrink-0" />
                              : <ImageIcon size={14} className="text-white/40 flex-shrink-0" />
                            }
                            <div className="min-w-0">
                              <p className="text-xs text-white/70 font-medium">{doc.type.replace(/_/g, " ")}</p>
                              {doc.fileName && <p className="text-[10px] text-white/30 truncate">{doc.fileName}</p>}
                              {doc.fileSizeBytes && <p className="text-[10px] text-white/25">{fmtBytes(doc.fileSizeBytes)}</p>}
                            </div>
                          </div>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="ml-3 flex items-center gap-1 text-[#F5A623] hover:text-[#F5A623]/80 text-xs transition-colors flex-shrink-0"
                          >
                            View <ExternalLink size={11} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {kybReviewable && (
            <div className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-white/5">
              <button
                onClick={() => { setModal("kyb_approve"); setInputText(""); }}
                className="py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={14} /> Approve
              </button>
              <button
                onClick={() => { setModal("kyb_more_info"); setInputText(""); }}
                className="py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 text-sm font-semibold hover:bg-orange-500/25 transition-all"
              >
                More Info
              </button>
              <button
                onClick={() => { setModal("kyb_reject"); setInputText(""); }}
                className="py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PAYOUTS TAB ── */}
      {tab === "payouts" && (
        <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownToLine size={15} className="text-white/40" />
              <h2 className="text-sm font-semibold text-white">Payout History</h2>
              {payouts && <span className="text-xs text-white/30">{payouts.totalElements} total</span>}
            </div>
            {payoutsLoading && <Loader2 size={14} className="animate-spin text-white/30" />}
          </div>

          {!payouts && payoutsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-white/30" size={20} />
            </div>
          ) : payouts?.content.length === 0 ? (
            <p className="text-center text-white/25 text-sm py-16">No payouts yet</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden md:table-cell">Note</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Requested</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden lg:table-cell">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {payouts?.content.map((p) => {
                    const sc = PAYOUT_STATUS_CFG[p.status] ?? { cls: "text-white/40 bg-white/5 border-white/10", label: p.status };
                    return (
                      <tr key={p.id} className="hover:bg-white/2">
                        <td className="px-5 py-3.5 font-mono font-semibold text-white">{fmtAmount(p.amount, p.currency)}</td>
                        <td className="px-5 py-3.5"><SmBadge cfg={sc} /></td>
                        <td className="px-5 py-3.5 text-white/45 text-xs hidden md:table-cell">{p.note ?? "—"}</td>
                        <td className="px-5 py-3.5 text-right text-white/35 text-xs">{fmtDate(p.requestedAt)}</td>
                        <td className="px-5 py-3.5 text-right text-white/35 text-xs hidden lg:table-cell">{fmtDate(p.completedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {payouts && payouts.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-white/5">
                  <button onClick={() => loadPayouts(payoutsPage - 1)} disabled={payoutsPage === 0 || payoutsLoading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-white/40">{payoutsPage + 1} / {payouts.totalPages}</span>
                  <button onClick={() => loadPayouts(payoutsPage + 1)} disabled={payoutsPage >= payouts.totalPages - 1 || payoutsLoading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SESSIONS TAB ── */}
      {tab === "sessions" && (
        <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-white/40" />
              <h2 className="text-sm font-semibold text-white">Checkout Sessions</h2>
              {sessions && <span className="text-xs text-white/30">{sessions.totalElements} total</span>}
            </div>
            {sessionsLoading && <Loader2 size={14} className="animate-spin text-white/30" />}
          </div>

          {!sessions && sessionsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-white/30" size={20} />
            </div>
          ) : sessions?.content.length === 0 ? (
            <p className="text-center text-white/25 text-sm py-16">No checkout sessions yet</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden md:table-cell">Description</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden lg:table-cell">Fee</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {sessions?.content.map((s) => {
                    const sc = SESSION_STATUS_CFG[s.status] ?? { cls: "text-white/40 bg-white/5 border-white/10", label: s.status };
                    return (
                      <tr key={s.id} className="hover:bg-white/2">
                        <td className="px-5 py-3.5 font-mono font-semibold text-white">{fmtAmount(s.amount, s.currency)}</td>
                        <td className="px-5 py-3.5"><SmBadge cfg={sc} /></td>
                        <td className="px-5 py-3.5 text-white/45 text-xs hidden md:table-cell max-w-[200px] truncate">{s.description ?? "—"}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-white/40 hidden lg:table-cell">
                          {s.platformFee != null ? fmtAmount(s.platformFee, s.currency) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right text-white/35 text-xs">{fmtDate(s.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {sessions && sessions.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 px-5 py-4 border-t border-white/5">
                  <button onClick={() => loadSessions(sessionsPage - 1)} disabled={sessionsPage === 0 || sessionsLoading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-white/40">{sessionsPage + 1} / {sessions.totalPages}</span>
                  <button onClick={() => loadSessions(sessionsPage + 1)} disabled={sessionsPage >= sessions.totalPages - 1 || sessionsLoading} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModal(null)} />
          <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white">
                {modal === "kyb_approve" && "Approve KYB"}
                {modal === "kyb_reject" && "Reject KYB"}
                {modal === "kyb_more_info" && "Request More Information"}
                {modal === "suspend" && "Suspend Merchant"}
                {modal === "activate" && "Reactivate Merchant"}
                {modal === "reject_merchant" && "Reject Merchant Account"}
                {modal === "fee_rate" && "Update Fee Rate"}
              </h3>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>

            {modal === "kyb_approve" && (
              <>
                <p className="text-sm text-white/50 mb-6">
                  This will approve the KYB application and activate the merchant's business account.
                </p>
                <button
                  onClick={() => handleKybReview(true)}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Confirm Approval
                </button>
              </>
            )}

            {modal === "fee_rate" && (
              <>
                <p className="text-sm text-white/50 mb-4">
                  Current rate: <span className="text-[#F5A623] font-semibold">{fmtFee(merchant.feeRateBps)}</span>
                </p>
                <div className="mb-5">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">New Rate (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={feeInput}
                      onChange={(e) => setFeeInput(e.target.value)}
                      placeholder="e.g. 1.50"
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">%</span>
                  </div>
                  <p className="text-[11px] text-white/25 mt-1.5">
                    {feeInput && !isNaN(parseFloat(feeInput)) ? `= ${Math.round(parseFloat(feeInput) * 100)} bps` : "Enter a value between 0 and 100"}
                  </p>
                </div>
                <button
                  onClick={handleFeeRateUpdate}
                  disabled={actionLoading || !feeInput}
                  className="w-full py-3 rounded-xl bg-[#F5A623]/20 border border-[#F5A623]/30 text-[#F5A623] font-semibold hover:bg-[#F5A623]/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Percent size={16} />}
                  Update Fee Rate
                </button>
              </>
            )}

            {(modal === "kyb_reject" || modal === "kyb_more_info" || modal === "suspend" || modal === "activate" || modal === "reject_merchant") && (
              <>
                <div className="mb-5">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">
                    {modal === "kyb_more_info" ? "What information is needed?" : "Reason"}
                    {modal !== "activate" && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      modal === "kyb_more_info"
                        ? "Describe what additional documents or info is required…"
                        : modal === "activate"
                        ? "Optional note…"
                        : "Provide a reason…"
                    }
                    rows={3}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20 resize-none"
                  />
                </div>

                {modal === "kyb_reject" && (
                  <button
                    onClick={() => handleKybReview(false, inputText, undefined)}
                    disabled={actionLoading || !inputText.trim()}
                    className="w-full py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                    Reject KYB
                  </button>
                )}

                {modal === "kyb_more_info" && (
                  <button
                    onClick={() => handleKybReview(false, undefined, inputText)}
                    disabled={actionLoading || !inputText.trim()}
                    className="w-full py-3 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 font-semibold hover:bg-orange-500/25 disabled:opacity-50 transition-all"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : "Send Request"}
                  </button>
                )}

                {modal === "suspend" && (
                  <button
                    onClick={() => handleStatusChange("SUSPENDED")}
                    disabled={actionLoading || !inputText.trim()}
                    className="w-full py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                    Suspend Merchant
                  </button>
                )}

                {modal === "activate" && (
                  <button
                    onClick={() => handleStatusChange("ACTIVE")}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Reactivate Merchant
                  </button>
                )}

                {modal === "reject_merchant" && (
                  <button
                    onClick={() => handleStatusChange("REJECTED")}
                    disabled={actionLoading || !inputText.trim()}
                    className="w-full py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                    Reject Account
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
