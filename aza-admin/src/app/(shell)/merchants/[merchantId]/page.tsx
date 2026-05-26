"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMerchantById,
  getMerchantKyb,
  reviewMerchantKyb,
  setMerchantStatus,
  resetUserRateLimit,
  AdminMerchant,
  MerchantKyb,
} from "@/lib/admin-api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Store,
  Ban,
  RefreshCw,
  ExternalLink,
  X,
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
  NOT_SUBMITTED:  { cls: "text-white/40 bg-white/5 border-white/10",                   label: "Not Submitted" },
  SUBMITTED:      { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",             label: "Submitted" },
  UNDER_REVIEW:   { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",             label: "Under Review" },
  APPROVED:       { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",    label: "Approved" },
  REJECTED:       { cls: "text-red-400 bg-red-500/10 border-red-500/20",                label: "Rejected" },
  MORE_INFO_REQUIRED:{ cls: "text-orange-400 bg-orange-500/10 border-orange-500/20",   label: "More Info" },
};

function Badge({ cfg }: { cfg: { cls: string; label: string } }) {
  return <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-white/4 last:border-0">
      <span className="text-sm text-white/40 flex-shrink-0">{label}</span>
      <span className="text-sm text-white text-right">{value ?? "—"}</span>
    </div>
  );
}

type Modal = "kyb_approve" | "kyb_reject" | "kyb_more_info" | "suspend" | "activate" | "reject_merchant" | null;

export default function MerchantDetailPage() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const router = useRouter();

  const [merchant, setMerchant] = useState<AdminMerchant | null>(null);
  const [kyb, setKyb] = useState<MerchantKyb | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [inputText, setInputText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
  const kybReviewable = kyb && ["SUBMITTED", "UNDER_REVIEW"].includes(kyb.status);
  const canSuspend = merchant.status === "ACTIVE";
  const canActivate = merchant.status === "SUSPENDED";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-white">{merchant.businessName}</h1>
            <Badge cfg={statusCfg} />
          </div>
          <p className="text-white/35 text-sm mt-0.5 font-mono">@{merchant.businessHandle}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Business Info */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Store size={16} className="text-white/40" />
            <h2 className="text-sm font-semibold text-white">Business Details</h2>
          </div>
          <div>
            <Field label="Merchant ID" value={<span className="font-mono text-xs text-white/50">{merchant.id}</span>} />
            <Field label="Owner User ID" value={<span className="font-mono text-xs text-white/50">{merchant.userId}</span>} />
            <Field label="Category" value={merchant.category?.replace(/_/g, " ") ?? "—"} />
            <Field label="Email" value={merchant.businessEmail} />
            <Field label="Phone" value={merchant.businessPhone} />
            <Field label="Description" value={merchant.businessDescription} />
            {merchant.activatedAt && <Field label="Activated" value={fmtDate(merchant.activatedAt)} />}
            {merchant.rejectionReason && (
              <Field label="Rejection Reason" value={
                <span className="text-red-400">{merchant.rejectionReason}</span>
              } />
            )}
            {merchant.moreInfoRequest && (
              <Field label="More Info Request" value={
                <span className="text-orange-400">{merchant.moreInfoRequest}</span>
              } />
            )}
          </div>
        </div>

        {/* KYB Info */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} className="text-white/40" />
            <h2 className="text-sm font-semibold text-white">KYB Verification</h2>
            {kyb && (
              <Badge cfg={KYB_STATUS_CFG[kyb.status] ?? { cls: "text-white/40 bg-white/5 border-white/10", label: kyb.status }} />
            )}
          </div>

          {!kyb ? (
            <p className="text-sm text-white/30 py-4 text-center">No KYB data submitted yet</p>
          ) : (
            <div>
              <Field label="Business Type" value={kyb.businessType?.replace(/_/g, " ")} />
              <Field label="Registration No." value={kyb.registrationNumber} />
              <Field label="Tax ID" value={kyb.taxIdNumber} />
              <Field label="Registered Address" value={kyb.registeredAddress} />
              <Field label="City" value={kyb.city} />
              <Field label="Owner Name" value={kyb.ownerFullName} />
              <Field label="Owner ID Type" value={kyb.ownerIdType?.replace(/_/g, " ")} />
              {kyb.submittedAt && <Field label="Submitted" value={fmtDate(kyb.submittedAt)} />}
              {kyb.reviewedAt && <Field label="Reviewed" value={fmtDate(kyb.reviewedAt)} />}

              {kyb.documents && kyb.documents.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] text-white/30 uppercase tracking-wider font-medium">Documents</p>
                  {kyb.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-white/4 rounded-lg px-3 py-2">
                      <span className="text-xs text-white/60">{doc.documentType.replace(/_/g, " ")}</span>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#F5A623] hover:text-[#F5A623]/80 transition-colors"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {kybReviewable && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <button
                    onClick={() => { setModal("kyb_approve"); setInputText(""); }}
                    className="py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-all flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 size={12} /> Approve
                  </button>
                  <button
                    onClick={() => { setModal("kyb_more_info"); setInputText(""); }}
                    className="py-2 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 text-xs font-semibold hover:bg-orange-500/25 transition-all"
                  >
                    More Info
                  </button>
                  <button
                    onClick={() => { setModal("kyb_reject"); setInputText(""); }}
                    className="py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-all flex items-center justify-center gap-1"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Account Actions</h2>
        <div className="flex flex-wrap gap-2">
          {canSuspend && (
            <button
              onClick={() => setModal("suspend")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-all"
            >
              <Ban size={14} /> Suspend
            </button>
          )}
          {canActivate && (
            <button
              onClick={() => setModal("activate")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-all"
            >
              <CheckCircle2 size={14} /> Reactivate
            </button>
          )}
          {!["REJECTED"].includes(merchant.status) && (
            <button
              onClick={() => setModal("reject_merchant")}
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
