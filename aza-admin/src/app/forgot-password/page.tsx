"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestPasswordReset, confirmPasswordReset } from "@/lib/admin-api";
import { Eye, EyeOff, Loader2, Lock, AtSign, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { DecorIcon } from "@/components/decor-icon";
import { ThemeToggle } from "@/components/theme-toggle";

type Step = "identifier" | "reset" | "done";

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await requestPasswordReset(identifier.trim());
      setStep("reset");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send the reset code");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await requestPasswordReset(identifier.trim());
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice("A new code is on its way.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resend the code");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
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
      await confirmPasswordReset(identifier.trim(), code.trim(), password);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not reset your password");
    } finally {
      setLoading(false);
    }
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
              <h1 className="font-bold text-2xl tracking-wide">
                {step === "done" ? "Password updated" : "Reset password"}
              </h1>
              <p className="text-base text-muted-foreground">
                {step === "identifier" &&
                  "We'll send a 6-digit code to your staff email or phone."}
                {step === "reset" && (
                  <>
                    If an account exists for{" "}
                    <span className="text-foreground font-medium">{identifier.trim()}</span>, a code
                    is on its way.
                  </>
                )}
                {step === "done" &&
                  "You've been signed out everywhere else. Sign in with your new password."}
              </p>
            </div>
          </div>

          {/* Step 1 — identifier */}
          {step === "identifier" && (
            <form onSubmit={handleRequestCode} className="space-y-3">
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

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="w-full h-9 bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold border-0"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Send reset code
              </Button>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
              >
                ← Back to login
              </button>
            </form>
          )}

          {/* Step 2 — code + new password */}
          {step === "reset" && (
            <form onSubmit={handleReset} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Verification code</label>
                <InputGroup>
                  <InputGroupInput
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
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
                    type={showPass ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
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
                    type={showPass ? "text" : "password"}
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

              {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                disabled={loading || code.length !== 6 || !passwordStrong || !passwordsMatch}
                className="w-full h-9 bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold border-0"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Reset password
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
                  setError("");
                  setNotice("");
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
              >
                ← Use a different email or phone
              </button>
            </form>
          )}

          {/* Step 3 — done */}
          {step === "done" && (
            <div className="space-y-3">
              <CheckCircle2 size={28} className="text-[#B7EE7A]" />
              <Button
                type="button"
                onClick={() => router.replace("/login")}
                className="w-full h-9 bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold border-0"
              >
                Back to login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
