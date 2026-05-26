"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, getKyb, Merchant, KybStatus } from "@/lib/merchant-api";
import {
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  MessageCircle,
  Upload,
} from "lucide-react";

export default function OnboardingStatusPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [kyb, setKyb] = useState<KybStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(showSpinner = false) {
    if (showSpinner) setRefreshing(true);
    try {
      const me = await getMe();
      if (!me || me.status === "ACTIVE" || me.status === "SUSPENDED") {
        router.replace(!me ? "/onboarding" : "/dashboard");
        return;
      }
      if (me.status === "PENDING_KYB") {
        router.replace("/onboarding");
        return;
      }
      setMerchant(me);
      try {
        const k = await getKyb();
        setKyb(k);
      } catch {}
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <Loader2 className="animate-spin text-[#10b981]" size={28} />
      </div>
    );
  }

  const status = merchant?.status ?? "KYB_SUBMITTED";

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#10b981] flex items-center justify-center">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <span className="text-base font-semibold">
            aza <span className="text-[#10b981] text-xs font-normal">merchants</span>
          </span>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {status === "KYB_SUBMITTED" || status === "KYB_UNDER_REVIEW" ? (
            <UnderReviewContent status={status} merchantName={merchant?.businessName} />
          ) : status === "MORE_INFO_REQUIRED" ? (
            <MoreInfoContent adminNote={kyb?.moreInfoRequest} onResubmit={() => router.push("/onboarding")} />
          ) : status === "REJECTED" ? (
            <RejectedContent adminNote={kyb?.rejectionReason} />
          ) : (
            <UnderReviewContent status={status} merchantName={merchant?.businessName} />
          )}
        </div>
      </div>
    </div>
  );
}

function UnderReviewContent({ status, merchantName }: { status: string; merchantName?: string }) {
  const isUnderReview = status === "KYB_UNDER_REVIEW";
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <Clock size={28} className="text-amber-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Application under review</h2>
      <p className="text-white/45 text-sm mb-8">
        {merchantName && <><span className="text-white/70 font-medium">{merchantName}</span> · </>}
        We&apos;re reviewing your KYB submission. This typically takes 2–3 business days.
      </p>

      {/* Timeline */}
      <div className="bg-[#161616] border border-white/6 rounded-2xl p-5 text-left space-y-4">
        <TimelineStep
          done
          label="Application submitted"
          detail="Your KYB documents have been received"
        />
        <TimelineStep
          active={isUnderReview}
          done={false}
          label="Under review"
          detail={isUnderReview ? "An admin is reviewing your application" : "Waiting to be assigned to a reviewer"}
        />
        <TimelineStep
          done={false}
          label="Decision"
          detail="You'll receive an email and push notification"
        />
      </div>

      <p className="text-white/25 text-xs mt-6">
        This page refreshes automatically. You can also close it — we'll notify you when a decision is made.
      </p>
    </div>
  );
}

function MoreInfoContent({ adminNote, onResubmit }: { adminNote?: string | null; onResubmit: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
        <AlertCircle size={28} className="text-orange-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">More information needed</h2>
      <p className="text-white/45 text-sm mb-6">
        Our review team has a question about your application.
      </p>
      {adminNote && (
        <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl px-4 py-3.5 text-left mb-6">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1.5">Note from reviewer</p>
          <p className="text-sm text-white/80">{adminNote}</p>
        </div>
      )}
      <button
        onClick={onResubmit}
        className="w-full py-2.5 rounded-xl bg-[#10b981] hover:bg-[#0ea472] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
      >
        <Upload size={15} />
        Update &amp; resubmit
      </button>
    </div>
  );
}

function RejectedContent({ adminNote }: { adminNote?: string | null }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <XCircle size={28} className="text-red-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Application not approved</h2>
      <p className="text-white/45 text-sm mb-6">
        Unfortunately your KYB application was not approved at this time.
      </p>
      {adminNote && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3.5 text-left mb-6">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">Reason</p>
          <p className="text-sm text-white/80">{adminNote}</p>
        </div>
      )}
      <a
        href="mailto:support@aza.systems"
        className="w-full py-2.5 rounded-xl bg-white/6 border border-white/10 text-white/70 font-semibold text-sm transition-colors flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white"
      >
        <MessageCircle size={15} />
        Contact support
      </a>
    </div>
  );
}

function TimelineStep({ done, active, label, detail }: { done: boolean; active?: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        done ? "bg-[#10b981] text-white" : active ? "bg-amber-500/20 border border-amber-500" : "bg-white/8 border border-white/15"
      }`}>
        {done ? <CheckCircle2 size={14} /> : active ? <Clock size={12} className="text-amber-400" /> : null}
      </div>
      <div>
        <p className={`text-sm font-medium ${done ? "text-white" : active ? "text-amber-400" : "text-white/35"}`}>{label}</p>
        <p className="text-xs text-white/30 mt-0.5">{detail}</p>
      </div>
    </div>
  );
}
