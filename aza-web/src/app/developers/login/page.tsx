'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

type Step = 'credentials' | 'otp' | 'totp';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string };
}

export default function DevLoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [preAuthToken, setPreAuthToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  // Step 1: email/phone + password → triggers OTP
  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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

  // Step 2: verify OTP
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
      const data = res.data as any;
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

  // Step 3: TOTP (2FA)
  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await post<{ accessToken: string }>('/api/v1/auth/2fa/login', {
        preAuthToken,
        code: totpCode,
      });
      if (!res.success) {
        setError(res.error?.message ?? res.message ?? 'Authenticator code invalid');
        return;
      }
      finalize((res.data as any).accessToken);
    } catch {
      setError('Could not reach the API. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  function finalize(token: string) {
    sessionStorage.setItem('aza_dev_token', token);
    router.push('/developers/api-explorer');
  }

  const stepIndex = step === 'credentials' ? 0 : step === 'otp' ? 1 : 2;
  const steps = ['Credentials', 'Verification', '2FA'];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0e2a0e 0%, #132613 60%, #0a1a0a 100%)' }}
    >
      {/* Back link */}
      <a
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium transition-colors"
        style={{ color: 'rgba(183,238,122,0.6)' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#B7EE7A')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(183,238,122,0.6)')}
      >
        <ArrowLeft size={15} />
        Back to aza
      </a>

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
        <div className="flex items-center gap-2 mb-8">
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center text-base font-black"
            style={{ background: '#B7EE7A', color: '#174717' }}
          >
            A
          </span>
          <span className="text-white font-extrabold text-lg" style={{ letterSpacing: '-0.04em' }}>
            aza <span style={{ color: 'rgba(183,238,122,0.6)', fontWeight: 500, fontSize: '0.8rem' }}>developers</span>
          </span>
        </div>

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

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(183,238,122,0.6)' }}>
                Email or phone
              </span>
              <input
                type="text"
                autoComplete="username"
                placeholder="you@example.com"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(183,238,122,0.4)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(183,238,122,0.6)' }}>
                Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(183,238,122,0.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && (
              <p className="text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-60"
              style={{ background: '#B7EE7A', color: '#174717' }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Continue
            </button>

            <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Don't have an account?{' '}
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
              style={{ background: '#B7EE7A', color: '#174717' }}
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
              style={{ background: '#B7EE7A', color: '#174717' }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Sign in
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        © {new Date().getFullYear()} Aza · Developer Portal
      </p>
    </div>
  );
}
