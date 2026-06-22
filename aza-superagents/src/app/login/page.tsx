"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { preLogin, verifyLoginOtp } from "@/lib/superagent-api";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "otp">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await preLogin(identifier.trim(), password);
      if (result.status === "authenticated") {
        router.replace("/dashboard");
      } else if (result.status === "otp_required") {
        setStep("otp");
      } else {
        setError("This account needs the AZA app to sign in. Superagent access is for standard accounts.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await verifyLoginOtp(identifier.trim(), code.trim());
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">AZA Superagents</h1>
          <p className="mt-1 text-sm text-neutral-400">Distribute float to your agents.</p>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {step === "password" ? (
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-neutral-400">Email or phone</label>
              <input
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-600"
                autoCapitalize="none"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-400">Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-600"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-white py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-4">
            <p className="text-sm text-neutral-400">
              We sent a verification code to your email or phone. Enter it to continue.
            </p>
            <input
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-neutral-600"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-white py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={() => setStep("password")}
              className="w-full text-center text-sm text-neutral-500 hover:text-neutral-300"
            >
              Back
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
