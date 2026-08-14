"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  getMandate,
  loginStep1,
  loginStep2,
  confirmMandate,
  login2faTotp,
  request2faSms,
  request2faEmail,
  verify2faOtp,
  pick2faMode,
  MandateInfo,
  TwoFaMode,
} from "@/lib/pay-api";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Eye,
  EyeOff,
  ChevronLeft,
  ShieldCheck,
  Repeat,
} from "lucide-react";

// This page is the target of the approvalUrl an OAuth ("Sign in with AZA") app receives from
// POST /oauth/mandates. It re-implements the same login → OTP → 2FA → passcode step machine as
// the hosted checkout page (aza-pay/src/app/c/[sessionId]/page.tsx) rather than importing it —
// that page's flow was deliberately kept lean for a one-off payment; a mandate approval doesn't
// need promo codes, QR pay, splits, or receipts, so duplicating the small shared bits (Card,
// PinPad, etc.) here is cheaper than threading unrelated checkout state through a shared import.

type Step = "review" | "login" | "otp" | "2fa" | "passcode" | "success" | "declined";

function fmtAmount(n: number, currency = "GHS") {
  const sym = currency === "GHS" ? "GH₵" : currency;
  return `${sym} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cadenceLabel(periodType: MandateInfo["periodType"]) {
  switch (periodType) {
    case "DAILY": return "day";
    case "WEEKLY": return "week";
    case "MONTHLY": return "month";
    default: return null;
  }
}

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
    <div className="relative bg-[#111] border rounded-3xl overflow-hidden" style={{ borderColor: `${accent}22` }}>
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${accent}55, transparent)` }}
      />
      {children}
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
  onClick, loading, disabled, accent, children,
}: {
  onClick?: () => void; loading?: boolean; disabled?: boolean; accent: string; children: React.ReactNode;
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

function PinPad({ value, onChange, accent }: { value: string; onChange: (v: string) => void; accent: string }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"] as const;
  // Aza passcodes are 4 digits (see CreatePasscodeScreen in the app) — showing six
  // dots made the pad look unfinished at the point the payment was already valid.
  const maxLen = 4;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3 py-1">
        {Array.from({ length: maxLen }, (_, i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full transition-all duration-150"
            style={i < value.length ? { background: accent, transform: "scale(1.2)" } : { background: "rgba(255,255,255,0.15)" }}
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

const accent = "#B7EE7A";

export default function MandateApprovalPage() {
  const { mandateId } = useParams<{ mandateId: string }>();

  const [mandate, setMandate] = useState<MandateInfo | null>(null);
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
  const [twoFaMethods, setTwoFaMethods] = useState<string[]>([]);
  const [twoFaCode, setTwoFaCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await getMandate(mandateId);
      setMandate(m);
      if (m.status !== "PENDING_APPROVAL") setStep(m.status === "ACTIVE" ? "success" : "declined");
    } catch (e: any) {
      setLoadError(e.message ?? "This mandate link is invalid or has expired");
    } finally {
      setLoading(false);
    }
  }, [mandateId]);

  useEffect(() => { load(); }, [load]);

  const startTwoFactor = async (tok: string, methods: string[], defaultMethod: string | null) => {
    const mode = pick2faMode(methods, defaultMethod);
    if (!mode) {
      setError("Your account approves sign-ins from the AZA app. Open the AZA app to approve this mandate instead.");
      return;
    }
    if (mode !== "totp") {
      try {
        if (mode === "sms") await request2faSms(tok);
        else await request2faEmail(tok);
      } catch (e: any) {
        if (!methods.includes("TOTP")) {
          setStep("login");
          setOtp("");
          throw e;
        }
        setPreAuthToken(tok);
        setTwoFaMethods(methods);
        setTwoFaMode("totp");
        setTwoFaCode("");
        setStep("2fa");
        setError("We couldn't send your code. Use your authenticator app instead.");
        return;
      }
    }
    setPreAuthToken(tok);
    setTwoFaMethods(methods);
    setTwoFaMode(mode);
    setTwoFaCode("");
    setStep("2fa");
  };

  const handleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await loginStep1(identifier, password);
      if (result.status === "otp_required") {
        setOtp("");
        setStep("otp");
      } else if (result.status === "authenticated") {
        setToken(result.accessToken);
        setStep("passcode");
      } else {
        await startTwoFactor(result.preAuthToken, result.methods, result.defaultMethod);
      }
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
      if (result.status === "two_factor_required") {
        await startTwoFactor(result.preAuthToken, result.methods, result.defaultMethod);
      } else if (result.status === "authenticated") {
        setToken(result.accessToken);
        setStep("passcode");
      } else {
        setError("OTP verification failed");
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

  const handleConfirm = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const approved = await confirmMandate(mandateId, passcode, token);
      setMandate(approved);
      setStep("success");
    } catch (e: any) {
      setError(e.message ?? "Approval failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-white/20" size={28} />
      </div>
    );
  }

  if (loadError || !mandate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 mx-auto flex items-center justify-center">
            <AlertCircle size={22} className="text-white/30" />
          </div>
          <p className="text-base font-semibold text-white">Link not found</p>
          <p className="text-sm text-white/35">{loadError ?? "This mandate link is invalid or has been removed."}</p>
        </div>
        <PoweredBy />
      </div>
    );
  }

  const cadence = cadenceLabel(mandate.periodType);
  const isTerminal = step === "success" || step === "declined";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-3">
        <Card accent={accent}>
          <div className="flex items-center gap-3 px-5 pt-5 pb-4">
            {mandate.merchantLogoUrl ? (
              <img src={mandate.merchantLogoUrl} alt={mandate.merchantName ?? "Merchant"} className="w-11 h-11 rounded-xl object-cover border border-white/8 flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-black" style={{ background: accent }}>
                {(mandate.merchantName ?? "M")[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{mandate.merchantName ?? "Merchant"}</p>
              <p className="text-[11px] text-white/35">wants to set up direct debit</p>
            </div>
          </div>

          {step === "success" ? (
            <div className="px-5 py-5 space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "#B7EE7A18", border: "1px solid #B7EE7A30" }}>
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Mandate approved</p>
                <p className="text-sm text-white/40 mt-1">
                  {mandate.merchantName} can now charge up to {fmtAmount(mandate.perChargeLimit)} per charge
                  {mandate.periodLimit != null && cadence ? `, ${fmtAmount(mandate.periodLimit)} per ${cadence}` : ""}.
                </p>
                <p className="text-xs text-white/25 mt-3">You can pause or cancel this anytime in the AZA app.</p>
              </div>
            </div>
          ) : step === "declined" ? (
            <div className="text-center px-5 py-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto flex items-center justify-center">
                <XCircle size={22} className="text-red-400" />
              </div>
              <p className="text-base font-semibold text-white">Mandate not active</p>
              <p className="text-sm text-white/40">This mandate is {mandate.status.toLowerCase().replace("_", " ")} and can no longer be approved here.</p>
            </div>
          ) : (
            <div className="border-t border-white/5 px-5 py-5 space-y-4">
              {step === "review" && (
                <>
                  <div className="bg-white/4 rounded-xl px-4 py-3 space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/50">Per charge, up to</span>
                      <span className="font-semibold text-white">{fmtAmount(mandate.perChargeLimit)}</span>
                    </div>
                    {mandate.periodLimit != null && cadence && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/50">Per {cadence}, up to</span>
                        <span className="font-semibold text-white">{fmtAmount(mandate.periodLimit)}</span>
                      </div>
                    )}
                    {mandate.reference && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/50">For</span>
                        <span className="text-white/70 text-right">{mandate.reference}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-amber-400/5 border border-amber-400/15 px-3 py-2.5">
                    <Repeat size={12} className="text-amber-400/80 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-white/45">
                      Once approved, {mandate.merchantName} can charge your wallet up to these limits without
                      asking you again each time. You can pause or cancel this anytime.
                    </p>
                  </div>
                  {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                  <PrimaryBtn accent={accent} onClick={() => setStep("login")}>
                    Continue <ArrowRight size={15} />
                  </PrimaryBtn>
                </>
              )}

              {step === "login" && (
                <>
                  <div className="flex items-center gap-2 -mt-1 mb-1">
                    <button onClick={() => { setStep("review"); setError(null); }} className="text-white/30 hover:text-white/60 transition-colors">
                      <ChevronLeft size={16} />
                    </button>
                    <p className="text-sm font-semibold text-white">Sign in to AZA</p>
                  </div>
                  {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5 block">Email or phone</label>
                      <input
                        type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !busy && identifier && password && handleLogin()}
                        placeholder="you@example.com" autoComplete="username"
                        className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5 block">Password</label>
                      <div className="relative">
                        <input
                          type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !busy && identifier && password && handleLogin()}
                          placeholder="••••••••" autoComplete="current-password"
                          className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 pr-10"
                        />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50">
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <PrimaryBtn accent={accent} loading={busy} disabled={!identifier.trim() || !password.trim()} onClick={handleLogin}>
                    Continue <ArrowRight size={15} />
                  </PrimaryBtn>
                </>
              )}

              {step === "otp" && (
                <>
                  <div className="flex items-center gap-2 -mt-1 mb-1">
                    <button onClick={() => { setStep("login"); setError(null); setOtp(""); }} className="text-white/30 hover:text-white/60 transition-colors">
                      <ChevronLeft size={16} />
                    </button>
                    <p className="text-sm font-semibold text-white">Enter OTP</p>
                  </div>
                  <p className="text-xs text-white/35 -mt-1">A one-time code was sent to {identifier}</p>
                  {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                  <div>
                    <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5 block">6-digit code</label>
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && !busy && handleOtp()}
                      placeholder="000000" autoFocus
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 tracking-widest text-center font-mono text-lg"
                    />
                  </div>
                  <PrimaryBtn accent={accent} loading={busy} disabled={otp.length !== 6} onClick={handleOtp}>
                    Verify <ArrowRight size={15} />
                  </PrimaryBtn>
                </>
              )}

              {step === "2fa" && (
                <>
                  <div className="flex items-center gap-2 -mt-1 mb-1">
                    <button
                      onClick={() => { setStep("login"); setError(null); setTwoFaCode(""); setTwoFaMode("totp"); setTwoFaMethods([]); setPreAuthToken(null); }}
                      className="text-white/30 hover:text-white/60 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <p className="text-sm font-semibold text-white">Two-factor authentication</p>
                  </div>
                  <p className="text-xs text-white/35 -mt-1">
                    {twoFaMode === "totp" ? "Enter the 6-digit code from your authenticator app" : `A verification code was sent to your ${twoFaMode === "sms" ? "phone" : "email"}`}
                  </p>
                  {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                  <div>
                    <label className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5 block">
                      {twoFaMode === "totp" ? "Authenticator code" : "Verification code"}
                    </label>
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={twoFaCode}
                      onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(e) => e.key === "Enter" && twoFaCode.length === 6 && !busy && handle2fa()}
                      placeholder="000000" autoFocus
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 tracking-widest text-center font-mono text-lg"
                    />
                  </div>
                  <PrimaryBtn accent={accent} loading={busy} disabled={twoFaCode.length !== 6} onClick={handle2fa}>
                    Verify <ArrowRight size={15} />
                  </PrimaryBtn>
                  <div className="flex items-center justify-center gap-3 pt-1 border-t border-white/5 flex-wrap">
                    {twoFaMode !== "totp" && twoFaMethods.includes("TOTP") && (
                      <button onClick={() => { setTwoFaMode("totp"); setTwoFaCode(""); setError(null); }} className="text-[11px] text-white/30 hover:text-white/50 transition-colors">
                        Use authenticator app
                      </button>
                    )}
                    {twoFaMode !== "sms" && twoFaMethods.includes("SMS") && (
                      <button onClick={() => requestAlt2fa("sms")} disabled={busy} className="text-[11px] text-white/30 hover:text-white/50 transition-colors disabled:opacity-40">
                        Send SMS code
                      </button>
                    )}
                    {twoFaMode !== "email" && twoFaMethods.includes("EMAIL") && (
                      <button onClick={() => requestAlt2fa("email")} disabled={busy} className="text-[11px] text-white/30 hover:text-white/50 transition-colors disabled:opacity-40">
                        Send email code
                      </button>
                    )}
                  </div>
                </>
              )}

              {step === "passcode" && (
                <>
                  <div className="flex items-center gap-2 -mt-1 mb-1">
                    <ShieldCheck size={15} style={{ color: accent }} />
                    <p className="text-sm font-semibold text-white">Confirm with your passcode</p>
                  </div>
                  <div className="bg-white/4 rounded-xl px-4 py-3 -mt-1">
                    <p className="text-xs text-white/40 mb-0.5">Approving {mandate.merchantName} to charge</p>
                    <p className="text-lg font-bold" style={{ color: accent }}>
                      {fmtAmount(mandate.perChargeLimit)} <span className="text-xs font-normal text-white/40">per charge</span>
                    </p>
                  </div>
                  {error && <ErrorBanner msg={error} onDismiss={() => setError(null)} />}
                  <PinPad value={passcode} onChange={setPasscode} accent={accent} />
                  <PrimaryBtn accent={accent} loading={busy} disabled={passcode.length < 4} onClick={handleConfirm}>
                    Approve mandate <ShieldCheck size={15} />
                  </PrimaryBtn>
                </>
              )}
            </div>
          )}
        </Card>

        {!isTerminal && (
          <p className="text-center text-[11px] text-white/20 px-4">
            Only approve if you initiated this from {mandate.merchantName ?? "the merchant"}&apos;s app or site.
          </p>
        )}

        <PoweredBy />
      </div>
    </div>
  );
}
