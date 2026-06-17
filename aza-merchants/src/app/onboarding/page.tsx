"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getMe,
  checkHandle,
  registerMerchant,
  getKyb,
  saveKyb,
  uploadKybDocument,
  submitKyb,
  createMobileHandoff,
  getMobileKybStatus,
  KybDocument,
} from "@/lib/merchant-api";
import {
  Loader2,
  Upload,
  X,
  CheckCircle2,
  ChevronRight,
  FileText,
  ArrowLeft,
  Smartphone,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

type Step = "register" | "kyb" | "documents";

const BUSINESS_TYPES = ["SOLE_PROPRIETOR", "PARTNERSHIP", "LIMITED_COMPANY", "NGO", "OTHER"];
const ID_TYPES = ["GHANA_CARD", "PASSPORT", "VOTER_ID", "DRIVERS_LICENCE"];

const DOC_SLOTS = [
  { type: "CERTIFICATE_OF_INCORPORATION", label: "Certificate of Incorporation" },
  { type: "TAX_CERTIFICATE", label: "Tax Certificate (GRA TIN Letter)" },
  { type: "PROOF_OF_ADDRESS", label: "Proof of Address (utility bill, ≤ 3 months old)" },
  { type: "OWNER_ID_FRONT", label: "Owner ID — Front" },
  { type: "OWNER_ID_BACK", label: "Owner ID — Back" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("register");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // register step
  const [businessName, setBusinessName] = useState("");
  const [businessHandle, setBusinessHandle] = useState("");
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [handleChecking, setHandleChecking] = useState(false);
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [category, setCategory] = useState("RETAIL");

  // kyb step
  const [businessType, setBusinessType] = useState("SOLE_PROPRIETOR");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxIdNumber, setTaxIdNumber] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [city, setCity] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerIdType, setOwnerIdType] = useState("GHANA_CARD");
  const [ownerIdNumber, setOwnerIdNumber] = useState("");

  // documents step
  const [documents, setDocuments] = useState<KybDocument[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // admin note (shown when MORE_INFO_REQUIRED)
  const [adminNote, setAdminNote] = useState<string | null>(null);

  // mobile handoff
  const [mobileToken, setMobileToken] = useState<string | null>(null);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [mobileLinkLoading, setMobileLinkLoading] = useState(false);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        if (!me) {
          setStep("register");
          setLoading(false);
          return;
        }
        if (me.status === "ACTIVE" || me.status === "SUSPENDED") {
          router.replace("/dashboard");
          return;
        }
        if (
          me.status === "KYB_SUBMITTED" ||
          me.status === "KYB_UNDER_REVIEW" ||
          me.status === "REJECTED"
        ) {
          router.replace("/onboarding/status");
          return;
        }
        setBusinessName(me.businessName);
        // PENDING_KYB or MORE_INFO_REQUIRED — load saved kyb and resume
        try {
          const kyb = await getKyb();
          setDocuments(kyb.documents ?? []);
          if (kyb.moreInfoRequest) setAdminNote(kyb.moreInfoRequest);

          // Populate KYB fields if previously saved
          if (kyb.ownerFullName) {
            setOwnerFullName(kyb.ownerFullName ?? "");
            if (kyb.businessType) setBusinessType(kyb.businessType);
            setRegistrationNumber(kyb.registrationNumber ?? "");
            setTaxIdNumber(kyb.taxIdNumber ?? "");
            setRegisteredAddress(kyb.registeredAddress ?? "");
            setCity(kyb.city ?? "");
            setOwnerIdType(kyb.ownerIdType ?? "GHANA_CARD");
          }

          // Decide which step to resume on
          const kybComplete = !!(kyb.ownerFullName && kyb.registeredAddress && kyb.taxIdNumber);
          const hasDocuments = (kyb.documents ?? []).length > 0;

          if (kybComplete || hasDocuments) {
            setStep("documents");
          } else if (kyb.ownerFullName) {
            // Partial KYB saved — put them back on KYB to finish
            setStep("kyb");
          } else {
            setStep("kyb");
          }
        } catch {
          setStep("kyb");
        }
      } catch (err: any) {
        setStep("register");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Debounced handle availability check
  useEffect(() => {
    if (!businessHandle || businessHandle.length < 3) {
      setHandleAvailable(null);
      return;
    }
    setHandleChecking(true);
    const t = setTimeout(async () => {
      try {
        const available = await checkHandle(businessHandle);
        setHandleAvailable(available);
      } catch {
        setHandleAvailable(null);
      } finally {
        setHandleChecking(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [businessHandle]);

  const openMobileHandoff = async () => {
    setMobileLinkLoading(true);
    try {
      const { token } = await createMobileHandoff();
      setMobileToken(token);
      setMobileModalOpen(true);
      // Poll every 4 seconds for new uploads from the phone
      pollRef.current = setInterval(async () => {
        try {
          const status = await getMobileKybStatus(token);
          if (status.uploadedDocTypes.length > 0) {
            const kyb = await getKyb();
            setDocuments(kyb.documents ?? []);
          }
          if (status.complete) {
            clearInterval(pollRef.current!);
          }
        } catch {
          clearInterval(pollRef.current!);
        }
      }, 4000);
    } catch (e: any) {
      setMobileError(e.message ?? "Could not create mobile session");
    } finally {
      setMobileLinkLoading(false);
    }
  };

  const closeMobileModal = () => {
    setMobileModalOpen(false);
    setMobileToken(null);
    setLinkCopied(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await registerMerchant({
        businessName,
        businessHandle: businessHandle.toLowerCase().trim(),
        businessEmail: businessEmail || undefined,
        businessPhone: businessPhone || undefined,
        businessDescription: businessDescription || undefined,
        category: category || undefined,
      });
      setStep("kyb");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleKyb(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await saveKyb({
        businessType,
        registrationNumber: registrationNumber || undefined,
        taxIdNumber: taxIdNumber || undefined,
        registeredAddress: registeredAddress || undefined,
        city: city || undefined,
        ownerFullName,
        ownerIdType: ownerIdType || undefined,
        ownerIdNumber: ownerIdNumber || undefined,
      });
      const kyb = await getKyb();
      setDocuments(kyb.documents ?? []);
      setStep("documents");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileSelect(docType: string, file: File) {
    setUploading(docType);
    setError(null);
    try {
      const doc = await uploadKybDocument(file, docType);
      setDocuments((prev) => {
        const filtered = prev.filter((d) => d.type !== docType);
        return [...filtered, doc];
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    try {
      await submitKyb();
      router.replace("/onboarding/status");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const allDocsUploaded = DOC_SLOTS.every((slot) =>
    documents.some((d) => d.type === slot.type)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <Loader2 className="animate-spin text-[#B7EE7A]" size={28} />
      </div>
    );
  }

  const stepIndex = step === "register" ? 0 : step === "kyb" ? 1 : 2;

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      <header className="h-14 border-b border-white/5 flex items-center px-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#174717] flex items-center justify-center">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <span className="text-base font-semibold">
            aza <span className="text-[#B7EE7A] text-xs font-normal">merchants</span>
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start py-10 px-4">
        <div className="w-full max-w-lg">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {["Business Info", "KYB Details", "Documents"].map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${i <= stepIndex ? "opacity-100" : "opacity-30"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i < stepIndex
                      ? "bg-[#174717] text-white"
                      : i === stepIndex
                      ? "bg-[#B7EE7A]/20 border border-[#B7EE7A] text-[#B7EE7A]"
                      : "bg-white/10 text-white/40"
                  }`}>
                    {i < stepIndex ? <CheckCircle2 size={14} /> : i + 1}
                  </div>
                  <span className="text-xs font-medium text-white/60 hidden sm:block">{label}</span>
                </div>
                {i < 2 && <div className={`h-px flex-1 ${i < stepIndex ? "bg-[#B7EE7A]/40" : "bg-white/10"}`} />}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Step 1: Register ── */}
          {step === "register" && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white">Set up your business</h2>
                <p className="text-white/45 text-sm mt-1">Tell us about your business to get started</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-4">
                <Field label="Business name" required>
                  <input
                    type="text" required
                    value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Acme Stores"
                    className={inputCls}
                  />
                </Field>
                <Field label="Business handle" required hint="Unique identifier for your merchant page">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35 text-sm">@</span>
                    <input
                      type="text" required pattern="[a-z0-9_]{3,30}"
                      value={businessHandle}
                      onChange={(e) => setBusinessHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="your_business"
                      className={inputCls + " pl-7"}
                    />
                    {businessHandle.length >= 3 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                        {handleChecking ? (
                          <Loader2 size={13} className="animate-spin text-white/30" />
                        ) : handleAvailable === true ? (
                          <CheckCircle2 size={13} className="text-[#B7EE7A]" />
                        ) : handleAvailable === false ? (
                          <X size={13} className="text-red-400" />
                        ) : null}
                      </span>
                    )}
                  </div>
                  {handleAvailable === false && businessHandle.length >= 3 && (
                    <p className="text-xs text-red-400 mt-1">This handle is already taken</p>
                  )}
                </Field>
                <Field label="Category" required>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                    {["RETAIL", "FOOD_AND_BEVERAGE", "SERVICES", "TECHNOLOGY", "HEALTHCARE",
                      "EDUCATION", "ENTERTAINMENT", "TRANSPORT", "REAL_ESTATE", "AGRICULTURE",
                      "FINANCE", "OTHER"].map((c) => (
                      <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Business email">
                    <input
                      type="email"
                      value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)}
                      placeholder="payments@biz.com"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Business phone">
                    <input
                      type="tel"
                      value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)}
                      placeholder="+233 XX XXX XXXX"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Business description" hint="Optional">
                  <textarea
                    rows={3}
                    value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)}
                    placeholder="What does your business do?"
                    className={inputCls + " resize-none"}
                  />
                </Field>
                <PrimaryBtn loading={saving} disabled={handleAvailable === false}>Continue</PrimaryBtn>
              </form>
            </div>
          )}

          {/* ── Step 2: KYB form ── */}
          {step === "kyb" && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white">KYB verification</h2>
                <p className="text-white/45 text-sm mt-1">Required to accept live payments</p>
              </div>
              {adminNote && (
                <div className="mb-5 flex gap-3 px-4 py-3.5 rounded-xl bg-amber-400/10 border border-amber-400/25">
                  <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 text-sm font-semibold mb-0.5">Action required from reviewer</p>
                    <p className="text-amber-300/80 text-sm">{adminNote}</p>
                  </div>
                </div>
              )}
              <form onSubmit={handleKyb} className="space-y-4">
                <Field label="Business type" required>
                  <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={inputCls}>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Registration number">
                    <input type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="CS-12345" className={inputCls} />
                  </Field>
                  <Field label="TIN (GRA)">
                    <input type="text" value={taxIdNumber} onChange={(e) => setTaxIdNumber(e.target.value)} placeholder="GHA-12345678-9" className={inputCls} />
                  </Field>
                </div>
                <Field label="Registered address">
                  <input type="text" value={registeredAddress} onChange={(e) => setRegisteredAddress(e.target.value)} placeholder="Street address" className={inputCls} />
                </Field>
                <Field label="City">
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Accra" className={inputCls} />
                </Field>
                <div className="pt-2 border-t border-white/6">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Beneficial owner</p>
                  <div className="space-y-4">
                    <Field label="Full name" required>
                      <input type="text" required value={ownerFullName} onChange={(e) => setOwnerFullName(e.target.value)} placeholder="As on ID" className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="ID type">
                        <select value={ownerIdType} onChange={(e) => setOwnerIdType(e.target.value)} className={inputCls}>
                          {ID_TYPES.map((t) => (
                            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="ID number">
                        <input type="text" value={ownerIdNumber} onChange={(e) => setOwnerIdNumber(e.target.value)} placeholder="GHA-12345678-9" className={inputCls} />
                      </Field>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setStep("register")} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm transition-colors">
                    <ArrowLeft size={14} />
                    Back
                  </button>
                  <PrimaryBtn loading={saving} className="flex-1">Continue</PrimaryBtn>
                </div>
              </form>
            </div>
          )}

          {/* ── Step 3: Documents ── */}
          {step === "documents" && (
            <div>
              {adminNote && (
                <div className="mb-5 flex gap-3 px-4 py-3.5 rounded-xl bg-amber-400/10 border border-amber-400/25">
                  <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 text-sm font-semibold mb-0.5">Action required from reviewer</p>
                    <p className="text-amber-300/80 text-sm">{adminNote}</p>
                  </div>
                </div>
              )}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">Upload documents</h2>
                    <p className="text-white/45 text-sm mt-1">All documents required before submission</p>
                  </div>
                  <button
                    onClick={() => { setMobileError(null); openMobileHandoff(); }}
                    disabled={mobileLinkLoading}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/6 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {mobileLinkLoading ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={12} />}
                    Continue on mobile
                  </button>
                </div>
                {mobileError && (
                  <p className="text-xs text-red-400 mt-2 text-right">{mobileError}</p>
                )}
              </div>
              <div className="space-y-3">
                {DOC_SLOTS.map((slot) => {
                  const uploaded = documents.find((d) => d.type === slot.type);
                  const isUploading = uploading === slot.type;
                  return (
                    <div key={slot.type} className="bg-white/4 border border-white/8 rounded-xl p-4 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${uploaded ? "bg-[#B7EE7A]/15" : "bg-white/6"}`}>
                        {uploaded ? <CheckCircle2 size={18} className="text-[#B7EE7A]" /> : <FileText size={18} className="text-white/30" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{slot.label}</p>
                        {uploaded && (
                          <p className="text-xs text-white/35 truncate mt-0.5">{uploaded.fileName ?? "Uploaded"}</p>
                        )}
                      </div>
                      {uploaded ? (
                        <span className="text-xs text-[#B7EE7A] font-medium">Done</span>
                      ) : (
                        <>
                          <input
                            ref={(el) => { fileInputRefs.current[slot.type] = el; }}
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(slot.type, file);
                              e.target.value = "";
                            }}
                          />
                          <button
                            onClick={() => fileInputRefs.current[slot.type]?.click()}
                            disabled={isUploading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/6 border border-white/10 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
                          >
                            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                            {isUploading ? "Uploading…" : "Upload"}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep("kyb")} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm transition-colors">
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!allDocsUploaded || saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                  {saving ? "Submitting…" : "Submit for review"}
                </button>
              </div>
              {!allDocsUploaded && (
                <p className="text-center text-xs text-white/25 mt-3">
                  Upload all {DOC_SLOTS.length} required documents to continue
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile handoff modal ── */}
      {mobileModalOpen && mobileToken && (() => {
        const mobileUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/m/${mobileToken}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=ffffff&bgcolor=0f0f0f&data=${encodeURIComponent(mobileUrl)}`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Smartphone size={16} className="text-[#B7EE7A]" />
                    <h2 className="text-base font-bold text-white">Scan on your phone</h2>
                  </div>
                  <p className="text-white/40 text-xs">Use your phone's camera to scan documents. Link expires in 15 minutes.</p>
                </div>
                <button onClick={closeMobileModal} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* QR Code */}
              <div className="flex justify-center mb-5">
                <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrUrl} alt="QR code" width={220} height={220} className="rounded-lg" />
                </div>
              </div>

              {/* Progress from phone */}
              <div className="mb-4 space-y-1.5">
                {DOC_SLOTS.map((slot) => {
                  const done = documents.some((d) => d.type === slot.type);
                  return (
                    <div key={slot.type} className="flex items-center gap-2 text-xs">
                      {done
                        ? <CheckCircle2 size={13} className="text-[#B7EE7A] flex-shrink-0" />
                        : <div className="w-3.5 h-3.5 rounded-full border border-white/15 flex-shrink-0" />}
                      <span className={done ? "text-white/40 line-through" : "text-white/60"}>{slot.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Copy link */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(mobileUrl);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 text-white/60 hover:text-white text-xs font-medium transition-colors"
              >
                {linkCopied ? <Check size={12} className="text-[#B7EE7A]" /> : <Copy size={12} />}
                {linkCopied ? "Copied!" : "Copy link instead"}
              </button>

              {documents.every((_, i) => i >= 0) && DOC_SLOTS.every((s) => documents.some((d) => d.type === s.type)) && (
                <div className="mt-4 px-4 py-3 rounded-xl bg-[#B7EE7A]/8 border border-[#B7EE7A]/20 text-[#B7EE7A] text-xs text-center font-medium">
                  All documents received! You can close this.
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 focus:bg-white/8 transition-all text-sm";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-sm font-medium text-white/70">{label}</label>
        {required && <span className="text-[#B7EE7A] text-xs">*</span>}
        {hint && <span className="text-white/30 text-xs ml-auto">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function PrimaryBtn({
  loading,
  disabled,
  children,
  className = "",
}: {
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={`w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {loading ? "Saving…" : children}
    </button>
  );
}
