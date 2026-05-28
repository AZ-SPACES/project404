"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  getSession,
  loginStep1,
  loginStep2,
  confirmPayment,
  CheckoutSession,
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
} from "lucide-react";

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

// ── types ─────────────────────────────────────────────────────────────────────

type Step = "review" | "login" | "otp" | "passcode" | "success";

// ── subcomponents ─────────────────────────────────────────────────────────────

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

function AmountBlock({
  session,
  accent,
}: {
  session: CheckoutSession;
  accent: string;
}) {
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

// ── terminal state screens ────────────────────────────────────────────────────

function TerminalScreen({
  icon,
  iconColor,
  title,
  subtitle,
  action,
  accent,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle: string;
  action?: { label: string; href: string };
  accent: string;
}) {
  return (
    <div className="text-center px-5 py-8 space-y-3">
      <div
        className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
        style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30` }}
      >
        {icon}
      </div>
      <div>
        <p className="text-base font-semibold text-white">{title}</p>
        <p className="text-sm text-white/40 mt-1">{subtitle}</p>
      </div>
      {action && (
        <a
          href={action.href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold mt-2"
          style={{ color: accent }}
        >
          {action.label} <ArrowRight size={14} />
        </a>
      )}
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

  // auth fields
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSession(sessionId);
      setSession(s);
      // If the session is already in a terminal state, skip straight to it
      if (s.status !== "PENDING") setStep("success");
    } catch (e: any) {
      setLoadError(e.message ?? "Payment link not found");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const accent = session?.merchantBrandColor ?? "#B7EE7A";

  // ── step handlers ─────────────────────────────────────────────────────────

  const handleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await loginStep1(identifier, password);
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
        setError("TOTP (authenticator app) login is not supported on this page. Please disable 2FA or use the AZA app.");
        return;
      }
      setToken(result.accessToken);
      setStep("passcode");
    } catch (e: any) {
      setError(e.message ?? "OTP verification failed");
    } finally {
      setBusy(false);
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
      if (completed.successUrl) {
        setTimeout(() => { window.location.href = completed.successUrl!; }, 2500);
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
          <p className="text-sm text-white/35">{loadError ?? "This payment link is invalid or has been removed."}</p>
        </div>
        <PoweredBy />
      </div>
    );
  }

  // ── terminal screens ──────────────────────────────────────────────────────

  const renderTerminal = () => {
    if (step === "success" && session.status === "COMPLETED") {
      return (
        <TerminalScreen
          icon={<CheckCircle2 size={24} className="text-emerald-400" />}
          iconColor="#B7EE7A"
          title="Payment successful"
          subtitle={`${fmtAmount(session.amount, session.currency)} paid to ${session.merchantName ?? "merchant"}`}
          accent={accent}
        />
      );
    }
    if (session.status === "EXPIRED") {
      return (
        <TerminalScreen
          icon={<Clock size={24} className="text-white/30" />}
          iconColor="#ffffff"
          title="Link expired"
          subtitle="This payment link has expired. Contact the merchant for a new one."
          accent={accent}
        />
      );
    }
    if (session.status === "CANCELLED") {
      return (
        <TerminalScreen
          icon={<XCircle size={24} className="text-red-400" />}
          iconColor="#ef4444"
          title="Payment cancelled"
          subtitle="This payment session has been cancelled by the merchant."
          accent={accent}
        />
      );
    }
    if (session.status === "REFUNDED") {
      return (
        <TerminalScreen
          icon={<CheckCircle2 size={24} className="text-blue-400" />}
          iconColor="#B7EE7A"
          title="Payment refunded"
          subtitle="This payment was refunded to the original payer."
          accent={accent}
        />
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
                {/* ── REVIEW STEP ── */}
                {step === "review" && (
                  <>
                    {session.merchantCheckoutTagline && (
                      <p className="text-xs text-white/40 -mt-1">{session.merchantCheckoutTagline}</p>
                    )}
                    {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                    <PrimaryBtn accent={accent} onClick={() => setStep("login")}>
                      Pay with AZA Wallet <ArrowRight size={15} />
                    </PrimaryBtn>
                  </>
                )}

                {/* ── LOGIN STEP ── */}
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
                          onKeyDown={(e) => e.key === "Enter" && !busy && identifier && password && handleLogin()}
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
                            onKeyDown={(e) => e.key === "Enter" && !busy && identifier && password && handleLogin()}
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

                {/* ── OTP STEP ── */}
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

                {/* ── PASSCODE STEP ── */}
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
                      <p className="text-xs text-white/30">to {session.merchantName ?? `@${session.merchantHandle}`}</p>
                    </div>
                    {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                    <div>
                      <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5 block">
                        AZA wallet passcode
                      </label>
                      <div className="relative">
                        <input
                          type={showPasscode ? "text" : "password"}
                          inputMode="numeric"
                          maxLength={6}
                          value={passcode}
                          onChange={(e) => setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          onKeyDown={(e) => e.key === "Enter" && passcode.length >= 4 && !busy && handleConfirm()}
                          placeholder="••••"
                          autoFocus
                          className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 pr-10 text-center tracking-widest font-mono text-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasscode(!showPasscode)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50"
                        >
                          {showPasscode ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <PrimaryBtn
                      accent={accent}
                      loading={busy}
                      disabled={passcode.length < 4}
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

        {/* Support link */}
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
