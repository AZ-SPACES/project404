'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ArrowLeft, Eye, EyeOff, QrCode, RefreshCw } from 'lucide-react';

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
  const [focused, setFocused] = useState<{ identifier?: boolean; password?: boolean }>({});
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
      startQrSession();
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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0e2a0e 0%, #132613 60%, #0a1a0a 100%)' }}
    >
      {/* Back link */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded"
        style={{ color: 'rgba(183,238,122,0.6)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--aza-accent)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(183,238,122,0.6)')}
      >
        <ArrowLeft size={15} />
        Back to aza
      </Link>

      {/* Card */}
      <div
        className="w-full max-w-[420px] rounded-3xl p-8"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(183,238,122,0.12)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <Image src="/logo.png" alt="AZA" width={71} height={32} className="h-8 w-auto" />
          <span className="text-white font-extrabold text-lg" style={{ letterSpacing: '-0.04em' }}>
            <span style={{ color: 'rgba(183,238,122,0.6)', fontWeight: 500, fontSize: '0.8rem' }}>developers</span>
          </span>
        </div>

        {/* Mode toggle — only on the first password step */}
        {step === 'credentials' && (
          <div
            className="flex rounded-xl overflow-hidden mb-6"
            style={{ border: '1px solid rgba(183,238,122,0.15)' }}
          >
            <button
              type="button"
              onClick={() => { setMode('password'); setError(''); }}
              className="flex-1 py-2 text-sm font-semibold transition-all"
              style={
                mode === 'password'
                  ? { background: '#B7EE7A', color: '#174717' }
                  : { background: 'transparent', color: 'rgba(255,255,255,0.4)' }
              }
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setMode('qr')}
              className="flex-1 py-2 text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
              style={
                mode === 'qr'
                  ? { background: '#B7EE7A', color: '#174717' }
                  : { background: 'transparent', color: 'rgba(255,255,255,0.4)' }
              }
            >
              <QrCode size={14} />
              AZA App
            </button>
          </div>
        )}

        {/* ── QR Login Panel ── */}
        {mode === 'qr' && step === 'credentials' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Open the AZA app and scan this code to sign in.
            </p>

            {/* Loading skeleton */}
            {qrLoading && (
              <div
                className="flex items-center justify-center rounded-2xl"
                style={{
                  width: 220, height: 220,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(183,238,122,0.1)',
                }}
              >
                <Loader2 size={28} className="animate-spin" style={{ color: 'rgba(183,238,122,0.5)' }} />
              </div>
            )}

            {/* QR image */}
            {!qrLoading && qrSession && qrStatus === 'PENDING' && (
              <>
                <div
                  className="rounded-2xl p-2.5"
                  style={{ background: '#fff', border: '1px solid rgba(183,238,122,0.2)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL can't go through next/image */}
                  <img
                    src={`data:image/png;base64,${qrSession.qrImageBase64}`}
                    alt="QR Code"
                    style={{ width: 200, height: 200, display: 'block' }}
                  />
                </div>
                <div className="flex items-center gap-1.5" style={{ color: 'rgba(183,238,122,0.5)' }}>
                  <span className="text-xs font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {qrSecondsLeft}s
                  </span>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ width: 80, background: 'rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(qrSecondsLeft / (qrSession.ttlSeconds || 90)) * 100}%`,
                        background: qrSecondsLeft > 20 ? '#B7EE7A' : '#f87171',
                        transition: 'width 1s linear',
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Approved — completing login */}
            {!qrLoading && qrStatus === 'APPROVED' && (
              <div className="flex flex-col items-center gap-2 py-6">
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--aza-accent)' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Signing you in…</p>
              </div>
            )}

            {/* Expired */}
            {!qrLoading && qrStatus === 'EXPIRED' && (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>QR code expired.</p>
                <button
                  type="button"
                  onClick={startQrSession}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(183,238,122,0.12)', color: '#B7EE7A', border: '1px solid rgba(183,238,122,0.2)' }}
                >
                  <RefreshCw size={13} />
                  Refresh QR code
                </button>
              </div>
            )}

            {qrError && qrStatus !== 'APPROVED' && (
              <p className="text-sm text-center px-2" style={{ color: '#f87171' }}>{qrError}</p>
            )}

            <button
              type="button"
              onClick={() => setMode('password')}
              className="text-sm transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
            >
              Sign in with password instead
            </button>
          </div>
        )}

        {/* ── Password flow ── */}
        {mode === 'password' && (
          <>
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-8">
              {steps.map((s, i) => (
                <React.Fragment key={s}>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                      style={
                        i < stepIndex
                          ? { background: '#B7EE7A', color: '#174717' }
                          : i === stepIndex
                          ? { background: 'rgba(183,238,122,0.25)', border: '1.5px solid #B7EE7A', color: '#B7EE7A' }
                          : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }
                      }
                    >
                      {i < stepIndex ? '✓' : i + 1}
                    </div>
                    <span
                      className="text-xs font-medium hidden sm:block"
                      style={{ color: i === stepIndex ? '#B7EE7A' : 'rgba(255,255,255,0.25)' }}
                    >
                      {s}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="flex-1 h-px"
                      style={{ background: i < stepIndex ? 'rgba(183,238,122,0.4)' : 'rgba(255,255,255,0.08)' }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* ── Step 1: Credentials ── */}
            {step === 'credentials' && (
              <form onSubmit={handleCredentials} className="flex flex-col gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white mb-1" style={{ letterSpacing: '-0.03em' }}>
                    Sign in to the API Explorer
                  </h1>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Use your AZA account credentials.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(183,238,122,0.6)' }}>
                    Email or phone
                  </label>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="you@example.com"
                    value={identifier}
                    onChange={e => { setIdentifier(e.target.value); if (fieldErrors.identifier) setFieldErrors(p => ({ ...p, identifier: undefined })); }}
                    className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all focus-visible:outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${focused.identifier ? 'rgba(183,238,122,0.4)' : fieldErrors.identifier ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'}` }}
                    onFocus={() => setFocused(p => ({ ...p, identifier: true }))}
                    onBlur={() => setFocused(p => ({ ...p, identifier: false }))}
                    aria-describedby={fieldErrors.identifier ? 'err-identifier' : undefined}
                    aria-invalid={!!fieldErrors.identifier}
                  />
                  {fieldErrors.identifier && (
                    <p id="err-identifier" className="text-xs" style={{ color: '#f87171' }}>{fieldErrors.identifier}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(183,238,122,0.6)' }}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined })); }}
                      className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white outline-none transition-all focus-visible:outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${focused.password ? 'rgba(183,238,122,0.4)' : fieldErrors.password ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'}` }}
                      onFocus={() => setFocused(p => ({ ...p, password: true }))}
                      onBlur={() => setFocused(p => ({ ...p, password: false }))}
                      aria-describedby={fieldErrors.password ? 'err-password' : undefined}
                      aria-invalid={!!fieldErrors.password}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p id="err-password" className="text-xs" style={{ color: '#f87171' }}>{fieldErrors.password}</p>
                  )}
                </div>

                {error && (
                  <p className="text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-60"
                  style={{ background: 'var(--aza-accent)', color: 'var(--aza-primary)' }}
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  Continue
                </button>

                <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Don&apos;t have an account?{' '}
                  <a href="/developers/signup" style={{ color: '#B7EE7A', fontWeight: 600 }}>
                    Sign up
                  </a>
                </p>
              </form>
            )}

            {/* ── Step 2: OTP ── */}
            {step === 'otp' && (
              <form onSubmit={handleOtp} className="flex flex-col gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white mb-1" style={{ letterSpacing: '-0.03em' }}>
                    Check your {identifier.includes('@') ? 'email' : 'phone'}
                  </h1>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    We sent a 6-digit code to <strong className="text-white/70">{identifier}</strong>.
                  </p>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(183,238,122,0.6)' }}>
                    One-time code
                  </span>
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
                    className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none tracking-[0.3em] text-center transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontFamily: 'monospace',
                      fontSize: '1.4rem',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(183,238,122,0.4)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                </label>

                {error && (
                  <p className="text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-60"
                  style={{ background: 'var(--aza-accent)', color: 'var(--aza-primary)' }}
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  Verify code
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setOtp(''); setError(''); }}
                  className="text-sm text-center transition-colors"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                >
                  ← Back
                </button>
              </form>
            )}

            {/* ── Step 3: TOTP ── */}
            {step === 'totp' && (
              <form onSubmit={handleTotp} className="flex flex-col gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white mb-1" style={{ letterSpacing: '-0.03em' }}>
                    Authenticator app
                  </h1>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Enter the 6-digit code from your authenticator app.
                  </p>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(183,238,122,0.6)' }}>
                    Authenticator code
                  </span>
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
                    className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none tracking-[0.3em] text-center transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      fontFamily: 'monospace',
                      fontSize: '1.4rem',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(183,238,122,0.4)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                  />
                </label>

                {error && (
                  <p className="text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || totpCode.length < 6}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-60"
                  style={{ background: 'var(--aza-accent)', color: 'var(--aza-primary)' }}
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  Sign in
                </button>
              </form>
            )}
          </>
        )}
      </div>

      <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        © {new Date().getFullYear()} Aza · Developer Portal
      </p>
    </div>
  );
}
