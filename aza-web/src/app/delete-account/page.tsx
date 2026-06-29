'use client';

/**
 * Web-based account deletion — required by Google Play (Data Safety "Data deletion"):
 * users must be able to request deletion WITHOUT reinstalling the app.
 *
 * Reuses the exact same backend flow as the mobile app:
 *   1. POST /api/v1/auth/login        (identifier + password → sends OTP)
 *   2. POST /api/v1/auth/verify-otp   (OTP → AuthResponse, or preAuthToken if 2FA)
 *   3. POST /api/v1/auth/2fa/login    (only if 2FA enabled)
 *   4. DELETE /api/v1/users/me        (schedules the same 30-day deletion as in-app)
 *
 * The access token never leaves component memory (no sessionStorage / cookies).
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

type Step = 'credentials' | 'otp' | 'totp' | 'confirm' | 'done';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string };
}

export default function DeleteAccountPage() {
  const [step, setStep] = useState<Step>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [preAuthToken, setPreAuthToken] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function post<T>(path: string, body: unknown, token?: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Email or phone and password are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await post('/api/v1/auth/login', { identifier, password });
      if (!res.success) {
        setError(res.error?.message ?? res.message ?? 'Sign in failed.');
        return;
      }
      // Password-only path returns tokens directly; otherwise an OTP was sent.
      const data = res.data as { accessToken?: string } | undefined;
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
        setStep('confirm');
      } else {
        setStep('otp');
      }
    } catch {
      setError('Could not reach Aza. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await post<{ accessToken?: string; preAuthToken?: string }>(
        '/api/v1/auth/verify-otp',
        { identifier, code: otp, purpose: 'login', deviceName: 'Account Deletion (Web)', deviceOs: 'Web' },
      );
      if (!res.success) {
        setError(res.error?.message ?? res.message ?? 'Verification failed.');
        return;
      }
      if (res.data?.preAuthToken) {
        setPreAuthToken(res.data.preAuthToken);
        setStep('totp');
      } else if (res.data?.accessToken) {
        setAccessToken(res.data.accessToken);
        setStep('confirm');
      } else {
        setError('Unexpected response. Please try again.');
      }
    } catch {
      setError('Could not reach Aza. Please try again.');
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
        setError(res.error?.message ?? res.message ?? 'Authenticator code invalid.');
        return;
      }
      setAccessToken(res.data.accessToken);
      setStep('confirm');
    } catch {
      setError('Could not reach Aza. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/users/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body: ApiResponse<unknown> = await res.json().catch(() => ({ success: res.ok }));
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Could not schedule deletion. Please try again.');
        return;
      }
      setAccessToken('');
      setPassword('');
      setStep('done');
    } catch {
      setError('Could not reach Aza. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(135deg, #0e2a0e 0%, #132613 60%, #0a1a0a 100%)' }}
    >
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A]"
        style={{ color: 'rgba(183,238,122,0.6)' }}
      >
        <ArrowLeft size={15} />
        Back to aza
      </Link>

      <main className="w-full max-w-[440px]">
        <div
          className="w-full rounded-3xl p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(183,238,122,0.12)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}
        >
          <h1 className="text-2xl font-bold text-white mb-1">Delete your account</h1>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {step === 'done'
              ? 'Your request has been received.'
              : 'Verify your identity to permanently delete your Aza account and personal data.'}
          </p>

          {error && (
            <div
              className="mb-4 rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(234,67,53,0.12)', border: '1px solid rgba(234,67,53,0.3)', color: '#FCA5A5' }}
            >
              {error}
            </div>
          )}

          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <Field label="Email or phone">
                <input
                  className={inputClass}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  placeholder="you@example.com or +233…"
                />
              </Field>
              <Field label="Password">
                <div className="relative">
                  <input
                    className={inputClass}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              <SubmitButton loading={loading}>Continue</SubmitButton>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtp} className="space-y-4">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                We sent a 6-digit code to your email/phone.
              </p>
              <Field label="Verification code">
                <input
                  className={inputClass}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="000000"
                />
              </Field>
              <SubmitButton loading={loading}>Verify</SubmitButton>
            </form>
          )}

          {step === 'totp' && (
            <form onSubmit={handleTotp} className="space-y-4">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Enter the 6-digit code from your authenticator app.
              </p>
              <Field label="Authenticator code">
                <input
                  className={inputClass}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="000000"
                />
              </Field>
              <SubmitButton loading={loading}>Verify</SubmitButton>
            </form>
          )}

          {step === 'confirm' && (
            <div className="space-y-5">
              <div
                className="rounded-xl px-4 py-4 flex gap-3"
                style={{ background: 'rgba(234,67,53,0.1)', border: '1px solid rgba(234,67,53,0.25)' }}
              >
                <ShieldAlert size={20} className="shrink-0 mt-0.5" color="#FCA5A5" />
                <div className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  <p className="font-semibold text-white mb-1">This is permanent.</p>
                  <p>
                    Your account will be scheduled for deletion. You have <strong>30 days</strong> to
                    change your mind by logging back in. After that, your personal data is permanently
                    erased. Financial transaction records are retained as required by Bank of Ghana
                    regulations.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="w-full rounded-xl py-3 font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: '#DC2626' }}
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? 'Scheduling deletion…' : 'Permanently delete my account'}
              </button>
              <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                You can also do this in the app under Settings → Security &amp; Privacy.
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <CheckCircle2 size={48} className="mx-auto" color="#B7EE7A" />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Your account has been scheduled for deletion and a confirmation has been sent to your
                email/phone. Personal data will be permanently removed after the 30-day grace period.
                To cancel, simply log back in within 30 days.
              </p>
              <Link
                href="/"
                className="inline-block rounded-xl px-5 py-2.5 text-sm font-semibold"
                style={{ background: 'rgba(183,238,122,0.15)', color: '#B7EE7A' }}
              >
                Return to aza
              </Link>
            </div>
          )}
        </div>

        <p className="text-xs text-center mt-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Need help? Contact{' '}
          <a href="mailto:support@aza.systems" className="underline">
            support@aza.systems
          </a>
        </p>
      </main>
    </div>
  );
}

const inputClass =
  'w-full rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors bg-[rgba(255,255,255,0.04)] border border-[rgba(183,238,122,0.15)] focus:border-[rgba(183,238,122,0.5)] placeholder:text-[rgba(255,255,255,0.3)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
      style={{ background: '#B7EE7A', color: '#0a1a0a' }}
    >
      {loading && <Loader2 size={18} className="animate-spin" />}
      {children}
    </button>
  );
}
