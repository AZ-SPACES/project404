"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  preLogin,
  verifyLoginOtp,
  initiateQrLogin,
  pollQrLoginStatus,
  completeQrLogin,
  type QrLoginSession,
} from "@/lib/superagent-api";

type Mode = "password" | "qr";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [step, setStep] = useState<"password" | "otp">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // QR sign-in state
  const [qrSession, setQrSession] = useState<QrLoginSession | null>(null);
  const [qrStatus, setQrStatus] = useState<"PENDING" | "APPROVED" | "EXPIRED">("PENDING");
  const [qrCountdown, setQrCountdown] = useState(0);
  const [qrError, setQrError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expireRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopQr = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (expireRef.current) { clearTimeout(expireRef.current); expireRef.current = null; }
  }, []);

  const startQr = useCallback(async () => {
    setQrError(null);
    setQrStatus("PENDING");
    setQrSession(null);
    stopQr();
    try {
      const session = await initiateQrLogin();
      setQrSession(session);
      setQrCountdown(session.ttlSeconds);
      countdownRef.current = setInterval(() => {
        setQrCountdown((p) => (p <= 1 ? 0 : p - 1));
      }, 1000);
      pollRef.current = setInterval(async () => {
        try {
          const status = await pollQrLoginStatus(session.challengeToken);
          setQrStatus(status);
          if (status === "APPROVED") {
            stopQr();
            try {
              await completeQrLogin(session.challengeToken, session.sessionSecret);
              router.replace("/dashboard");
            } catch (e) {
              setQrError(e instanceof Error ? e.message : "QR sign-in failed");
            }
          } else if (status === "EXPIRED") {
            stopQr();
          }
        } catch {
          setQrError("Connection issue. Retrying…");
        }
      }, 2000);
      expireRef.current = setTimeout(() => {
        stopQr();
        setQrStatus("EXPIRED");
      }, session.ttlSeconds * 1000);
    } catch (e) {
      setQrError(e instanceof Error ? e.message : "Failed to generate QR code");
    }
  }, [router, stopQr]);

  useEffect(() => {
    if (mode === "qr") startQr();
    else stopQr();
    return () => stopQr();
  }, [mode, startQr, stopQr]);

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
          <div className="mb-5 flex overflow-hidden rounded-lg border border-neutral-800">
            <button
              type="button"
              onClick={() => { setMode("password"); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "password" ? "bg-white text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => { setMode("qr"); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "qr" ? "bg-white text-black" : "text-neutral-400 hover:text-white"
              }`}
            >
              AZA App
            </button>
          </div>
        ) : null}

        {mode === "qr" && step === "password" ? (
          <div className="space-y-4">
            <p className="text-center text-sm text-neutral-400">
              Open the AZA app and scan this code to sign in.
            </p>

            {qrSession && qrStatus === "PENDING" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${qrSession.qrImageBase64}`}
                    alt="Sign-in QR code"
                    className="h-[200px] w-[200px]"
                  />
                </div>
                <p className={`text-xs ${qrCountdown < 15 ? "text-amber-400" : "text-neutral-500"}`}>
                  Code expires in {qrCountdown}s
                </p>
              </div>
            ) : null}

            {qrStatus === "APPROVED" ? (
              <p className="py-8 text-center text-sm text-neutral-400">Signing you in…</p>
            ) : null}

            {qrStatus === "PENDING" && !qrSession ? (
              <p className="py-8 text-center text-sm text-neutral-500">Generating code…</p>
            ) : null}

            {qrStatus === "EXPIRED" ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-neutral-400">QR code expired.</p>
                <button
                  type="button"
                  onClick={startQr}
                  className="rounded-lg border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:text-white"
                >
                  Refresh
                </button>
              </div>
            ) : null}

            {qrError ? (
              <div className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-center text-sm text-red-300">
                {qrError}
              </div>
            ) : null}
          </div>
        ) : step === "password" ? (
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
