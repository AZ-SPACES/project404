"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { preLogin, verifyLoginOtp, getMe } from "@/lib/merchant-api";
import { Loader2, Eye, EyeOff, ArrowLeft, Mail, Phone } from "lucide-react";

type Step = "credentials" | "otp";

const inputCls =
  "w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#10b981]/60 focus:bg-white/8 transition-all text-sm";

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPhone = /^\+?[\d\s\-()]{7,}$/.test(identifier.trim()) && !identifier.includes("@");

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await preLogin(identifier.trim(), password);
      setStep("otp");
    } catch (err: any) {
      setError(err.message ?? "Login failed. Check your credentials.");
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
      let merchant = null;
      try {
        merchant = await getMe();
      } catch (err: any) {
        if (err.message?.includes("404") || err.message?.includes("not found")) {
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
    } catch (err: any) {
      setError(err.message ?? "Invalid OTP code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#10b981] flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-xl font-semibold">
              aza{" "}
              <span className="text-[#10b981] text-xs font-normal">merchants</span>
            </span>
          </div>
          {step === "credentials" ? (
            <>
              <h1 className="text-2xl font-bold text-white">Sign in to your account</h1>
              <p className="text-white/45 text-sm mt-1.5">Use your AZA account credentials</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white">Enter your code</h1>
              <p className="text-white/45 text-sm mt-1.5">
                We sent a 6-digit code to{" "}
                <span className="text-white/70 font-medium">{identifier.trim()}</span>
              </p>
            </>
          )}
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Email or phone number
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25">
                  {isPhone ? <Phone size={14} /> : <Mail size={14} />}
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or +233 XX XXX XXXX"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#10b981] hover:bg-[#0ea472] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 mt-1"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Sending code…" : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Verification code
              </label>
              <input
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
                className={`${inputCls} text-center tracking-[0.4em] text-lg font-mono`}
              />
              <p className="text-[11px] text-white/25 mt-1.5 text-center">
                Check your {isPhone ? "SMS" : "email"} for the 6-digit code
              </p>
            </div>

            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-2.5 rounded-xl bg-[#10b981] hover:bg-[#0ea472] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Verifying…" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("credentials"); setOtp(""); setError(null); }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors py-1"
            >
              <ArrowLeft size={12} /> Back
            </button>
          </form>
        )}

        <p className="text-center text-xs text-white/25 mt-6">
          Don&apos;t have an AZA account?{" "}
          <a
            href="https://aza.systems"
            target="_blank"
            rel="noreferrer"
            className="text-[#10b981] hover:underline"
          >
            Download AZA
          </a>
        </p>
      </div>
    </div>
  );
}
