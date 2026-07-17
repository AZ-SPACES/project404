'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { AzaMark } from '@/components/AzaMark';

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fa] px-4 py-14 font-sans antialiased">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm font-medium text-[#374151] transition-colors hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] rounded"
      >
        <ArrowLeft size={15} />
        Back to aza
      </Link>

      <main className="w-full max-w-[440px]">
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-8 shadow-[0_10px_40px_-16px_rgba(14,42,14,0.18)]">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-2.5">
            <AzaMark size={32} className="rounded-[9px]" priority />
            <span className="text-sm font-semibold tracking-tight text-[#374151]">developers</span>
          </div>

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
                  <span className={`hidden text-xs font-medium sm:block ${i === stepIndex ? 'text-[#174717]' : 'text-[#9ca3af]'}`}>
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
            <form onSubmit={nextStep} className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#111827]">Create your developer account</h1>
                <p className="mt-1 text-sm text-[#6b7280]">Get access to the Aza API Explorer.</p>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors hover:text-[#6b7280] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#174717] rounded"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <PrimaryButton loading={false}>Continue</PrimaryButton>

              <p className="text-center text-sm text-[#6b7280]">
                Already have an account?{' '}
                <a href="/developers/login" className="font-semibold text-[#174717] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] rounded-sm">
                  Sign in
                </a>
              </p>
            </form>
          )}

          {/* ── Step 2: Profile ── */}
          {step === 'profile' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#111827]">Tell us about yourself</h1>
                <p className="mt-1 text-sm text-[#6b7280]">All fields on this step are optional.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <input type="text" placeholder="Kwame" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </Field>
                <Field label="Last name">
                  <input type="text" placeholder="Mensah" value={lastName} onChange={e => setLastName(e.target.value)} />
                </Field>
              </div>

              <Field label="Handle">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm font-medium text-[#9ca3af]">@</span>
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
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} max={MAX_DOB} />
              </Field>

              <Field label="Employment status">
                <select value={employment} onChange={e => setEmployment(e.target.value)}>
                  <option value="">Select…</option>
                  {EMPLOYMENT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              {error && (
                <p className="rounded-xl border border-[#f6c9c9] bg-[#fdeaea] px-4 py-3 text-sm text-[#c62828]">{error}</p>
              )}

              <PrimaryButton loading={loading}>Create account</PrimaryButton>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); }}
                className="text-center text-sm text-[#6b7280] transition-colors hover:text-[#374151]"
              >
                ← Back
              </button>
            </form>
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
function Field({ label, children, error, htmlFor }: { label: string; children: React.ReactNode; error?: string; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-[#6b7280]">
        {label}
      </label>
      <div
        className={`[&_input]:w-full [&_input]:rounded-xl [&_input]:px-4 [&_input]:py-3 [&_input]:text-sm [&_input]:text-[#111827] [&_input]:bg-white [&_input]:border [&_input]:outline-none [&_input]:transition-colors [&_input]:placeholder:text-[#9ca3af] [&_select]:w-full [&_select]:rounded-xl [&_select]:px-4 [&_select]:py-3 [&_select]:text-sm [&_select]:text-[#111827] [&_select]:bg-white [&_select]:border [&_select]:outline-none [&_select]:transition-colors ${
          error
            ? '[&_input]:border-[#dc2626] [&_select]:border-[#dc2626]'
            : '[&_input]:border-[#e5e7eb] [&_input:focus]:border-[#174717] [&_input:focus]:ring-2 [&_input:focus]:ring-[#174717]/15 [&_select]:border-[#e5e7eb] [&_select:focus]:border-[#174717] [&_select:focus]:ring-2 [&_select:focus]:ring-[#174717]/15'
        }`}
      >
        {children}
      </div>
      {error && <p className="text-xs text-[#dc2626]">{error}</p>}
    </div>
  );
}

function PrimaryButton({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#B7EE7A] py-3 text-sm font-bold text-[#0e2a0e] transition-all hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] focus-visible:ring-offset-2"
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}
