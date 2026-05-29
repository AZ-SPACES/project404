"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getKycRecord, reviewKyc, type KycRecord } from "@/lib/admin-api";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, X, Loader2, ZoomIn } from "lucide-react";

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

export default function KycReviewPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const { data: record, isLoading, error } = useQuery<KycRecord>({
    queryKey: ["kycRecord", userId],
    queryFn: () => getKycRecord(userId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ approved, reason }: { approved: boolean; reason: string }) =>
      reviewKyc(userId, approved, reason),
    onSuccess: (_data, { approved }) => {
      setDone(approved ? "approved" : "rejected");
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-white/40" size={28} /></div>;

  if (done) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${done === "approved" ? "bg-emerald-400/15" : "bg-red-400/15"}`}>
        {done === "approved" ? <Check size={28} className="text-emerald-400" /> : <X size={28} className="text-red-400" />}
      </div>
      <p className="text-white font-medium">KYC {done === "approved" ? "approved" : "rejected"} successfully.</p>
      <Link href="/kyc" className="text-[#B7EE7A] text-sm hover:underline">← Back to queue</Link>
    </div>
  );

  if (error || !record) return (
    <div className="space-y-4">
      <p className="text-red-400">{error ? (error as Error).message : "Record not found"}</p>
      <Link href="/kyc" className="text-white/50 text-sm hover:text-white flex items-center gap-1"><ArrowLeft size={14} /> Back</Link>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/kyc" className="text-white/40 hover:text-white transition-colors"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-xl font-semibold text-white">KYC Review</h1>
          <p className="text-white/40 text-sm">{record.displayName ?? record.email}</p>
        </div>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          ["Email", record.email],
          ["User ID", record.userId?.slice(0, 12) + "…"],
          ["ID Type", record.idType ?? "—"],
          ["ID Number", record.idNumber ?? "—"],
          ["Funds Source", record.fundsSource ?? "—"],
          ["PEP", record.isPep ? "Yes" : "No"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-white/30 text-xs">{k}</p>
            <p className="text-white text-sm mt-0.5 font-medium">{v}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-xs uppercase tracking-widest text-white/30 font-medium mb-3">Documents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DocImage url={record.idFrontUrl} label="ID Front" />
          <DocImage url={record.idBackUrl} label="ID Back" />
          <DocImage url={record.selfieUrl} label="Selfie" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {!showReject ? (
          <>
            <button onClick={() => reviewMutation.mutate({ approved: true, reason: "" })} disabled={reviewMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium text-sm hover:bg-emerald-500/25 transition-colors disabled:opacity-50">
              {reviewMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve
            </button>
            <button onClick={() => setShowReject(true)} disabled={reviewMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/20 font-medium text-sm hover:bg-red-500/25 transition-colors disabled:opacity-50">
              <X size={16} /> Reject
            </button>
          </>
        ) : (
          <div className="flex-1 space-y-3">
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)" rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 text-sm resize-none" />
            <div className="flex gap-3">
              <button
                onClick={() => reviewMutation.mutate({ approved: false, reason: rejectReason })}
                disabled={reviewMutation.isPending || !rejectReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/20 font-medium text-sm hover:bg-red-500/25 disabled:opacity-50">
                {reviewMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Confirm Rejection
              </button>
              <button onClick={() => setShowReject(false)}
                className="px-4 py-3 rounded-xl bg-white/5 text-white/50 text-sm hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {reviewMutation.error && <p className="text-red-400 text-sm">{(reviewMutation.error as Error).message}</p>}
    </div>
  );
}
