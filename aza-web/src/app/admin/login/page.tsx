"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminLoginStep1,
  adminLoginStep2,
  adminLoginTotp,
  saveTokens,
} from "@/lib/admin-api";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";

type Step = "credentials" | "otp" | "totp";

export default function AdminLoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("credentials");

  // Credentials
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // OTP
  const [otpCode, setOtpCode] = useState("");

  // TOTP
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
      router.replace("/admin/dashboard");
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
      router.replace("/admin/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#F5A623]/15 mb-4">
            <Lock size={22} className="text-[#F5A623]" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Admin Portal</h1>
          <p className="text-white/50 text-sm mt-1">AZA Internal Dashboard</p>
        </div>

        {step === "credentials" && (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Email or Phone</label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                autoFocus
                placeholder="admin@aza.app"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#F5A623]/50 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#F5A623]/50 text-sm pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#F5A623] text-black font-semibold text-sm hover:bg-[#F5A623]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Continue
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtp} className="space-y-4">
            <p className="text-white/60 text-sm text-center">
              Enter the OTP sent to your email or phone.
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value)}
              required
              autoFocus
              placeholder="Enter OTP"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#F5A623]/50 text-center text-xl tracking-widest"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#F5A623] text-black font-semibold text-sm hover:bg-[#F5A623]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Verify OTP
            </button>
            <button
              type="button"
              onClick={() => { setStep("credentials"); setError(""); setOtpCode(""); }}
              className="w-full text-sm text-white/40 hover:text-white/70"
            >
              ← Back
            </button>
          </form>
        )}

        {step === "totp" && (
          <form onSubmit={handleTotp} className="space-y-4">
            <p className="text-white/60 text-sm text-center">
              Enter the 6-digit code from your authenticator app.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={totpCode}
              onChange={e => setTotpCode(e.target.value)}
              required
              autoFocus
              placeholder="000000"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#F5A623]/50 text-center text-xl tracking-[0.4em]"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#F5A623] text-black font-semibold text-sm hover:bg-[#F5A623]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Verify
            </button>
            <button
              type="button"
              onClick={() => { setStep("credentials"); setError(""); setTotpCode(""); }}
              className="w-full text-sm text-white/40 hover:text-white/70"
            >
              ← Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
