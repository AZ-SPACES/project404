"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  preLogin,
  verifyLoginOtp,
  getMe,
  initiateQrLogin,
  pollQrLoginStatus,
  completeQrLogin,
  type QrLoginSession,
} from "@/lib/merchant-api";
import { Loader2, Eye, EyeOff, ArrowLeft, AtSign, Phone, Lock, QrCode, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { FloatingPaths } from "@/components/floating-paths";
import { cn } from "@/lib/utils";

type Step = "credentials" | "otp";
type LoginMode = "password" | "qr";

export default function LoginPage() {
  const router = useRouter();

  // Password login state
  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPhone =
    /^\+?[\d\s\-()]{7,}$/.test(identifier.trim()) &&
    !identifier.includes("@");

  // Login mode
  const [mode, setMode] = useState<LoginMode>("password");

  // QR login state
  const [qrSession, setQrSession] = useState<QrLoginSession | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
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

  const redirectAfterQrLogin = useCallback(async () => {
    let merchant = null;
    try {
      merchant = await getMe();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("404") || msg.includes("not found")) {
        router.replace("/onboarding");
        return;
      }
      throw err;
    }
    if (!merchant) {
      router.replace("/onboarding");
      return;
    }
    const status = merchant.status;
    if (status === "ACTIVE" || status === "SUSPENDED") {
      router.replace("/dashboard");
    } else if (status === "PENDING_KYB") {
      router.replace("/onboarding");
    } else {
      router.replace("/onboarding/status");
    }
  }, [router]);

  const startQrSession = useCallback(async () => {
    setQrLoading(true);
    setQrError(null);
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
              await completeQrLogin(session.challengeToken, session.sessionSecret);
              await redirectAfterQrLogin();
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
  }, [redirectAfterQrLogin, stopPolling]);

  useEffect(() => {
    if (mode === "qr") {
      startQrSession();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [mode, startQrSession, stopPolling]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await preLogin(identifier.trim(), password);
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyLoginOtp(identifier.trim(), otp.trim());
      await redirectAfterQrLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid OTP code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
      {/* Left panel */}
      <div className="relative hidden h-full flex-col border-r border-border bg-secondary dark:bg-secondary/20 p-10 lg:flex">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background" />
        <img src="/logo.png" alt="AZA Merchants" className="mr-auto h-7 w-auto relative z-10" />
        <div className="z-10 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-xl text-foreground">
              &ldquo;AZA has transformed how we collect payments. Fast, reliable, and built for Ghana.&rdquo;
            </p>
            <footer className="font-mono font-semibold text-sm text-muted-foreground">
              ~ Kwame Asante
            </footer>
          </blockquote>
        </div>
        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
      </div>

      {/* Right panel */}
      <div className="relative flex min-h-screen flex-col justify-center px-8">
        <ThemeToggle className="absolute top-5 right-5 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" />
        <div aria-hidden className="absolute inset-0 isolate -z-10 opacity-60 contain-strict">
          <div className="absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)]" />
          <div className="absolute top-0 right-0 h-320 w-60 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] [translate:5%_-50%]" />
          <div className="absolute top-0 right-0 h-320 w-60 -translate-y-87.5 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)]" />
        </div>

        <div className="mx-auto space-y-5 sm:w-sm">
          <img src="/logo.png" alt="AZA Merchants" className="h-7 w-auto lg:hidden" />

          <div className="flex flex-col space-y-1">
            <h1 className="font-bold text-2xl tracking-wide">Sign in to your account</h1>
            <p className="text-base text-muted-foreground">Use your AZA account credentials</p>
          </div>

          {/* Mode tabs — only on credentials step */}
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

          {/* QR Login panel */}
          {mode === "qr" && step === "credentials" && (
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
                  <Loader2 size={24} className="animate-spin text-[#174717]" />
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

              {qrError && (
                <div className="px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                  {qrError}
                </div>
              )}

              <button
                type="button"
                onClick={() => setMode("password")}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer text-center"
              >
                Sign in with password instead
              </button>
            </div>
          )}

          {/* Password login — credentials step */}
          {mode === "password" && step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email or phone number</label>
                <InputGroup>
                  <InputGroupInput
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com or +233 XX XXX XXXX"
                  />
                  <InputGroupAddon align="inline-end">
                    {isPhone ? <Phone size={14} /> : <AtSign size={14} />}
                  </InputGroupAddon>
                </InputGroup>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Password</label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <Lock size={14} />
                  </InputGroupAddon>
                  <InputGroupInput
                    type={showPw ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <InputGroupAddon align="inline-end">
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </InputGroupAddon>
                </InputGroup>
              </div>

              {error && (
                <div className="px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-9 bg-[#174717] hover:bg-[#1e5e1e] text-white border-0"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? "Sending code…" : "Continue"}
              </Button>
            </form>
          )}

          {/* OTP step */}
          {step === "otp" && (
            <>
              <div className="flex flex-col space-y-1">
                <h1 className="font-bold text-2xl tracking-wide">Enter your code</h1>
                <p className="text-base text-muted-foreground">
                  We sent a 6-digit code to{" "}
                  <span className="text-foreground font-medium">{identifier.trim()}</span>
                </p>
              </div>

              <form onSubmit={handleOtp} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Verification code</label>
                  <InputGroup>
                    <InputGroupInput
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      autoFocus
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="text-center tracking-[0.4em] text-lg font-mono"
                    />
                  </InputGroup>
                  <p className="text-xs text-muted-foreground text-center">
                    Check your {isPhone ? "SMS" : "email"} for the 6-digit code
                  </p>
                </div>

                {error && (
                  <div className="px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full h-9 bg-[#174717] hover:bg-[#1e5e1e] text-white border-0"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? "Verifying…" : "Sign in"}
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setOtp(""); setError(null); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
                >
                  <ArrowLeft size={12} /> Back
                </button>
              </form>
            </>
          )}

          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#B7EE7A] hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
