"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  getMobileKybContext,
  uploadMobileKybDocument,
  MobileKybContext,
} from "@/lib/merchant-api";
import { CheckCircle2, Camera, Loader2, FileText, AlertCircle } from "lucide-react";

// Load DocumentCapture client-side only (needs browser APIs)
const DocumentCapture = dynamic(() => import("@/components/DocumentCapture"), { ssr: false });

const DOC_LABELS: Record<string, string> = {
  CERTIFICATE_OF_INCORPORATION: "Certificate of Incorporation",
  TAX_CERTIFICATE:              "Tax Certificate (GRA TIN Letter)",
  PROOF_OF_ADDRESS:             "Proof of Address (utility bill, ≤ 3 months old)",
  OWNER_ID_FRONT:               "Owner ID — Front",
  OWNER_ID_BACK:                "Owner ID — Back",
};

const ALL_TYPES = Object.keys(DOC_LABELS);

export default function MobileKybPage() {
  const { token } = useParams<{ token: string }>();

  const [ctx, setCtx]             = useState<MobileKybContext | null>(null);
  const [uploaded, setUploaded]   = useState<Set<string>>(new Set());
  const [error, setError]         = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<string | null>(null); // which doc is being captured

  useEffect(() => {
    getMobileKybContext(token)
      .then((data) => {
        setCtx(data);
        setUploaded(new Set(data.uploadedDocTypes));
      })
      .catch(() =>
        setLoadError(
          "This link has expired or is invalid. Please go back to your computer and request a new QR code."
        )
      );
  }, [token]);

  const handleCapture = useCallback(
    async (file: File) => {
      if (!activeDoc) return;
      setError(null);
      try {
        await uploadMobileKybDocument(token, file, activeDoc);
        setUploaded((prev) => new Set([...prev, activeDoc]));
        // small delay so the "Uploaded" state is visible before closing
        await new Promise((r) => setTimeout(r, 900));
        setActiveDoc(null);
      } catch (e: unknown) {
        setActiveDoc(null);
        setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
      }
    },
    [activeDoc, token]
  );

  const allDone = ALL_TYPES.every((t) => uploaded.has(t));

  // ── Loading / error states ────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <h1 className="text-white font-bold text-lg mb-2">Link expired</h1>
        <p className="text-white/40 text-sm max-w-xs">{loadError}</p>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#B7EE7A]" size={28} />
      </div>
    );
  }

  if (allDone) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#B7EE7A]/10 flex items-center justify-center mb-5">
          <CheckCircle2 size={32} className="text-[#B7EE7A]" />
        </div>
        <h1 className="text-white font-bold text-xl mb-2">All done!</h1>
        <p className="text-white/45 text-sm max-w-xs">
          All documents uploaded. Return to your computer to complete submission.
        </p>
      </div>
    );
  }

  // ── Main document list ────────────────────────────────────────────────────

  return (
    <>
      {/* Camera capture overlay — rendered outside the scroll container */}
      {activeDoc && (
        <DocumentCapture
          docLabel={DOC_LABELS[activeDoc]}
          onCapture={handleCapture}
          onCancel={() => setActiveDoc(null)}
        />
      )}

      <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
        {/* Header */}
        <header className="px-5 pt-6 pb-4 border-b border-white/6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#174717] flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <span className="text-white font-semibold text-base">
              aza <span className="text-[#B7EE7A] text-xs font-normal">merchants</span>
            </span>
          </div>
          <h1 className="text-white font-bold text-lg">{ctx.businessName}</h1>
          <p className="text-white/40 text-sm mt-0.5">Scan and upload your verification documents</p>
        </header>

        {/* Progress bar */}
        <div className="px-5 py-3 border-b border-white/6 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#B7EE7A] rounded-full transition-all duration-500"
              style={{ width: `${(uploaded.size / ALL_TYPES.length) * 100}%` }}
            />
          </div>
          <span className="text-white/40 text-xs tabular-nums">
            {uploaded.size}/{ALL_TYPES.length}
          </span>
        </div>

        {/* Document list */}
        <div className="flex-1 px-5 py-4 space-y-3">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* How it works callout */}
          <div className="px-4 py-3 rounded-xl bg-white/4 border border-white/8 text-white/40 text-xs leading-relaxed">
            <span className="text-[#B7EE7A] font-semibold">How it works: </span>
            Tap <strong className="text-white/60">Scan</strong> next to each document. Your camera
            will open — place the document flat, in good light. It auto-captures when the image is
            sharp and clear. You&apos;ll be asked to tilt the document slightly to confirm it&apos;s
            a physical original.
          </div>

          {ALL_TYPES.map((docType) => {
            const isDone = uploaded.has(docType);

            return (
              <div
                key={docType}
                className={`rounded-2xl border p-4 flex items-center gap-3 transition-colors ${
                  isDone
                    ? "bg-[#B7EE7A]/5 border-[#B7EE7A]/20"
                    : "bg-white/4 border-white/8"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isDone ? "bg-[#B7EE7A]/15" : "bg-white/6"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 size={20} className="text-[#B7EE7A]" />
                  ) : (
                    <FileText size={20} className="text-white/30" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium leading-tight ${isDone ? "text-white/40" : "text-white"}`}>
                    {DOC_LABELS[docType]}
                  </p>
                  {isDone && (
                    <p className="text-xs text-[#B7EE7A] mt-0.5">Uploaded ✓</p>
                  )}
                </div>

                {!isDone && (
                  <button
                    onClick={() => setActiveDoc(docType)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-white text-sm font-semibold transition-colors flex-shrink-0 active:scale-95"
                  >
                    <Camera size={15} />
                    Scan
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-8 pt-2 text-center">
          <p className="text-white/20 text-xs">
            This link expires in 15 minutes · Secured by Aza Systems
          </p>
        </div>
      </div>
    </>
  );
}
