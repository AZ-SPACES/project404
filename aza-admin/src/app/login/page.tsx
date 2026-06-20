"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  adminLoginStep1,
  adminLoginStep2,
  adminLoginTotp,
  pickOtpTwoFactorMethod,
  requestTwoFactorOtp,
  verifyTwoFactorOtp,
  type OtpTwoFactorMethod,
  type LoginResult,
  saveTokens,
  saveUser,
  isStaff,
  initiateQrLogin,
  pollQrLoginStatus,
  completeQrLogin,
  type QrLoginSession,
} from "@/lib/admin-api";
import { Eye, EyeOff, Loader2, Lock, AtSign, ShieldCheck, QrCode, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { DecorIcon } from "@/components/decor-icon";
import { ThemeToggle } from "@/components/theme-toggle";

type Step = "credentials" | "otp" | "totp";
type LoginMode = "password" | "qr";

export default function LoginPage() {
  const router = useRouter();

  // Password login state
  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [preAuthToken, setPreAuthToken] = useState("");
  // Non-null when the OTP step is verifying an emailed/SMS 2FA code (vs. the legacy login OTP).
  const [twoFaMethod, setTwoFaMethod] = useState<OtpTwoFactorMethod | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login mode
  const [mode, setMode] = useState<LoginMode>("password");

  // QR login state
  const [qrSession, setQrSession] = useState<QrLoginSession | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrStatus, setQrStatus] = useState<"PENDING" | "APPROVED" | "EXPIRED">("PENDING");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (expireTimerRef.current) {
      clearTimeout(expireTimerRef.current);
      expireTimerRef.current = null;
    }
  }, []);

  const startQrSession = useCallback(async () => {
    setQrLoading(true);
    setQrError("");
    setQrStatus("PENDING");
    stopPolling(); // cancels any stale timers from a prior session
    try {
      const session = await initiateQrLogin();
      setQrSession(session);

      pollRef.current = setInterval(async () => {
        try {
          const status = await pollQrLoginStatus(session.challengeToken);
          setQrStatus(status as "PENDING" | "APPROVED" | "EXPIRED");
          if (status === "APPROVED") {
            stopPolling();
            try {
              const result = await completeQrLogin(session.challengeToken, session.sessionSecret);
              if (!isStaff(result.user)) {
                setQrError("This account does not have admin access.");
                return;
              }
              void saveTokens(result.accessToken, result.refreshToken);
              saveUser(result.user);
              router.replace("/step-up");
            } catch (e: unknown) {
              setQrError(e instanceof Error ? e.message : "QR login failed");
            }
          } else if (status === "EXPIRED") {
            stopPolling();
          }
        } catch {
          // Transient network error — keep polling, surface a non-fatal message.
          setQrError("Connection issue. Retrying…");
        }
      }, 2000);

      // Expire the UI once the server-side TTL has elapsed.
      expireTimerRef.current = setTimeout(() => {
        stopPolling();
        setQrStatus("EXPIRED");
      }, session.ttlSeconds * 1000);
    } catch (e: unknown) {
      setQrError(e instanceof Error ? e.message : "Failed to generate QR code");
    } finally {
      setQrLoading(false);
    }
  }, [router, stopPolling]);

  useEffect(() => {
    if (mode === "qr") {
      startQrSession();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [mode, startQrSession, stopPolling]);

  // Shared success path: enforce admin access, persist the session, and continue to step-up.
  function finalize(result: LoginResult): boolean {
    if (!isStaff(result.user)) {
      setError("This account does not have admin access.");
      return false;
    }
    void saveTokens(result.accessToken, result.refreshToken);
    saveUser(result.user);
    router.replace("/step-up");
    return true;
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await adminLoginStep1(identifier, password);
      if (result.status === "authenticated") {
        finalize(result.result);
      } else if (result.status === "two_factor_required") {
        // 2FA-enabled account. No code was sent by the login call — dispatch an emailed/SMS code
        // if available, otherwise route to the TOTP step (or the AZA App tab for app-only 2FA).
        setPreAuthToken(result.preAuthToken);
        const otpMethod = pickOtpTwoFactorMethod(result.methods, result.defaultMethod);
        if (otpMethod) {
          await requestTwoFactorOtp(result.preAuthToken, otpMethod);
          setTwoFaMethod(otpMethod);
          setStep("otp");
        } else if (result.methods.includes("TOTP")) {
          setTwoFaMethod(null);
          setStep("totp");
        } else {
          setError("This account uses app-based verification. Use the AZA App tab to sign in.");
        }
      } else {
        // Legacy staff OTP path: the backend already sent the code during login.
        setTwoFaMethod(null);
        setStep("otp");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (twoFaMethod) {
        finalize(await verifyTwoFactorOtp(preAuthToken, otpCode.trim(), twoFaMethod));
        return;
      }
      const result = await adminLoginStep2(identifier, otpCode);
      finalize(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      if (msg.startsWith("TOTP_REQUIRED:")) {
        setPreAuthToken(msg.split(":")[1]);
        setStep("totp");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      finalize(await adminLoginTotp(preAuthToken, totpCode));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  function reset(target: Step) {
    setError("");
    setOtpCode("");
    setTotpCode("");
    if (target === "credentials") setTwoFaMethod(null);
    setStep(target);
  }

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden px-6 md:px-8 bg-background">
      <ThemeToggle className="absolute top-5 right-5 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div
        className={cn(
          "relative flex w-full max-w-sm flex-col p-6 md:p-8",
          "dark:bg-[radial-gradient(50%_80%_at_20%_0%,--theme(--color-foreground/.08),transparent)]"
        )}
      >
        <div className="absolute -inset-y-6 -left-px w-px bg-border" />
        <div className="absolute -inset-y-6 -right-px w-px bg-border" />
        <div className="absolute -inset-x-6 -top-px h-px bg-border" />
        <div className="absolute -inset-x-6 -bottom-px h-px bg-border" />
        <DecorIcon position="top-left" />
        <DecorIcon position="top-right" />
        <DecorIcon position="bottom-left" />
        <DecorIcon position="bottom-right" />

        <div className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="space-y-4">
            <img src="/logo.png" alt="AZA Admin" className="h-7 w-auto" />
            <div className="space-y-1">
              <h1 className="font-bold text-2xl tracking-wide">Admin Portal</h1>
              <p className="text-base text-muted-foreground">AZA internal dashboard</p>
            </div>
          </div>

          {/* Mode tabs */}
          {step === "credentials" && (
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={cn(
                  "flex-1 py-2 text-sm font-medium transition-colors",
                  mode === "password"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode("qr")}
                className={cn(
                  "flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                  mode === "qr"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <QrCode size={14} />
                AZA App
              </button>
            </div>
          )}

          {/* QR Login */}
          {mode === "qr" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Open the AZA app and scan this code to sign in.
              </p>

              {qrLoading && (
                <div className="flex items-center justify-center h-[200px]">
                  <Loader2 size={28} className="animate-spin text-muted-foreground" />
                </div>
              )}

              {!qrLoading && qrSession && qrStatus === "PENDING" && (
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-xl border border-border p-2 bg-white">
                    <img
                      src={`data:image/png;base64,${qrSession.qrImageBase64}`}
                      alt="QR Code"
                      className="w-[200px] h-[200px]"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Code expires in {qrSession.ttlSeconds}s
                  </p>
                </div>
              )}

              {!qrLoading && qrStatus === "APPROVED" && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Loader2 size={24} className="animate-spin text-[#B7EE7A]" />
                  <p className="text-sm text-muted-foreground">Signing you in…</p>
                </div>
              )}

              {!qrLoading && qrStatus === "EXPIRED" && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <p className="text-sm text-muted-foreground">QR code expired.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startQrSession}
                    className="gap-1.5"
                  >
                    <RefreshCw size={13} />
                    Refresh
                  </Button>
                </div>
              )}

              {qrError && <p className="text-sm text-destructive text-center">{qrError}</p>}

              <button
                type="button"
                onClick={() => setMode("password")}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer text-center"
              >
                Sign in with password instead
              </button>
            </div>
          )}

          {/* Password Login */}
          {mode === "password" && (
            <>
              {step === "credentials" && (
                <form onSubmit={handleCredentials} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Email or phone</label>
                    <InputGroup>
                      <InputGroupAddon align="inline-start">
                        <AtSign size={14} />
                      </InputGroupAddon>
                      <InputGroupInput
                        type="text"
                        required
                        autoFocus
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="admin@aza.app"
                      />
                    </InputGroup>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Password</label>
                    <InputGroup>
                      <InputGroupAddon align="inline-start">
                        <Lock size={14} />
                      </InputGroupAddon>
                      <InputGroupInput
                        type={showPass ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                      <InputGroupAddon align="inline-end">
                        <button
                          type="button"
                          onClick={() => setShowPass((v) => !v)}
                          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </InputGroupAddon>
                    </InputGroup>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-9 bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold border-0"
                  >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    Continue
                  </Button>
                </form>
              )}

              {step === "otp" && (
                <form onSubmit={handleOtp} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Verification code</label>
                    <InputGroup>
                      <InputGroupInput
                        type="text"
                        inputMode="numeric"
                        required
                        autoFocus
                        autoComplete="one-time-code"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="Enter OTP"
                        className="text-center tracking-[0.3em] text-lg font-mono"
                      />
                    </InputGroup>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-9 bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold border-0"
                  >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    Verify OTP
                  </Button>

                  <button
                    type="button"
                    onClick={() => reset("credentials")}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
                  >
                    ← Back to login
                  </button>
                </form>
              )}

              {step === "totp" && (
                <form onSubmit={handleTotp} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Authenticator code</label>
                    <InputGroup>
                      <InputGroupAddon align="inline-start">
                        <ShieldCheck size={14} />
                      </InputGroupAddon>
                      <InputGroupInput
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                        autoFocus
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        placeholder="000000"
                        className="text-center tracking-[0.4em] text-lg font-mono"
                      />
                    </InputGroup>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-9 bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold border-0"
                  >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    Verify
                  </Button>

                  <button
                    type="button"
                    onClick={() => reset("credentials")}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
                  >
                    ← Back to login
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
