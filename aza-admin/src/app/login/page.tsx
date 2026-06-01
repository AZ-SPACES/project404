"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLoginStep1, adminLoginStep2, adminLoginTotp, saveTokens } from "@/lib/admin-api";
import { Eye, EyeOff, Loader2, Lock, AtSign, ShieldCheck } from "lucide-react";
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

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [preAuthToken, setPreAuthToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminLoginStep1(identifier, password);
      setStep("otp");
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
      const result = await adminLoginStep2(identifier, otpCode);
      if (result.user.role !== "ADMIN") {
        setError("This account does not have admin access.");
        return;
      }
      saveTokens(result.accessToken, result.refreshToken);
      router.replace("/dashboard");
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
      const result = await adminLoginTotp(preAuthToken, totpCode);
      if (result.user.role !== "ADMIN") {
        setError("This account does not have admin access.");
        return;
      }
      saveTokens(result.accessToken, result.refreshToken);
      router.replace("/dashboard");
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
    setStep(target);
  }

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden px-6 md:px-8 bg-background">
      {/* Theme toggle — top right */}
      <ThemeToggle className="absolute top-5 right-5 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" />

      {/* Subtle grid background */}
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
        {/* Border lines */}
        <div className="absolute -inset-y-6 -left-px w-px bg-border" />
        <div className="absolute -inset-y-6 -right-px w-px bg-border" />
        <div className="absolute -inset-x-6 -top-px h-px bg-border" />
        <div className="absolute -inset-x-6 -bottom-px h-px bg-border" />

        {/* Corner decorations */}
        <DecorIcon position="top-left" />
        <DecorIcon position="top-right" />
        <DecorIcon position="bottom-left" />
        <DecorIcon position="bottom-right" />

        <div className="space-y-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {/* Logo + heading */}
          <div className="space-y-4">
            <img src="/logo.png" alt="AZA Admin" className="h-7 w-auto" />
            <div className="space-y-1">
              {step === "credentials" && (
                <>
                  <h1 className="font-bold text-2xl tracking-wide">Admin Portal</h1>
                  <p className="text-base text-muted-foreground">AZA internal dashboard</p>
                </>
              )}
              {step === "otp" && (
                <>
                  <h1 className="font-bold text-2xl tracking-wide">Check your inbox</h1>
                  <p className="text-base text-muted-foreground">
                    Enter the OTP sent to <span className="text-foreground font-medium">{identifier}</span>
                  </p>
                </>
              )}
              {step === "totp" && (
                <>
                  <h1 className="font-bold text-2xl tracking-wide">Two-factor auth</h1>
                  <p className="text-base text-muted-foreground">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Step: Credentials */}
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

          {/* Step: OTP */}
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

          {/* Step: TOTP */}
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
        </div>
      </div>
    </div>
  );
}
