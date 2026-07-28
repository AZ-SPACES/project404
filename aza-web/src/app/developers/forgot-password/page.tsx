'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { AzaMark } from '@/components/AzaMark';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

type Step = 'identifier' | 'reset' | 'done';

const RESEND_COOLDOWN_SECONDS = 60;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string };
}

// ── Shared light-theme control styles (mirrors /developers/login) ─────────────
const inputBase =
  'w-full rounded-xl px-4 py-3 text-sm text-[#111827] bg-white border border-[#e5e7eb] outline-none transition-colors placeholder:text-[#9ca3af] focus:border-[#174717] focus:ring-2 focus:ring-[#174717]/15';
const inputError = 'border-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626]/15';
const labelCls = 'text-xs font-semibold text-[#6b7280]';

export default function DevForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isPhone = /^\+?[\d\s\-()]{7,}$/.test(identifier.trim()) && !identifier.includes('@');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(s => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  /**
   * The backend answers 200 whether or not the identifier exists — keep the copy identical for
   * both outcomes so this page can't be used to enumerate registered accounts.
   */
  async function sendCode(): Promise<boolean> {
    const res = await post('/api/v1/auth/forgot-password', { identifier: identifier.trim() });
    if (!res.success) {
      setError(res.error?.message ?? res.message ?? 'Could not send the reset code');
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!identifier.trim()) {
      setError('Email or phone is required');
      return;
    }
    setLoading(true);
    try {
      if (await sendCode()) setStep('reset');
    } catch {
      setError('Could not reach the API. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (await sendCode()) setNotice('A new code is on its way.');
    } catch {
      setError('Could not reach the API. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    const errs: { password?: string; confirmPassword?: string } = {};
    if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await post('/api/v1/auth/reset-password', {
        identifier: identifier.trim(),
        code,
        newPassword: password,
      });
      if (!res.success) {
        setError(res.error?.message ?? res.message ?? 'Password reset failed');
        return;
      }
      setStep('done');
    } catch {
      setError('Could not reach the API. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fa] px-4 py-14 font-sans antialiased">
      {/* Back link */}
      <Link
        href="/developers/login"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm font-medium text-[#374151] transition-colors hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] rounded"
      >
        <ArrowLeft size={15} />
        Back to sign in
      </Link>

      <main className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-8 shadow-[0_10px_40px_-16px_rgba(14,42,14,0.18)]">
          {/* Logo */}
          <div className="mb-7 flex items-center gap-2.5">
            <AzaMark size={32} className="rounded-[9px]" priority />
            <span className="text-sm font-semibold tracking-tight text-[#374151]">developers</span>
          </div>

          {/* ── Step 1: Identifier ── */}
          {step === 'identifier' && (
            <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#111827]">Reset your password</h1>
                <p className="mt-1 text-sm text-[#6b7280]">
                  Enter your email or phone and we&apos;ll send you a 6-digit code.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="fp-id" className={labelCls}>Email or phone</label>
                <input
                  id="fp-id"
                  type="text"
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  autoFocus
                  className={inputBase}
                />
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <SubmitButton loading={loading} disabled={!identifier.trim()}>Send reset code</SubmitButton>

              <p className="text-center text-sm text-[#6b7280]">
                Remembered it?{' '}
                <Link href="/developers/login" className="font-semibold text-[#174717] hover:underline">Sign in</Link>
              </p>
            </form>
          )}

          {/* ── Step 2: Code + new password ── */}
          {step === 'reset' && (
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#111827]">
                  Check your {isPhone ? 'phone' : 'email'}
                </h1>
                <p className="mt-1 text-sm text-[#6b7280]">
                  If an account exists for <strong className="text-[#374151]">{identifier.trim()}</strong>,
                  a 6-digit code is on its way.
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
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  required
                  className={`${inputBase} text-center font-mono text-2xl tracking-[0.3em]`}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="fp-pw" className={labelCls}>New password</label>
                <div className="relative">
                  <input
                    id="fp-pw"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined })); }}
                    className={`${inputBase} pr-11 ${fieldErrors.password ? inputError : ''}`}
                    aria-describedby={fieldErrors.password ? 'err-fp-password' : undefined}
                    aria-invalid={!!fieldErrors.password}
                    required
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
                  <p id="err-fp-password" className="text-xs text-[#dc2626]">{fieldErrors.password}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="fp-pw2" className={labelCls}>Confirm new password</label>
                <input
                  id="fp-pw2"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); if (fieldErrors.confirmPassword) setFieldErrors(p => ({ ...p, confirmPassword: undefined })); }}
                  className={`${inputBase} ${fieldErrors.confirmPassword ? inputError : ''}`}
                  aria-describedby={fieldErrors.confirmPassword ? 'err-fp-confirm' : undefined}
                  aria-invalid={!!fieldErrors.confirmPassword}
                  required
                />
                {fieldErrors.confirmPassword && (
                  <p id="err-fp-confirm" className="text-xs text-[#dc2626]">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              {notice && (
                <p className="rounded-xl border border-[#e5e7eb] bg-[#f8f9fa] px-4 py-3 text-sm text-[#6b7280]">
                  {notice}
                </p>
              )}
              {error && <ErrorBox>{error}</ErrorBox>}

              <SubmitButton loading={loading} disabled={code.length < 6}>Reset password</SubmitButton>

              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                className="text-center text-sm text-[#6b7280] transition-colors hover:text-[#374151] disabled:cursor-not-allowed disabled:hover:text-[#6b7280]"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('identifier');
                  setCode('');
                  setPassword('');
                  setConfirmPassword('');
                  setError('');
                  setNotice('');
                  setFieldErrors({});
                }}
                className="text-center text-sm text-[#6b7280] transition-colors hover:text-[#374151]"
              >
                ← Use a different email or phone
              </button>
            </form>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div className="flex flex-col gap-4">
              <CheckCircle2 size={30} className="text-[#2e7d2e]" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#111827]">Password updated</h1>
                <p className="mt-1 text-sm text-[#6b7280]">
                  You&apos;ve been signed out everywhere else. Sign in with your new password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.replace('/developers/login')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B7EE7A] py-3 text-sm font-bold text-[#0e2a0e] transition-all hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] focus-visible:ring-offset-2"
              >
                Back to sign in
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#9ca3af]">
          © {new Date().getFullYear()} Aza · Developer Portal
        </p>
      </main>
    </div>
  );
}

// ── Shared sub-components (mirrors /developers/login) ──────────────────────
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
