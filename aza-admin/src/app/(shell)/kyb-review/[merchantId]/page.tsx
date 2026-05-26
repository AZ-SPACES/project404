"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getMerchantById,
  getMerchantKyb,
  reviewMerchantKyb,
  AdminMerchant,
  MerchantKyb,
  KybDocument,
} from "@/lib/admin-api";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  ZoomIn,
  FileText,
  ExternalLink,
  ShieldCheck,
  Store,
  AlertCircle,
} from "lucide-react";

// ── Document viewer ──────────────────────────────────────────────────────────

function DocViewer({ doc }: { doc: KybDocument }) {
  const [enlarged, setEnlarged] = useState(false);
  const isImage = doc.mimeType?.startsWith("image/") ?? false;
  const isPdf   = doc.mimeType === "application/pdf";

  return (
    <>
      <div className="bg-white/4 border border-white/8 rounded-xl overflow-hidden">
        {isImage ? (
          <div
            className="relative aspect-video cursor-pointer group"
            onClick={() => setEnlarged(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={doc.url}
              alt={doc.type}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ) : isPdf ? (
          <div className="aspect-video flex flex-col items-center justify-center gap-2 text-white/30">
            <FileText size={28} />
            <p className="text-xs">PDF document</p>
          </div>
        ) : (
          <div className="aspect-video flex items-center justify-center text-white/20 text-xs">
            Unknown format
          </div>
        )}
        <div className="px-3 py-2.5 flex items-center justify-between border-t border-white/6">
          <div>
            <p className="text-xs font-medium text-white/70">{doc.type.replace(/_/g, " ")}</p>
            {doc.fileName && <p className="text-[10px] text-white/30 mt-0.5 truncate max-w-[150px]">{doc.fileName}</p>}
          </div>
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#F5A623] hover:text-[#F5A623]/80 text-xs transition-colors"
          >
            {isPdf ? "Open" : "Full size"} <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {enlarged && (
        <div
          className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4"
          onClick={() => setEnlarged(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={doc.url}
            alt={doc.type}
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
          />
        </div>
      )}
    </>
  );
}

// ── Field row ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-white/30 text-xs mb-0.5">{label}</p>
      <p className="text-white text-sm font-medium">{value ?? <span className="text-white/25">—</span>}</p>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

const MERCHANT_STATUS_CFG: Record<string, string> = {
  KYB_SUBMITTED:     "bg-blue-400/15 text-blue-400",
  KYB_UNDER_REVIEW:  "bg-amber-400/15 text-amber-400",
  MORE_INFO_REQUIRED:"bg-orange-400/15 text-orange-400",
  ACTIVE:            "bg-emerald-400/15 text-emerald-400",
  REJECTED:          "bg-red-400/15 text-red-400",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function KybReviewPage() {
  const { merchantId } = useParams<{ merchantId: string }>();

  const [merchant, setMerchant] = useState<AdminMerchant | null>(null);
  const [kyb, setKyb] = useState<MerchantKyb | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Inline action states
  const [mode, setMode] = useState<"idle" | "reject" | "more_info">("idle");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<"approved" | "rejected" | "more_info" | null>(null);

  useEffect(() => {
    Promise.all([
      getMerchantById(merchantId),
      getMerchantKyb(merchantId),
    ])
      .then(([m, k]) => { setMerchant(m); setKyb(k); })
      .catch((e) => setError(e.message ?? "Failed to load KYB record"))
      .finally(() => setLoading(false));
  }, [merchantId]);

  async function handleApprove() {
    setSubmitting(true);
    try {
      await reviewMerchantKyb(merchantId, true);
      setDone("approved");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await reviewMerchantKyb(merchantId, false, reason.trim());
      setDone("rejected");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Rejection failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMoreInfo() {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await reviewMerchantKyb(merchantId, false, undefined, reason.trim());
      setDone("more_info");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-white/40" size={28} />
      </div>
    );
  }

  // ── Done state ──

  if (done) {
    const cfg = {
      approved:  { icon: Check,  bg: "bg-emerald-400/15", color: "text-emerald-400", msg: "KYB approved — merchant account activated." },
      rejected:  { icon: X,      bg: "bg-red-400/15",     color: "text-red-400",     msg: "KYB rejected." },
      more_info: { icon: ShieldCheck, bg: "bg-orange-400/15", color: "text-orange-400", msg: "More information requested from the merchant." },
    }[done];
    const Icon = cfg.icon;
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${cfg.bg}`}>
          <Icon size={28} className={cfg.color} />
        </div>
        <p className="text-white font-medium">{cfg.msg}</p>
        <Link href="/kyb-review" className="text-[#F5A623] text-sm hover:underline">
          ← Back to KYB queue
        </Link>
      </div>
    );
  }

  // ── Error ──

  if (error && !merchant) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={15} /> {error}
        </div>
        <Link href="/kyb-review" className="text-white/50 text-sm hover:text-white flex items-center gap-1">
          <ArrowLeft size={14} /> Back to queue
        </Link>
      </div>
    );
  }

  if (!merchant || !kyb) return null;

  const statusCls = MERCHANT_STATUS_CFG[merchant.status] ?? "bg-white/10 text-white/50";
  const hasData = kyb.ownerFullName || kyb.registrationNumber || kyb.businessType;
  const canReview = hasData && !["APPROVED", "REJECTED"].includes(kyb.status);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/kyb-review" className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          {merchant.logoUrl && (
            <img src={merchant.logoUrl} alt={merchant.businessName}
              className="w-9 h-9 rounded-lg object-cover border border-white/10 flex-shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-white">{merchant.businessName}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCls}`}>
                {merchant.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-white/40 text-sm font-mono">@{merchant.businessHandle}</p>
          </div>
        </div>
        <Link
          href={`/merchants/${merchantId}`}
          className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
        >
          <Store size={12} /> Full profile
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* More info context — what was previously requested */}
      {merchant.status === "MORE_INFO_REQUIRED" && merchant.moreInfoRequest && (
        <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl px-4 py-3">
          <p className="text-[10px] text-orange-400/70 uppercase tracking-wider font-medium mb-1">Previously requested info</p>
          <p className="text-sm text-orange-300">{merchant.moreInfoRequest}</p>
        </div>
      )}

      {/* Business info */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-[11px] text-white/30 uppercase tracking-widest font-medium mb-4">Business Information</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <Row label="Business Type"     value={kyb.businessType?.replace(/_/g, " ")} />
          <Row label="Registration No."  value={kyb.registrationNumber} />
          <Row label="Tax ID"            value={kyb.taxIdNumber} />
          <Row label="Registered Address"value={kyb.registeredAddress} />
          <Row label="City"              value={kyb.city} />
          {kyb.website && (
            <Row label="Website" value={
              <a href={kyb.website} target="_blank" rel="noopener noreferrer"
                className="text-[#F5A623] hover:underline flex items-center gap-1">
                {kyb.website} <ExternalLink size={10} />
              </a>
            } />
          )}
          <Row label="Category"          value={merchant.category?.replace(/_/g, " ")} />
          <Row label="Business Email"    value={merchant.businessEmail} />
          <Row label="Business Phone"    value={merchant.businessPhone} />
        </div>
      </div>

      {/* Owner / director */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
        <p className="text-[11px] text-white/30 uppercase tracking-widest font-medium mb-4">Owner / Director</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <Row label="Full Name" value={kyb.ownerFullName} />
          <Row label="ID Type"   value={kyb.ownerIdType?.replace(/_/g, " ")} />
        </div>
      </div>

      {/* Documents */}
      {kyb.documents && kyb.documents.length > 0 && (
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-widest font-medium mb-3">Documents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kyb.documents.map((doc) => (
              <DocViewer key={doc.id} doc={doc} />
            ))}
          </div>
        </div>
      )}

      {/* Submission timestamps */}
      {(kyb.submittedAt || kyb.reviewedAt) && (
        <div className="flex gap-6 text-xs text-white/30">
          {kyb.submittedAt && <span>Submitted: {new Date(kyb.submittedAt).toLocaleString()}</span>}
          {kyb.reviewedAt  && <span>Last reviewed: {new Date(kyb.reviewedAt).toLocaleString()}</span>}
        </div>
      )}

      {/* ── Action area ── */}
      {canReview && (
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 space-y-4">
          <p className="text-[11px] text-white/30 uppercase tracking-widest font-medium">Decision</p>

          {mode === "idle" && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium text-sm hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Approve
              </button>
              <button
                onClick={() => { setMode("more_info"); setReason(""); }}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/20 font-medium text-sm hover:bg-orange-500/25 transition-colors disabled:opacity-50"
              >
                Request More Info
              </button>
              <button
                onClick={() => { setMode("reject"); setReason(""); }}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/20 font-medium text-sm hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                <X size={16} /> Reject
              </button>
            </div>
          )}

          {mode === "reject" && (
            <div className="space-y-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for rejection (required) — this will be shown to the merchant"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 text-sm resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={submitting || !reason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/20 font-medium text-sm hover:bg-red-500/25 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                  Confirm Rejection
                </button>
                <button
                  onClick={() => setMode("idle")}
                  className="px-5 py-3 rounded-xl bg-white/5 text-white/50 text-sm hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {mode === "more_info" && (
            <div className="space-y-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe what additional documents or information is needed…"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 text-sm resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleMoreInfo}
                  disabled={submitting || !reason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/20 font-medium text-sm hover:bg-orange-500/25 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Send Request
                </button>
                <button
                  onClick={() => setMode("idle")}
                  className="px-5 py-3 rounded-xl bg-white/5 text-white/50 text-sm hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!canReview && (
        <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white/40">
          {kyb.status === "APPROVED"
            ? "This KYB has already been approved."
            : kyb.status === "REJECTED"
            ? "This KYB has been rejected."
            : "No KYB information has been submitted yet."}
        </div>
      )}
    </div>
  );
}
