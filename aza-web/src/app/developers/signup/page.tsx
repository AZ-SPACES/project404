'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// Latest DOB that still makes the user 18 — computed once at module load
const MAX_DOB = new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];

type Step = 'credentials' | 'profile';

const EMPLOYMENT_OPTIONS = [
  { value: 'STUDENT',       label: 'Student'        },
  { value: 'FULL_TIME',     label: 'Full-time'      },
  { value: 'PART_TIME',     label: 'Part-time'      },
  { value: 'SELF_EMPLOYED', label: 'Self-employed'  },
  { value: 'RETIRED',       label: 'Retired'        },
  { value: 'UNEMPLOYED',    label: 'Unemployed'     },
];

export default function DevSignupPage() {
  const router = useRouter();

  const [step, setStep]           = useState<Step>('credentials');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [handle, setHandle]       = useState('');
  const [dob, setDob]             = useState('');
  const [employment, setEmployment] = useState('');
  const [error, setError]         = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string; password?: string }>({});
  const [loading, setLoading]     = useState(false);

  function nextStep(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const errs: typeof fieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address';
    if (!/^\+?[0-9]{9,15}$/.test(phone.replace(/\s/g, ''))) errs.phone = 'Enter a valid phone number (e.g. +233XXXXXXXXX)';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setStep('profile');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone,
          password,
          firstName:        firstName  || undefined,
          lastName:         lastName   || undefined,
          handle:           handle     || undefined,
          dateOfBirth:      dob        || undefined,
          employmentStatus: employment || undefined,
          deviceName: 'Developer Portal',
          deviceOs:   'Web',
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? json.message ?? 'Signup failed');
        return;
      }
      const token = json.data?.accessToken;
      if (!token) { setError('No token returned — please try logging in.'); return; }
      sessionStorage.setItem('aza_dev_token', token);
      router.push('/developers/api-explorer');
    } catch {
      setError('Could not reach the API. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  const stepIndex = step === 'credentials' ? 0 : 1;
  const steps = ['Credentials', 'Profile'];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0e2a0e 0%, #132613 60%, #0a1a0a 100%)' }}
    >
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

      <main>
      <div
        className="w-full max-w-[440px] rounded-3xl p-8"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(183,238,122,0.12)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <Image src="/logo.png" alt="AZA" width={71} height={32} className="h-8 w-auto" />
          <span className="text-white font-extrabold text-lg" style={{ letterSpacing: '-0.04em' }}>
            <span style={{ color: 'rgba(183,238,122,0.6)', fontWeight: 500, fontSize: '0.8rem' }}>developers</span>
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
                      ? { background: 'var(--aza-accent)', color: 'var(--aza-primary)' }
                      : i === stepIndex
                      ? { background: 'rgba(183,238,122,0.25)', border: '1.5px solid var(--aza-accent)', color: 'var(--aza-accent)' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }
                  }
                >
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                <span
                  className="text-xs font-medium hidden sm:block"
                  style={{ color: i === stepIndex ? 'var(--aza-accent)' : 'rgba(255,255,255,0.25)' }}
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
          <form onSubmit={nextStep} className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold text-white mb-1" style={{ letterSpacing: '-0.03em' }}>
                Create your developer account
              </h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Get access to the AZA API Explorer.
              </p>
            </div>

            <Field label="Email" htmlFor="su-email" error={fieldErrors.email}>
              <input
                id="su-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: undefined })); }}
                aria-invalid={!!fieldErrors.email}
              />
            </Field>

            <Field label="Phone number" htmlFor="su-phone" error={fieldErrors.phone}>
              <input
                id="su-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+233 XX XXX XXXX"
                value={phone}
                onChange={e => { setPhone(e.target.value); if (fieldErrors.phone) setFieldErrors(p => ({ ...p, phone: undefined })); }}
                aria-invalid={!!fieldErrors.phone}
              />
            </Field>

            <Field label="Password" htmlFor="su-password" error={fieldErrors.password}>
              <div className="relative">
                <input
                  id="su-password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined })); }}
                  aria-invalid={!!fieldErrors.password}
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <PrimaryButton loading={false}>Continue</PrimaryButton>

            <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Already have an account?{' '}
              <a href="/developers/login" style={{ color: 'var(--aza-accent)', fontWeight: 600 }} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A] rounded-sm">
                Sign in
              </a>
            </p>
          </form>
        )}

        {/* ── Step 2: Profile ── */}
        {step === 'profile' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold text-white mb-1" style={{ letterSpacing: '-0.03em' }}>
                Tell us about yourself
              </h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                All fields on this step are optional.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input
                  type="text"
                  placeholder="Kwame"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                />
              </Field>
              <Field label="Last name">
                <input
                  type="text"
                  placeholder="Mensah"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Handle">
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium select-none"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  @
                </span>
                <input
                  type="text"
                  placeholder="yourhandle"
                  value={handle}
                  onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  pattern="[a-z0-9_]{3,30}"
                  title="3–30 lowercase letters, numbers, or underscores"
                  style={{ paddingLeft: '1.75rem' }}
                />
              </div>
            </Field>

            <Field label="Date of birth">
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                max={MAX_DOB}
              />
            </Field>

            <Field label="Employment status">
              <select
                value={employment}
                onChange={e => setEmployment(e.target.value)}
              >
                <option value="">Select…</option>
                {EMPLOYMENT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            {error && (
              <p className="text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.2)' }}>
                {error}
              </p>
            )}

            <PrimaryButton loading={loading}>Create account</PrimaryButton>

            <button
              type="button"
              onClick={() => { setStep('credentials'); setError(''); }}
              className="text-sm text-center transition-colors"
              style={{ color: 'rgba(255,255,255,0.35)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
            >
              ← Back
            </button>
          </form>
        )}
      </div>
      </main>

      <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        © {new Date().getFullYear()} Aza · Developer Portal
      </p>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function Field({ label, children, error, htmlFor }: { label: string; children: React.ReactNode; error?: string; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(183,238,122,0.6)' }}>
        {label}
      </label>
      <div className={`[&_input]:w-full [&_input]:rounded-xl [&_input]:px-4 [&_input]:py-3 [&_input]:text-sm [&_input]:text-white [&_input]:outline-none [&_input]:transition-all [&_input]:bg-white/[0.06] [&_input]:border [&_input]:placeholder:text-white/25 [&_select]:w-full [&_select]:rounded-xl [&_select]:px-4 [&_select]:py-3 [&_select]:text-sm [&_select]:text-white [&_select]:outline-none [&_select]:transition-all [&_select]:bg-[#1a321a] [&_select]:border [&_select]:appearance-none ${error ? '[&_input]:border-red-400/50 [&_select]:border-red-400/50' : '[&_input]:border-white/10 [&_input:focus]:border-[rgba(183,238,122,0.4)] [&_select]:border-white/10 [&_select:focus]:border-[rgba(183,238,122,0.4)]'}`}>
        {children}
      </div>
      {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  );
}

function PrimaryButton({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-60 mt-1"
      style={{ background: 'var(--aza-accent)', color: 'var(--aza-primary)' }}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}
