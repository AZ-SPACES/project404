"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { forgotPassword, resetPassword } from "@/lib/merchant-api";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  AtSign,
  Phone,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { AuthSlideshow } from "@/components/auth-slideshow";

type Step = "identifier" | "reset" | "done";

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const isPhone =
    /^\+?[\d\s\-()]{7,}$/.test(identifier.trim()) && !identifier.includes("@");
  const passwordStrong = password.length >= 8;
  const passwordsMatch = password === confirmPassword;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await forgotPassword(identifier.trim());
      setStep("reset");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send the reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await forgotPassword(identifier.trim());
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice("A new code is on its way.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!passwordStrong) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(identifier.trim(), code.trim(), password);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not reset your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
      {/* Left panel */}
      <div className="relative hidden h-full flex-col p-10 lg:flex overflow-hidden">
        <AuthSlideshow />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/25" />
        <img src="/logo.png" alt="AZA Merchants" className="mr-auto h-7 w-auto relative z-10" />
        <div className="z-10 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-xl text-white">
              &ldquo;AZA has transformed how we collect payments. Fast, reliable, and built for Ghana.&rdquo;
            </p>
            <footer className="font-mono font-semibold text-sm text-white/50">
              ~ Kwame Asante
            </footer>
          </blockquote>
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

          {/* Step 1 — identifier */}
          {step === "identifier" && (
            <>
              <div className="flex flex-col space-y-1">
                <h1 className="font-bold text-2xl tracking-wide">Reset your password</h1>
                <p className="text-base text-muted-foreground">
                  Enter your email or phone number and we&apos;ll send you a 6-digit code.
                </p>
              </div>

              <form onSubmit={handleRequestCode} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Email or phone number</label>
                  <InputGroup>
                    <InputGroupInput
                      type="text"
                      required
                      autoFocus
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

                {error && (
                  <div className="px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !identifier.trim()}
                  className="w-full h-9 bg-[#174717] hover:bg-[#1e5e1e] text-white border-0"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? "Sending code…" : "Send reset code"}
                </Button>
              </form>
            </>
          )}

          {/* Step 2 — code + new password */}
          {step === "reset" && (
            <>
              <div className="flex flex-col space-y-1">
                <h1 className="font-bold text-2xl tracking-wide">Choose a new password</h1>
                <p className="text-base text-muted-foreground">
                  If an account exists for{" "}
                  <span className="text-foreground font-medium">{identifier.trim()}</span>, a 6-digit
                  code is on its way.
                </p>
              </div>

              <form onSubmit={handleReset} className="space-y-3">
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
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="text-center tracking-[0.4em] text-lg font-mono"
                    />
                  </InputGroup>
                  <p className="text-xs text-muted-foreground text-center">
                    Check your {isPhone ? "SMS" : "email"} for the 6-digit code
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">New password</label>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <Lock size={14} />
                    </InputGroupAddon>
                    <InputGroupInput
                      type={showPw ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
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
                  {password.length > 0 && !passwordStrong && (
                    <p className="text-xs text-destructive">Password must be at least 8 characters</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Confirm new password</label>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <Lock size={14} />
                    </InputGroupAddon>
                    <InputGroupInput
                      type={showPw ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                    />
                  </InputGroup>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                </div>

                {notice && (
                  <div className="px-3 py-2.5 rounded-lg bg-muted/50 border border-border text-muted-foreground text-sm">
                    {notice}
                  </div>
                )}

                {error && (
                  <div className="px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || code.length !== 6 || !passwordStrong || !passwordsMatch}
                  className="w-full h-9 bg-[#174717] hover:bg-[#1e5e1e] text-white border-0"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? "Resetting…" : "Reset password"}
                </Button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("identifier");
                    setCode("");
                    setPassword("");
                    setConfirmPassword("");
                    setError(null);
                    setNotice(null);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
                >
                  <ArrowLeft size={12} /> Use a different email or phone
                </button>
              </form>
            </>
          )}

          {/* Step 3 — done */}
          {step === "done" && (
            <div className="space-y-5">
              <div className="flex flex-col space-y-1">
                <CheckCircle2 size={28} className="text-[#174717] dark:text-[#B7EE7A]" />
                <h1 className="font-bold text-2xl tracking-wide">Password updated</h1>
                <p className="text-base text-muted-foreground">
                  You&apos;ve been signed out everywhere else. Sign in with your new password.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => router.replace("/login")}
                className="w-full h-9 bg-[#174717] hover:bg-[#1e5e1e] text-white border-0"
              >
                Back to sign in
              </Button>
            </div>
          )}

          {step !== "done" && (
            <p className="text-sm text-muted-foreground">
              Remembered it?{" "}
              <Link href="/login" className="text-[#B7EE7A] hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
