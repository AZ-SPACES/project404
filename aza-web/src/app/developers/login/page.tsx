'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, Eye, EyeOff, QrCode, RefreshCw } from 'lucide-react';
import { AzaMark } from '@/components/AzaMark';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

type Step = 'credentials' | 'otp' | 'totp';
type LoginMode = 'password' | 'qr';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string };
}

interface QrSession {
  challengeToken: string;
  sessionSecret: string;
  qrImageBase64: string;
  expiresAt: string;
  ttlSeconds: number;
}

// ── Shared light-theme control styles ────────────────────────────────────────
const inputBase =
  'w-full rounded-xl px-4 py-3 text-sm text-[#111827] bg-white border border-[#e5e7eb] outline-none transition-colors placeholder:text-[#9ca3af] focus:border-[#174717] focus:ring-2 focus:ring-[#174717]/15';
const inputError = 'border-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626]/15';
const labelCls = 'text-xs font-semibold text-[#6b7280]';

export default function DevLoginPage() {
  const router = useRouter();

  // ── Password login state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [preAuthToken, setPreAuthToken] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  // ── QR login state ───────────────────────────────────────────────────────────
  const [mode, setMode] = useState<LoginMode>('password');
  const [qrSession, setQrSession] = useState<QrSession | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  const [qrStatus, setQrStatus] = useState<'PENDING' | 'APPROVED' | 'EXPIRED'>('PENDING');
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expireRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  async function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  function finalize(token: string) {
    sessionStorage.setItem('aza_dev_token', token);
    router.push('/developers/api-explorer');
  }

  // ── QR session management ────────────────────────────────────────────────────
  const stopQr = useCallback(() => {
    if (pollRef.current)     { clearInterval(pollRef.current);     pollRef.current = null; }
    if (expireRef.current)   { clearTimeout(expireRef.current);    expireRef.current = null; }
    if (countdownRef.current){ clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const startQrSession = useCallback(async () => {
    stopQr();
    setQrLoading(true);
    setQrError('');
    setQrStatus('PENDING');
    setQrSession(null);
    try {
      const res = await fetch(`${API}/api/v1/auth/qr-login/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteType: 'DEVELOPER' }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setQrError(body.error?.message ?? 'Failed to generate QR code');
        return;
      }
      const session: QrSession = body.data;
      setQrSession(session);
      setQrSecondsLeft(session.ttlSeconds);

      // Countdown timer
      countdownRef.current = setInterval(() => {
        setQrSecondsLeft(s => Math.max(0, s - 1));
      }, 1000);

      // Poll for status every 2 seconds
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API}/api/v1/auth/qr-login/status/${session.challengeToken}`);
          const statusBody = await statusRes.json();
          const status: string = statusRes.ok && statusBody.success ? statusBody.data.status : 'EXPIRED';
          setQrStatus(status as 'PENDING' | 'APPROVED' | 'EXPIRED');

          if (status === 'APPROVED') {
            stopQr();
            try {
              const completeRes = await fetch(`${API}/api/v1/auth/qr-login/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ challengeToken: session.challengeToken, sessionSecret: session.sessionSecret }),
              });
              const completeBody = await completeRes.json();
              if (!completeRes.ok || !completeBody.success) {
                setQrError(completeBody.error?.message ?? 'QR login failed');
                return;
              }
              finalize(completeBody.data.accessToken);
            } catch {
              setQrError('Failed to complete login. Please try again.');
            }
          } else if (status === 'EXPIRED') {
            stopQr();
          }
        } catch {
          setQrError('Connection issue. Retrying…');
        }
      }, 2000);

      // Auto-expire UI when TTL runs out
      expireRef.current = setTimeout(() => {
        stopQr();
        setQrStatus('EXPIRED');
      }, session.ttlSeconds * 1000);
    } catch {
      setQrError('Could not reach the API. Make sure the backend is running.');
    } finally {
      setQrLoading(false);
    }
  }, [API, stopQr]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === 'qr') {
      startQrSession(); // eslint-disable-line react-hooks/set-state-in-effect
    } else {
      stopQr();
    }
    return () => stopQr();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Password login handlers ──────────────────────────────────────────────────
  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const errs: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) errs.identifier = 'Email or phone is required';
    if (!password) errs.password = 'Password is required';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await post('/api/v1/auth/login', { identifier, password });
      if (!res.success) {
        setError(res.error?.message ?? res.message ?? 'Login failed');
        return;
      }
      setStep('otp');
    } catch {
      setError('Could not reach the API. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await post<{ accessToken?: string; refreshToken?: string; preAuthToken?: string }>(
        '/api/v1/auth/verify-otp',
        { identifier, code: otp, purpose: 'login', deviceName: 'Developer Portal', deviceOs: 'Web' },
      );
      if (!res.success) {
        setError(res.error?.message ?? res.message ?? 'OTP verification failed');
        return;
      }
      const data = res.data;
      if (data?.preAuthToken) {
        setPreAuthToken(data.preAuthToken);
        setStep('totp');
      } else if (data?.accessToken) {
        finalize(data.accessToken);
      } else {
        setError('Unexpected response from server');
      }
    } catch {
      setError('Could not reach the API. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await post<{ accessToken: string }>('/api/v1/auth/2fa/login', {
        preAuthToken,
        code: totpCode,
      });
      if (!res.success || !res.data?.accessToken) {
        setError(res.error?.message ?? res.message ?? 'Authenticator code invalid');
        return;
      }
      finalize(res.data.accessToken);
    } catch {
      setError('Could not reach the API. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step indicator (password flow only) ─────────────────────────────────────
  const stepIndex = step === 'credentials' ? 0 : step === 'otp' ? 1 : 2;
  const steps = ['Credentials', 'Verification', '2FA'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fa] px-4 py-14 font-sans antialiased">
      {/* Back link */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm font-medium text-[#374151] transition-colors hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] rounded"
      >
        <ArrowLeft size={15} />
        Back to aza
      </Link>

      <main className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-8 shadow-[0_10px_40px_-16px_rgba(14,42,14,0.18)]">
          {/* Logo */}
          <div className="mb-7 flex items-center gap-2.5">
            <AzaMark size={32} className="rounded-[9px]" priority />
            <span className="text-sm font-semibold tracking-tight text-[#374151]">developers</span>
          </div>

          {/* Mode toggle — only on the first password step */}
          {step === 'credentials' && (
            <div className="mb-6 flex gap-1 rounded-xl bg-[#f3f4f6] p-1">
              <button
                type="button"
                onClick={() => { setMode('password'); setError(''); }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                  mode === 'password' ? 'bg-white text-[#174717] shadow-sm' : 'text-[#6b7280] hover:text-[#374151]'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode('qr')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all ${
                  mode === 'qr' ? 'bg-white text-[#174717] shadow-sm' : 'text-[#6b7280] hover:text-[#374151]'
                }`}
              >
                <QrCode size={14} />
                Aza App
              </button>
            </div>
          )}

          {/* ── QR Login Panel ── */}
          {mode === 'qr' && step === 'credentials' && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-center text-sm text-[#6b7280]">
                Open the Aza app and scan this code to sign in.
              </p>

              {qrLoading && (
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-[#e5e7eb] bg-[#f8f9fa]">
                  <Loader2 size={28} className="animate-spin text-[#2e7d2e]" />
                </div>
              )}

              {!qrLoading && qrSession && qrStatus === 'PENDING' && (
                <>
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white p-2.5 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL can't go through next/image */}
                    <img
                      src={`data:image/png;base64,${qrSession.qrImageBase64}`}
                      alt="QR Code"
                      style={{ width: 200, height: 200, display: 'block' }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[#6b7280]">
                    <span className="font-mono text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {qrSecondsLeft}s
                    </span>
                    <div className="h-1 w-20 overflow-hidden rounded-full bg-[#e5e7eb]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(qrSecondsLeft / (qrSession.ttlSeconds || 90)) * 100}%`,
                          background: qrSecondsLeft > 20 ? '#2e7d2e' : '#dc2626',
                          transition: 'width 1s linear',
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              {!qrLoading && qrStatus === 'APPROVED' && (
                <div className="flex flex-col items-center gap-2 py-6">
                  <Loader2 size={28} className="animate-spin text-[#2e7d2e]" />
                  <p className="text-sm text-[#6b7280]">Signing you in…</p>
                </div>
              )}

              {!qrLoading && qrStatus === 'EXPIRED' && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <p className="text-sm text-[#6b7280]">QR code expired.</p>
                  <button
                    type="button"
                    onClick={startQrSession}
                    className="flex items-center gap-1.5 rounded-xl border border-[#cdeab3] bg-[#eaf7e0] px-4 py-2 text-sm font-semibold text-[#174717] transition-colors hover:bg-[#e0f2d1]"
                  >
                    <RefreshCw size={13} />
                    Refresh QR code
                  </button>
                </div>
              )}

              {qrError && qrStatus !== 'APPROVED' && (
                <p className="px-2 text-center text-sm text-[#dc2626]">{qrError}</p>
              )}

              <button
                type="button"
                onClick={() => setMode('password')}
                className="text-sm text-[#6b7280] transition-colors hover:text-[#374151]"
              >
                Sign in with password instead
              </button>
            </div>
          )}

          {/* ── Password flow ── */}
          {mode === 'password' && (
            <>
              {/* Step indicator */}
              <div className="mb-8 flex items-center gap-2">
                {steps.map((s, i) => (
                  <React.Fragment key={s}>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          i < stepIndex
                            ? 'bg-[#174717] text-white'
                            : i === stepIndex
                            ? 'bg-[#eaf7e0] text-[#174717] ring-[1.5px] ring-[#174717]'
                            : 'bg-[#f3f4f6] text-[#9ca3af]'
                        }`}
                      >
                        {i < stepIndex ? '✓' : i + 1}
                      </div>
                      <span
                        className={`hidden text-xs font-medium sm:block ${
                          i === stepIndex ? 'text-[#174717]' : 'text-[#9ca3af]'
                        }`}
                      >
                        {s}
                      </span>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`h-px flex-1 ${i < stepIndex ? 'bg-[#174717]/40' : 'bg-[#e5e7eb]'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* ── Step 1: Credentials ── */}
              {step === 'credentials' && (
                <form onSubmit={handleCredentials} className="flex flex-col gap-4">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-[#111827]">Sign in to the API Explorer</h1>
                    <p className="mt-1 text-sm text-[#6b7280]">Use your Aza account credentials.</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="li-id" className={labelCls}>Email or phone</label>
                    <input
                      id="li-id"
                      type="text"
                      autoComplete="username"
                      placeholder="you@example.com"
                      value={identifier}
                      onChange={e => { setIdentifier(e.target.value); if (fieldErrors.identifier) setFieldErrors(p => ({ ...p, identifier: undefined })); }}
                      className={`${inputBase} ${fieldErrors.identifier ? inputError : ''}`}
                      aria-describedby={fieldErrors.identifier ? 'err-identifier' : undefined}
                      aria-invalid={!!fieldErrors.identifier}
                    />
                    {fieldErrors.identifier && (
                      <p id="err-identifier" className="text-xs text-[#dc2626]">{fieldErrors.identifier}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="li-pw" className={labelCls}>Password</label>
                      <Link
                        href="/developers/forgot-password"
                        className="text-xs font-semibold text-[#174717] hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <input
                        id="li-pw"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined })); }}
                        className={`${inputBase} pr-11 ${fieldErrors.password ? inputError : ''}`}
                        aria-describedby={fieldErrors.password ? 'err-password' : undefined}
                        aria-invalid={!!fieldErrors.password}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors hover:text-[#6b7280] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#174717] rounded"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p id="err-password" className="text-xs text-[#dc2626]">{fieldErrors.password}</p>
                    )}
                  </div>

                  {error && <ErrorBox>{error}</ErrorBox>}

                  <SubmitButton loading={loading}>Continue</SubmitButton>

                  <p className="text-center text-sm text-[#6b7280]">
                    Don&apos;t have an account?{' '}
                    <a href="/developers/signup" className="font-semibold text-[#174717] hover:underline">Sign up</a>
                  </p>
                </form>
              )}

              {/* ── Step 2: OTP ── */}
              {step === 'otp' && (
                <form onSubmit={handleOtp} className="flex flex-col gap-4">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-[#111827]">
                      Check your {identifier.includes('@') ? 'email' : 'phone'}
                    </h1>
                    <p className="mt-1 text-sm text-[#6b7280]">
                      We sent a 6-digit code to <strong className="text-[#374151]">{identifier}</strong>.
                    </p>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className={labelCls}>One-time code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      autoFocus
                      required
                      className={`${inputBase} text-center font-mono text-2xl tracking-[0.3em]`}
                    />
                  </label>

                  {error && <ErrorBox>{error}</ErrorBox>}

                  <SubmitButton loading={loading} disabled={otp.length < 6}>Verify code</SubmitButton>

                  <button
                    type="button"
                    onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}
                    className="text-center text-sm text-[#6b7280] transition-colors hover:text-[#374151]"
                  >
                    ← Back
                  </button>
                </form>
              )}

              {/* ── Step 3: TOTP ── */}
              {step === 'totp' && (
                <form onSubmit={handleTotp} className="flex flex-col gap-4">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-[#111827]">Authenticator app</h1>
                    <p className="mt-1 text-sm text-[#6b7280]">Enter the 6-digit code from your authenticator app.</p>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className={labelCls}>Authenticator code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      autoFocus
                      required
                      className={`${inputBase} text-center font-mono text-2xl tracking-[0.3em]`}
                    />
                  </label>

                  {error && <ErrorBox>{error}</ErrorBox>}

                  <SubmitButton loading={loading} disabled={totpCode.length < 6}>Sign in</SubmitButton>
                </form>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#9ca3af]">
          © {new Date().getFullYear()} Aza · Developer Portal
        </p>
      </main>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────
function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-[#f6c9c9] bg-[#fdeaea] px-4 py-3 text-sm text-[#c62828]">
      {children}
    </p>
  );
}

function SubmitButton({ children, loading, disabled }: { children: React.ReactNode; loading: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B7EE7A] py-3 text-sm font-bold text-[#0e2a0e] transition-all hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] focus-visible:ring-offset-2"
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}
