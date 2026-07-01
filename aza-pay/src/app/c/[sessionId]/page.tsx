"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  getSession,
  loginStep1,
  loginStep2,
  confirmPayment,
  validatePromoCode,
  redeemPromoCode,
  login2faTotp,
  request2faSms,
  request2faEmail,
  verify2faOtp,
  sendEmailReceipt,
  CheckoutSession,
  PromoInfo,
} from "@/lib/pay-api";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Eye,
  EyeOff,
  ChevronLeft,
  ShieldCheck,
  Tag,
  RotateCcw,
  Copy,
  Printer,
  Mail,
  Send,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────

type Step = "review" | "login" | "otp" | "2fa" | "passcode" | "success";
type TwoFaMode = "totp" | "sms" | "email";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtAmount(n: number, currency = "GHS") {
  const sym = currency === "GHS" ? "GH₵" : currency;
  return `${sym} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtExpiry(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const mins = Math.round((d.getTime() - Date.now()) / 60_000);
  if (mins <= 0) return "Expired";
  if (mins < 60) return `Expires in ${mins} min`;
  return `Expires ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

// ── shared UI ─────────────────────────────────────────────────────────────────

function PoweredBy() {
  return (
    <div className="flex items-center justify-center gap-1.5 pt-6 pb-4">
      <span className="text-[11px] text-white/20">Secured by</span>
      <img src="/logo.png" alt="Aza" className="h-3 w-auto opacity-30 mix-blend-screen grayscale" />
    </div>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div
      className="relative bg-[#111] border rounded-3xl overflow-hidden"
      style={{ borderColor: `${accent}22` }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${accent}55, transparent)` }}
      />
      {children}
    </div>
  );
}

function MerchantHeader({ session, accent }: { session: CheckoutSession; accent: string }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
      {session.merchantLogoUrl ? (
        <img
          src={session.merchantLogoUrl}
          alt={session.merchantName ?? "Merchant"}
          className="w-11 h-11 rounded-xl object-cover border border-white/8 flex-shrink-0"
        />
      ) : (
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-black"
          style={{ background: accent }}
        >
          {(session.merchantName ?? "M")[0].toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate">{session.merchantName ?? "Merchant"}</p>
        {session.merchantHandle && (
          <p className="text-[11px] text-white/35 font-mono">@{session.merchantHandle}</p>
        )}
      </div>
    </div>
  );
}

function AmountBlock({ session, accent }: { session: CheckoutSession; accent: string }) {
  const base = session.amount;
  const tax = session.taxAmount ?? 0;
  const total = base + tax;
  const expiry = fmtExpiry(session.expiresAt);

  return (
    <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-1">
      {session.description && (
        <p className="text-xs text-white/40 mb-3 leading-relaxed">{session.description}</p>
      )}
      <div className="flex justify-between items-center text-sm text-white/50">
        <span>Subtotal</span>
        <span className="font-mono">{fmtAmount(base, session.currency)}</span>
      </div>
      {tax > 0 && (
        <div className="flex justify-between items-center text-sm text-white/40">
          <span>{session.taxLabel ?? "Tax"}</span>
          <span className="font-mono">{fmtAmount(tax, session.currency)}</span>
        </div>
      )}
      <div
        className="flex justify-between items-center pt-2 mt-1 border-t"
        style={{ borderColor: `${accent}22` }}
      >
        <span className="text-sm font-semibold text-white">Total</span>
        <span className="text-xl font-bold" style={{ color: accent }}>
          {fmtAmount(total, session.currency)}
        </span>
      </div>
      {expiry && (
        <div className="flex items-center gap-1.5 pt-1.5">
          <Clock size={11} className="text-white/25" />
          <span className="text-[11px] text-white/30">{expiry}</span>
        </div>
      )}
    </div>
  );
}

function ErrorBanner({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-3 text-sm text-red-400">
      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1">{msg}</span>
      <button onClick={onDismiss} className="text-red-400/50 hover:text-red-400 ml-1">×</button>
    </div>
  );
}

function PrimaryBtn({
  onClick,
  loading,
  disabled,
  accent,
  children,
}: {
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full py-3.5 rounded-2xl font-semibold text-sm text-black transition-all disabled:opacity-40 flex items-center justify-center gap-2"
      style={{ background: accent }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : children}
    </button>
  );
}

// ── pin pad ───────────────────────────────────────────────────────────────────

function PinPad({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"] as const;
  const maxLen = 4;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3 py-1">
        {Array.from({ length: maxLen }, (_, i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full transition-all duration-150"
            style={
              i < value.length
                ? { background: accent, transform: "scale(1.2)" }
                : { background: "rgba(255,255,255,0.15)" }
            }
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k, i) => (
          <button
            key={i}
            onClick={() => {
              if (!k) return;
              if (k === "⌫") onChange(value.slice(0, -1));
              else if (value.length < maxLen) onChange(value + k);
            }}
            disabled={!k}
            className={`h-12 rounded-2xl text-base transition-all active:scale-95
              ${k ? "bg-white/8 hover:bg-white/14" : "pointer-events-none opacity-0"}
              ${k === "⌫" ? "text-white/50 text-xl" : "font-semibold text-white"}
            `}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── terminal screens ──────────────────────────────────────────────────────────

function SuccessReceipt({
  session,
  accent,
  promoInfo,
}: {
  session: CheckoutSession;
  accent: string;
  promoInfo: PromoInfo | null;
}) {
  const base = session.amount;
  const tax = session.taxAmount ?? 0;
  const total = base + tax;
  const ref = session.id.split("-")[0].toUpperCase();
  const paidAt = session.completedAt
    ? new Date(session.completedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      } as Intl.DateTimeFormatOptions)
    : null;
  const [copied, setCopied] = useState(false);
  const [receiptEmail, setReceiptEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSendEmail = async () => {
    if (!receiptEmail.trim() || emailSending || emailSent) return;
    setEmailSending(true);
    setEmailError(null);
    try {
      await sendEmailReceipt(session.id, receiptEmail.trim());
      setEmailSent(true);
    } catch {
      setEmailError("Could not send email. Try again.");
    } finally {
      setEmailSending(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt, #receipt * { visibility: visible; }
          #receipt { position: fixed; top: 0; left: 0; width: 100%; background: #fff; color: #000; padding: 24px; }
        }
      `}</style>
      <div id="receipt" className="px-5 py-5 space-y-4">
        <div className="text-center space-y-2">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: "#B7EE7A18", border: "1px solid #B7EE7A30" }}
          >
            <CheckCircle2 size={24} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">Payment successful</p>
            {paidAt && <p className="text-xs text-white/30 mt-0.5">{paidAt}</p>}
          </div>
        </div>

        <div className="bg-white/4 rounded-xl px-4 py-3 space-y-2">
          {session.description && (
            <p className="text-xs text-white/40 pb-2 border-b border-white/5">{session.description}</p>
          )}
          <div className="flex justify-between text-sm text-white/50">
            <span>Subtotal</span>
            <span className="font-mono">{fmtAmount(base, session.currency)}</span>
          </div>
          {tax > 0 && (
            <div className="flex justify-between text-sm text-white/40">
              <span>{session.taxLabel ?? "Tax"}</span>
              <span className="font-mono">{fmtAmount(tax, session.currency)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1.5 border-t border-white/8">
            <span className="text-sm font-semibold text-white">Total paid</span>
            <span className="text-lg font-bold" style={{ color: accent }}>
              {fmtAmount(total, session.currency)}
            </span>
          </div>
          {promoInfo && (
            <div className="flex justify-between text-xs text-emerald-400/80 pt-1 border-t border-emerald-400/10">
              <span>Promo {promoInfo.code}</span>
              <span>+{fmtAmount(promoInfo.creditAmountGhs, "GHS")} wallet credit</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-white/30">
            <span>Reference</span>
            <span className="font-mono text-white/50">{ref}</span>
          </div>
          <div className="flex justify-between text-xs text-white/30">
            <span>Paid to</span>
            <span className="text-white/50">{session.merchantName ?? `@${session.merchantHandle}`}</span>
          </div>
        </div>

        {/* Email receipt */}
        <div className="border-t border-white/5 pt-3 space-y-2">
          {emailSent ? (
            <p className="text-center text-xs text-emerald-400 py-1.5">Receipt sent to {receiptEmail}</p>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2">
                <Mail size={12} className="text-white/25 flex-shrink-0" />
                <input
                  type="email"
                  placeholder="Email receipt to yourself"
                  value={receiptEmail}
                  onChange={(e) => setReceiptEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-white/25 outline-none min-w-0"
                />
              </div>
              <button
                onClick={handleSendEmail}
                disabled={!receiptEmail.trim() || emailSending}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/8 hover:bg-white/12 disabled:opacity-30 transition-colors flex-shrink-0"
              >
                {emailSending ? <Loader2 size={13} className="animate-spin text-white/50" /> : <Send size={13} className="text-white/50" />}
              </button>
            </div>
          )}
          {emailError && <p className="text-xs text-red-400 text-center">{emailError}</p>}
        </div>

        <div className="border-t border-white/5 space-y-0">
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-white/25 hover:text-white/45 transition-colors py-1.5"
          >
            <Copy size={11} />
            {copied ? "Link copied!" : "Copy receipt link"}
          </button>
          <button
            onClick={() => window.print()}
            className="print:hidden w-full flex items-center justify-center gap-1.5 text-xs text-white/25 hover:text-white/45 transition-colors py-1.5 border-t border-white/5"
          >
            <Printer size={11} />
            Print receipt
          </button>
        </div>
      </div>
    </>
  );
}

function RefundScreen({ session }: { session: CheckoutSession; accent: string }) {
  const total = session.amount + (session.taxAmount ?? 0);
  const refundedAt = session.refundedAt
    ? new Date(session.refundedAt).toLocaleDateString(undefined, {
        dateStyle: "medium",
      } as Intl.DateTimeFormatOptions)
    : null;

  return (
    <div className="px-5 py-5 space-y-4">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-blue-400/10 border border-blue-400/20">
          <RotateCcw size={24} className="text-blue-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-white">Payment refunded</p>
          {refundedAt && <p className="text-xs text-white/30 mt-0.5">Processed on {refundedAt}</p>}
        </div>
      </div>
      <div className="bg-white/4 rounded-xl px-4 py-3 space-y-2">
        <div className="flex justify-between text-sm text-white/50">
          <span>Refund amount</span>
          <span className="font-mono text-blue-300">{fmtAmount(total, session.currency)}</span>
        </div>
        <div className="flex justify-between text-xs text-white/30">
          <span>Refunded by</span>
          <span>{session.merchantName ?? "Merchant"}</span>
        </div>
        <div className="flex justify-between text-xs text-white/30 pt-1 border-t border-white/5">
          <span>Return to</span>
          <span>Original payment method</span>
        </div>
      </div>
      <p className="text-xs text-white/25 text-center">
        Funds typically appear within 1–3 business days
      </p>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("review");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // auth
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");

  // 2FA
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [twoFaMode, setTwoFaMode] = useState<TwoFaMode>("totp");
  const [twoFaCode, setTwoFaCode] = useState("");

  // review extras
  const [qrView, setQrView] = useState(false);
  const [promoExpanded, setPromoExpanded] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoInfo, setPromoInfo] = useState<PromoInfo | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSession(sessionId);
      setSession(s);
      if (s.status !== "PENDING") setStep("success");
    } catch (e: any) {
      setLoadError(e.message ?? "Payment link not found");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  // Poll for completion when QR code is shown
  useEffect(() => {
    if (!qrView) return;
    const interval = setInterval(async () => {
      try {
        const s = await getSession(sessionId);
        if (s.status !== "PENDING") {
          setSession(s);
          setStep("success");
          setQrView(false);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [qrView, sessionId]);

  const accent = session?.merchantBrandColor ?? "#B7EE7A";

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await loginStep1(identifier, password);
      // The backend decides whether a second factor is needed. Only regular
      // customers with no 2FA get an OTP; staff/2FA accounts return a preAuthToken,
      // and a direct login returns a token. Route to whichever step actually applies
      // instead of always sitting on the OTP screen waiting for a code that may
      // never have been sent.
      if (result && typeof result === "object") {
        if (result.preAuthToken) {
          setPreAuthToken(result.preAuthToken);
          setTwoFaMode("totp");
          setTwoFaCode("");
          setStep("2fa");
          return;
        }
        if (result.accessToken) {
          setToken(result.accessToken);
          setStep("passcode");
          return;
        }
      }
      // No token and no preAuthToken → an OTP was sent; collect it.
      setStep("otp");
    } catch (e: any) {
      setError(e.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await loginStep2(identifier, otp);
      if (result.preAuthToken) {
        setPreAuthToken(result.preAuthToken);
        setTwoFaMode("totp");
        setTwoFaCode("");
        setStep("2fa");
      } else {
        setToken(result.accessToken);
        setStep("passcode");
      }
    } catch (e: any) {
      setError(e.message ?? "OTP verification failed");
    } finally {
      setBusy(false);
    }
  };

  const handle2fa = async () => {
    if (!preAuthToken) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        twoFaMode === "totp"
          ? await login2faTotp(preAuthToken, twoFaCode)
          : await verify2faOtp(preAuthToken, twoFaCode, twoFaMode === "sms" ? "SMS" : "EMAIL");
      setToken(result.accessToken);
      setStep("passcode");
    } catch (e: any) {
      setError(e.message ?? "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const requestAlt2fa = async (mode: "sms" | "email") => {
    if (!preAuthToken) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "sms") await request2faSms(preAuthToken);
      else await request2faEmail(preAuthToken);
      setTwoFaMode(mode);
      setTwoFaCode("");
    } catch (e: any) {
      setError(e.message ?? "Failed to send code");
    } finally {
      setBusy(false);
    }
  };

  const handlePromoValidate = async () => {
    setPromoErr(null);
    setPromoLoading(true);
    try {
      const info = await validatePromoCode(promoCode.trim());
      setPromoInfo(info);
    } catch (e: any) {
      setPromoErr(e.message ?? "Invalid promo code");
      setPromoInfo(null);
    } finally {
      setPromoLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const completed = await confirmPayment(sessionId, passcode, token);
      setSession(completed);
      setStep("success");
      // Fire-and-forget promo redemption — payment is already done
      if (promoInfo) redeemPromoCode(promoCode, token).catch(() => {});
      if (completed.successUrl) {
        setTimeout(() => { window.location.href = completed.successUrl!; }, 3000);
      }
    } catch (e: any) {
      setError(e.message ?? "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-white/20" size={28} />
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 mx-auto flex items-center justify-center">
            <AlertCircle size={22} className="text-white/30" />
          </div>
          <p className="text-base font-semibold text-white">Link not found</p>
          <p className="text-sm text-white/35">
            {loadError ?? "This payment link is invalid or has been removed."}
          </p>
        </div>
        <PoweredBy />
      </div>
    );
  }

  const renderTerminal = () => {
    if (step === "success" && session.status === "COMPLETED") {
      return <SuccessReceipt session={session} accent={accent} promoInfo={promoInfo} />;
    }
    if (session.status === "REFUNDED") {
      return <RefundScreen session={session} accent={accent} />;
    }
    if (session.status === "EXPIRED") {
      return (
        <div className="text-center px-5 py-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 mx-auto flex items-center justify-center">
            <Clock size={22} className="text-white/30" />
          </div>
          <p className="text-base font-semibold text-white">Link expired</p>
          <p className="text-sm text-white/40">
            This payment link has expired. Contact the merchant for a new one.
          </p>
        </div>
      );
    }
    if (session.status === "CANCELLED") {
      return (
        <div className="text-center px-5 py-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto flex items-center justify-center">
            <XCircle size={22} className="text-red-400" />
          </div>
          <p className="text-base font-semibold text-white">Payment cancelled</p>
          <p className="text-sm text-white/40">
            This payment session was cancelled by the merchant.
          </p>
        </div>
      );
    }
    return null;
  };

  const isTerminal = session.status !== "PENDING" || step === "success";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-3">
        <Card accent={accent}>
          <MerchantHeader session={session} accent={accent} />

          {isTerminal ? (
            renderTerminal()
          ) : (
            <>
              <AmountBlock session={session} accent={accent} />

              <div className="border-t border-white/5 px-5 py-5 space-y-4">

                {/* ── REVIEW ── */}
                {step === "review" && (
                  <>
                    {session.merchantCheckoutTagline && (
                      <p className="text-xs text-white/40 -mt-1">{session.merchantCheckoutTagline}</p>
                    )}

                    {/* Pay method tab switcher */}
                    <div className="flex p-1 bg-white/5 rounded-xl gap-1">
                      <button
                        onClick={() => setQrView(false)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          !qrView ? "bg-white/10 text-white" : "text-white/35 hover:text-white/55"
                        }`}
                      >
                        AZA Wallet
                      </button>
                      <button
                        onClick={() => setQrView(true)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          qrView ? "bg-white/10 text-white" : "text-white/35 hover:text-white/55"
                        }`}
                      >
                        Scan with App
                      </button>
                    </div>

                    {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}

                    {!qrView ? (
                      <>
                        <PrimaryBtn accent={accent} onClick={() => setStep("login")}>
                          Pay with AZA Wallet <ArrowRight size={15} />
                        </PrimaryBtn>

                        {/* Promo code section */}
                        <div className="border-t border-white/5 pt-3">
                          {!promoExpanded ? (
                            <button
                              onClick={() => setPromoExpanded(true)}
                              className="text-xs text-white/30 hover:text-white/50 transition-colors flex items-center gap-1.5"
                            >
                              <Tag size={11} /> Have a promo code?
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">
                                  Promo code
                                </label>
                                {!promoInfo && (
                                  <button
                                    onClick={() => {
                                      setPromoExpanded(false);
                                      setPromoErr(null);
                                      setPromoCode("");
                                    }}
                                    className="text-xs text-white/20 hover:text-white/40"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>

                              {promoInfo ? (
                                <div className="flex items-start justify-between bg-emerald-400/8 border border-emerald-400/20 rounded-xl px-3 py-2.5">
                                  <div>
                                    <p className="text-xs font-bold text-emerald-400">{promoInfo.code}</p>
                                    <p className="text-[11px] text-emerald-400/60 mt-0.5">
                                      {promoInfo.description ??
                                        `+${fmtAmount(promoInfo.creditAmountGhs, "GHS")} wallet credit after payment`}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setPromoInfo(null);
                                      setPromoCode("");
                                      setPromoErr(null);
                                    }}
                                    className="text-white/25 hover:text-white/50 text-lg leading-none ml-2 mt-0.5"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={promoCode}
                                      onChange={(e) => {
                                        setPromoCode(e.target.value.toUpperCase());
                                        setPromoErr(null);
                                      }}
                                      onKeyDown={(e) =>
                                        e.key === "Enter" &&
                                        promoCode.trim() &&
                                        !promoLoading &&
                                        handlePromoValidate()
                                      }
                                      placeholder="SAVE10"
                                      className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 tracking-wider font-mono"
                                    />
                                    <button
                                      onClick={handlePromoValidate}
                                      disabled={!promoCode.trim() || promoLoading}
                                      className="px-3.5 py-2 rounded-xl bg-white/8 text-xs font-semibold text-white/60 hover:bg-white/15 disabled:opacity-40 transition-all flex items-center gap-1"
                                    >
                                      {promoLoading ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        "Apply"
                                      )}
                                    </button>
                                  </div>
                                  {promoErr && (
                                    <p className="text-xs text-red-400">{promoErr}</p>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-1">
                        <div className="bg-white p-3 rounded-2xl">
                          <QRCodeSVG value={`aza://pay/${sessionId}`} size={160} level="M" />
                        </div>
                        <p className="text-xs text-white/35 text-center leading-relaxed">
                          Open the AZA app and scan this code to pay
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-white/20">
                          <Loader2 size={10} className="animate-spin" />
                          Waiting for payment…
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── LOGIN ── */}
                {step === "login" && (
                  <>
                    <div className="flex items-center gap-2 -mt-1 mb-1">
                      <button
                        onClick={() => { setStep("review"); setError(null); }}
                        className="text-white/30 hover:text-white/60 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <p className="text-sm font-semibold text-white">Sign in to AZA</p>
                    </div>
                    {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5 block">
                          Email or phone
                        </label>
                        <input
                          type="text"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && !busy && identifier && password && handleLogin()
                          }
                          placeholder="you@example.com"
                          autoComplete="username"
                          className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5 block">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && !busy && identifier && password && handleLogin()
                            }
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw(!showPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50"
                          >
                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <PrimaryBtn
                      accent={accent}
                      loading={busy}
                      disabled={!identifier.trim() || !password.trim()}
                      onClick={handleLogin}
                    >
                      Continue <ArrowRight size={15} />
                    </PrimaryBtn>
                  </>
                )}

                {/* ── OTP ── */}
                {step === "otp" && (
                  <>
                    <div className="flex items-center gap-2 -mt-1 mb-1">
                      <button
                        onClick={() => { setStep("login"); setError(null); setOtp(""); }}
                        className="text-white/30 hover:text-white/60 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <p className="text-sm font-semibold text-white">Enter OTP</p>
                    </div>
                    <p className="text-xs text-white/35 -mt-1">
                      A one-time code was sent to {identifier}
                    </p>
                    {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                    <div>
                      <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5 block">
                        6-digit code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && !busy && handleOtp()}
                        placeholder="000000"
                        className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 tracking-widest text-center font-mono text-lg"
                        autoFocus
                      />
                    </div>
                    <PrimaryBtn
                      accent={accent}
                      loading={busy}
                      disabled={otp.length !== 6}
                      onClick={handleOtp}
                    >
                      Verify <ArrowRight size={15} />
                    </PrimaryBtn>
                  </>
                )}

                {/* ── 2FA ── */}
                {step === "2fa" && (
                  <>
                    <div className="flex items-center gap-2 -mt-1 mb-1">
                      <button
                        onClick={() => {
                          setStep("otp");
                          setError(null);
                          setTwoFaCode("");
                          setTwoFaMode("totp");
                        }}
                        className="text-white/30 hover:text-white/60 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <p className="text-sm font-semibold text-white">Two-factor authentication</p>
                    </div>
                    <p className="text-xs text-white/35 -mt-1">
                      {twoFaMode === "totp"
                        ? "Enter the 6-digit code from your authenticator app"
                        : `A verification code was sent to your ${twoFaMode === "sms" ? "phone" : "email"}`}
                    </p>
                    {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                    <div>
                      <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5 block">
                        {twoFaMode === "totp" ? "Authenticator code" : "Verification code"}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        onKeyDown={(e) =>
                          e.key === "Enter" && twoFaCode.length === 6 && !busy && handle2fa()
                        }
                        placeholder="000000"
                        className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 tracking-widest text-center font-mono text-lg"
                        autoFocus
                      />
                    </div>
                    <PrimaryBtn
                      accent={accent}
                      loading={busy}
                      disabled={twoFaCode.length !== 6}
                      onClick={handle2fa}
                    >
                      Verify <ArrowRight size={15} />
                    </PrimaryBtn>
                    <div className="flex items-center justify-center gap-3 pt-1 border-t border-white/5 flex-wrap">
                      {twoFaMode !== "totp" && (
                        <button
                          onClick={() => { setTwoFaMode("totp"); setTwoFaCode(""); setError(null); }}
                          className="text-[11px] text-white/30 hover:text-white/50 transition-colors"
                        >
                          Use authenticator app
                        </button>
                      )}
                      {twoFaMode !== "sms" && (
                        <button
                          onClick={() => requestAlt2fa("sms")}
                          disabled={busy}
                          className="text-[11px] text-white/30 hover:text-white/50 transition-colors disabled:opacity-40"
                        >
                          Send SMS code
                        </button>
                      )}
                      {twoFaMode !== "email" && (
                        <button
                          onClick={() => requestAlt2fa("email")}
                          disabled={busy}
                          className="text-[11px] text-white/30 hover:text-white/50 transition-colors disabled:opacity-40"
                        >
                          Send email code
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* ── PASSCODE ── */}
                {step === "passcode" && (
                  <>
                    <div className="flex items-center gap-2 -mt-1 mb-1">
                      <ShieldCheck size={15} style={{ color: accent }} />
                      <p className="text-sm font-semibold text-white">Confirm payment</p>
                    </div>
                    <div className="bg-white/4 rounded-xl px-4 py-3 -mt-1">
                      <p className="text-xs text-white/40 mb-0.5">You are paying</p>
                      <p className="text-lg font-bold" style={{ color: accent }}>
                        {fmtAmount(
                          session.amount + (session.taxAmount ?? 0),
                          session.currency
                        )}
                      </p>
                      <p className="text-xs text-white/30">
                        to {session.merchantName ?? `@${session.merchantHandle}`}
                      </p>
                    </div>
                    {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                    <PinPad value={passcode} onChange={setPasscode} accent={accent} />
                    <PrimaryBtn
                      accent={accent}
                      loading={busy}
                      disabled={passcode.length !== 4}
                      onClick={handleConfirm}
                    >
                      Pay now <ShieldCheck size={15} />
                    </PrimaryBtn>
                  </>
                )}
              </div>
            </>
          )}
        </Card>

        {session.merchantSupportEmail && !isTerminal && (
          <p className="text-center text-[11px] text-white/20">
            Need help?{" "}
            <a
              href={`mailto:${session.merchantSupportEmail}`}
              className="text-white/35 underline"
            >
              Contact {session.merchantName ?? "the merchant"}
            </a>
          </p>
        )}

        <PoweredBy />
      </div>
    </div>
  );
}
