"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getKycRecord, isPendingApproval, reviewKyc, type KycRecord } from "@/lib/admin-api";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, X, Loader2, ZoomIn } from "lucide-react";

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

export default function KycReviewPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [done, setDone] = useState<"approved" | "rejected" | "pending" | null>(null);

  const { data: record, isLoading, error } = useQuery<KycRecord>({
    queryKey: ["kycRecord", userId],
    queryFn: () => getKycRecord(userId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ approved, reason }: { approved: boolean; reason: string }) =>
      reviewKyc(userId, approved, reason),
    onSuccess: (data, { approved }) => {
      // Maker-checker: approvals need a second COMPLIANCE/ADMIN
      setDone(isPendingApproval(data) ? "pending" : approved ? "approved" : "rejected");
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-foreground/40" size={28} /></div>;

  if (done) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
        done === "approved" ? "bg-emerald-400/15" : done === "pending" ? "bg-yellow-400/15" : "bg-red-400/15"
      }`}>
        {done === "approved" ? <Check size={28} className="text-emerald-400" />
          : done === "pending" ? <Check size={28} className="text-yellow-400" />
          : <X size={28} className="text-red-400" />}
      </div>
      <p className="text-foreground font-medium">
        {done === "approved" ? "KYC approved successfully."
          : done === "pending" ? "Approval submitted — another COMPLIANCE/ADMIN must approve it in Approvals."
          : "KYC rejected successfully."}
      </p>
      <Link href="/kyc" className="text-[#B7EE7A] text-sm hover:underline">← Back to queue</Link>
    </div>
  );

  if (error || !record) return (
    <div className="space-y-4">
      <p className="text-red-400">{error ? (error as Error).message : "Record not found"}</p>
      <Link href="/kyc" className="text-foreground/50 text-sm hover:text-foreground flex items-center gap-1"><ArrowLeft size={14} /> Back</Link>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/kyc" className="text-foreground/40 hover:text-foreground transition-colors"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">KYC Review</h1>
          <p className="text-foreground/40 text-sm">{record.displayName ?? record.email}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          ["Email", record.email],
          ["User ID", record.userId?.slice(0, 12) + "…"],
          ["ID Type", record.idType ?? "—"],
          ["ID Number", record.idNumber ?? "—"],
          ["Funds Source", record.fundsSource ?? "—"],
          ["PEP", record.isPep ? "Yes" : "No"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-foreground/30 text-xs">{k}</p>
            <p className="text-foreground text-sm mt-0.5 font-medium">{v}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-xs uppercase tracking-widest text-foreground/30 font-medium mb-3">Documents</h2>
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
              className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-red-500/50 text-sm resize-none" />
            <div className="flex gap-3">
              <button
                onClick={() => reviewMutation.mutate({ approved: false, reason: rejectReason })}
                disabled={reviewMutation.isPending || !rejectReason.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/20 font-medium text-sm hover:bg-red-500/25 disabled:opacity-50">
                {reviewMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Confirm Rejection
              </button>
              <button onClick={() => setShowReject(false)}
                className="px-4 py-3 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground">
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
