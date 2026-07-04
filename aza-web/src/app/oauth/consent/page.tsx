'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ShieldCheck, Eye, EyeOff, AlertCircle, Loader2, Lock } from 'lucide-react';
import { AzaMark } from '@/components/AzaMark';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.aza.systems';

const SCOPE_LABELS: Record<string, { label: string; description: string }> = {
  identity:      { label: 'Your profile',   description: 'Name, username, and profile picture' },
  email:         { label: 'Email address',  description: 'Your registered email address' },
  phone:         { label: 'Phone number',   description: 'Your registered phone number' },
  'wallet:read': { label: 'Wallet balance', description: 'View your current Aza balance' },
  payment:       { label: 'Make payments',  description: 'Initiate payments from your Aza wallet' },
};

interface ClientInfo {
  clientId: string;
  appName: string;
  appDescription: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  scopes: string[];
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ConsentContent />
    </Suspense>
  );
}

function ConsentContent() {
  const searchParams = useSearchParams();
  const state = searchParams.get('state');

  const [client, setClient]       = useState<ClientInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError]   = useState<string | null>(null);

  const identifierRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state) {
      setLoadError('Missing authorization state. Please return to the app and try again.'); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    fetch(`${API}/oauth/pending/${state}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) setClient(json.data);
        else setLoadError(json.message ?? 'Authorization request has expired.');
      })
      .catch(() => setLoadError('Unable to reach Aza servers. Please check your connection.'));
  }, [state]);

  useEffect(() => {
    if (client) identifierRef.current?.focus();
  }, [client]);

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    if (!state || !identifier.trim() || !password) return;

    setSubmitting(true);
    setAuthError(null);

    try {
      const params = new URLSearchParams({ state, identifier: identifier.trim(), password });
      const res  = await fetch(`${API}/oauth/approve`, { method: 'POST', body: params });
      const json = await res.json();

      if (!res.ok) {
        setAuthError(json.message ?? 'Invalid username or password.');
        setSubmitting(false);
        return;
      }

      // Backend returns the redirect URL — navigate to it so the app receives the code
      window.location.href = json.data;
    } catch {
      setAuthError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  function handleDeny() {
    // Redirect back with error so the app handles it
    window.history.back();
  }

  if (loadError) return <ErrorScreen message={loadError} />;
  if (!client)   return <LoadingScreen />;

  const canPay   = client.scopes.includes('payment');
  const disabled = submitting || !identifier.trim() || !password;

  return (
    <div className="azc">
      <Styles />
      <main className="azc-shell">
        <div className="azc-card">

          {/* Connection lockup — you are linking this app TO your Aza account */}
          <div className="azc-lockup" aria-hidden="true">
            <AzaMark size={52} className="azc-mark azc-mark--aza" priority />
            <div className="azc-connector">
              <span className="azc-dash" />
              <span className="azc-node"><Lock size={13} strokeWidth={2.4} /></span>
              <span className="azc-dash" />
            </div>
            <div className="azc-mark azc-mark--app">
              {client.logoUrl ? (
                <Image src={client.logoUrl} alt="" width={52} height={52} unoptimized
                       className="azc-mark-img" />
              ) : (
                <span>{client.appName[0].toUpperCase()}</span>
              )}
            </div>
          </div>

          <div className="azc-head">
            <h1 className="azc-title">{client.appName}</h1>
            <p className="azc-sub">
              wants to connect to your <span className="azc-brand">Aza</span> account
            </p>
          </div>

          {/* Permissions */}
          <section className="azc-perms" aria-label="Requested permissions">
            <p className="azc-perms-label">This app will be able to</p>
            <ul className="azc-scopes">
              {client.scopes.map((scope, i) => {
                const meta = SCOPE_LABELS[scope];
                return (
                  <li key={scope} className="azc-scope" style={{ animationDelay: `${120 + i * 55}ms` }}>
                    <ShieldCheck size={16} strokeWidth={2.2} className="azc-scope-ic" />
                    <div className="azc-scope-txt">
                      <span className="azc-scope-title">{meta?.label ?? scope}</span>
                      <span className="azc-scope-desc">{meta?.description ?? scope}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {canPay && (
              <p className="azc-payhint">
                <Lock size={12} strokeWidth={2.4} />
                You’ll still confirm every payment inside Aza.
              </p>
            )}
          </section>

          <div className="azc-rule"><span>Sign in to authorize</span></div>

          {/* Credentials */}
          <form onSubmit={handleApprove} className="azc-form">
            <input
              ref={identifierRef}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Username, email or phone"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
              className="azc-input"
            />

            <div className="azc-pw">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="azc-input"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="azc-pw-toggle"
                aria-label={showPw ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {authError && (
              <div className="azc-error" role="alert">
                <AlertCircle size={14} className="azc-error-ic" />
                <span>{authError}</span>
              </div>
            )}

            <button type="submit" disabled={disabled} className="azc-primary">
              {submitting ? (
                <span className="azc-inline"><Loader2 size={15} className="azc-spin" /> Authorizing…</span>
              ) : (
                `Allow ${client.appName}`
              )}
            </button>

            <button type="button" onClick={handleDeny} disabled={submitting} className="azc-ghost">
              Cancel
            </button>
          </form>

          <p className="azc-trust">
            <Lock size={12} strokeWidth={2.4} />
            Aza never shares your password with {client.appName}.
          </p>
        </div>

        <p className="azc-foot">
          You can revoke access anytime in <strong>Aza → Profile → Connected&nbsp;Apps</strong>.
        </p>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="azc azc--center">
      <Styles />
      <Loader2 size={26} className="azc-spin" style={{ color: 'var(--lime)' }} />
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="azc azc--center">
      <Styles />
      <div className="azc-errscreen">
        <div className="azc-errbadge"><AlertCircle size={26} strokeWidth={2.2} /></div>
        <h1 className="azc-title">Authorization failed</h1>
        <p className="azc-errmsg">{message}</p>
      </div>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      .azc {
        --bg: #060d09;
        --card: #0e1a12;
        --card-2: #15251b;
        --line: rgba(183,238,122,0.16);
        --line-soft: rgba(233,245,224,0.10);
        --lime: #B7EE7A;
        --lime-ink: #0a1b0c;
        --ink: #f4f8ef;
        --text: #b7c5af;
        --muted: #8b9b84;
        --placeholder: #879680;
        --danger: #f4aaa1;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: var(--ink);
        font-family: var(--font-inter), system-ui, sans-serif;
        background:
          radial-gradient(115% 75% at 50% -8%, rgba(183,238,122,0.11), transparent 52%),
          radial-gradient(90% 55% at 50% 118%, rgba(23,71,23,0.40), transparent 60%),
          var(--bg);
      }
      .azc--center { flex-direction: column; }

      .azc-shell { width: 100%; max-width: 392px; }

      .azc-card {
        background: linear-gradient(180deg, rgba(183,238,122,0.035), transparent 42%), var(--card);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 30px 28px 24px;
        box-shadow:
          0 1px 0 rgba(255,255,255,0.05) inset,
          0 30px 70px -28px rgba(0,0,0,0.85);
        animation: azc-rise .55s cubic-bezier(.22,1,.36,1) both;
      }

      /* Connection lockup */
      .azc-lockup {
        display: flex; align-items: center; justify-content: center;
        gap: 4px; margin-bottom: 18px;
      }
      .azc-mark {
        width: 52px; height: 52px; border-radius: 16px;
        display: grid; place-items: center;
        font-size: 22px; font-weight: 800; overflow: hidden; flex: none;
      }
      .azc-mark--aza {
        box-shadow: 0 6px 20px -8px rgba(0,0,0,0.6);
      }
      .azc-mark--app {
        background: var(--card-2);
        border: 1px solid var(--line-soft);
        color: var(--lime);
      }
      .azc-mark-img { width: 52px; height: 52px; object-fit: cover; }
      .azc-connector { display: flex; align-items: center; gap: 5px; padding: 0 4px; }
      .azc-dash {
        width: 16px; height: 0;
        border-top: 2px dashed rgba(183,238,122,0.4);
      }
      .azc-node {
        width: 26px; height: 26px; border-radius: 50%;
        display: grid; place-items: center;
        background: var(--card-2); border: 1px solid var(--line);
        color: var(--lime);
      }

      .azc-head { text-align: center; margin-bottom: 22px; }
      .azc-title {
        font-size: 19px; font-weight: 700; letter-spacing: -0.01em;
        line-height: 1.2; text-wrap: balance;
      }
      .azc-sub { margin-top: 5px; font-size: 13.5px; color: var(--text); line-height: 1.45; }
      .azc-brand { color: var(--lime); font-weight: 600; }

      /* Permissions */
      .azc-perms {
        background: var(--card-2);
        border: 1px solid var(--line-soft);
        border-radius: 16px;
        padding: 15px 16px;
        margin-bottom: 22px;
      }
      .azc-perms-label {
        font-size: 11.5px; font-weight: 600; color: var(--muted);
        margin-bottom: 12px; letter-spacing: 0.01em;
      }
      .azc-scopes { list-style: none; display: flex; flex-direction: column; gap: 12px; }
      .azc-scope {
        display: flex; align-items: flex-start; gap: 11px;
        animation: azc-fade .45s ease-out both;
      }
      .azc-scope-ic { color: var(--lime); flex: none; margin-top: 1px; }
      .azc-scope-txt { display: flex; flex-direction: column; gap: 2px; }
      .azc-scope-title { font-size: 13.5px; font-weight: 600; color: var(--ink); line-height: 1.25; }
      .azc-scope-desc { font-size: 12px; color: var(--text); line-height: 1.35; }
      .azc-payhint {
        display: flex; align-items: center; gap: 6px;
        margin-top: 13px; padding-top: 12px;
        border-top: 1px solid var(--line-soft);
        font-size: 11.5px; color: var(--muted); line-height: 1.35;
      }
      .azc-payhint svg { color: var(--lime); flex: none; }

      /* Divider with label */
      .azc-rule {
        display: flex; align-items: center; gap: 12px;
        margin: 0 2px 16px; color: var(--muted); font-size: 11.5px; font-weight: 500;
      }
      .azc-rule::before, .azc-rule::after {
        content: ""; flex: 1; height: 1px; background: var(--line-soft);
      }

      /* Form */
      .azc-form { display: flex; flex-direction: column; gap: 10px; }
      .azc-input {
        width: 100%; padding: 12px 14px;
        background: var(--card-2);
        border: 1px solid var(--line-soft);
        border-radius: 12px;
        color: var(--ink); font-size: 14px;
        transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
      }
      .azc-input::placeholder { color: var(--placeholder); }
      .azc-input:hover { border-color: rgba(233,245,224,0.18); }
      .azc-input:focus {
        outline: none;
        border-color: var(--lime);
        box-shadow: 0 0 0 3px rgba(183,238,122,0.22);
        background: #182a1d;
      }
      .azc-pw { position: relative; }
      .azc-pw .azc-input { padding-right: 42px; }
      .azc-pw-toggle {
        position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
        display: grid; place-items: center; width: 32px; height: 32px;
        border-radius: 8px; color: var(--muted); background: transparent;
        cursor: pointer; transition: color .15s ease, background .15s ease;
      }
      .azc-pw-toggle:hover { color: var(--text); background: rgba(233,245,224,0.06); }

      .azc-error {
        display: flex; align-items: center; gap: 8px;
        padding: 9px 12px; border-radius: 10px; font-size: 12.5px;
        color: var(--danger);
        background: rgba(244,110,97,0.10);
        border: 1px solid rgba(244,110,97,0.26);
      }
      .azc-error-ic { flex: none; }

      .azc-primary {
        width: 100%; margin-top: 4px; padding: 13px;
        border-radius: 12px; font-size: 14px; font-weight: 700;
        background: var(--lime); color: var(--lime-ink); border: 1px solid transparent;
        cursor: pointer;
        transition: filter .18s ease, transform .1s ease, opacity .18s ease;
      }
      .azc-primary:hover:not(:disabled) { filter: brightness(1.06); }
      .azc-primary:active:not(:disabled) { transform: translateY(1px); }
      .azc-primary:disabled { opacity: .42; cursor: not-allowed; }

      .azc-ghost {
        width: 100%; padding: 10px; border-radius: 12px;
        font-size: 13.5px; font-weight: 600; color: var(--muted);
        background: transparent; border: 1px solid transparent; cursor: pointer;
        transition: color .16s ease, background .16s ease;
      }
      .azc-ghost:hover:not(:disabled) { color: var(--text); background: rgba(233,245,224,0.045); }

      .azc-primary:focus-visible, .azc-ghost:focus-visible, .azc-pw-toggle:focus-visible {
        outline: none; box-shadow: 0 0 0 3px rgba(183,238,122,0.4);
      }

      .azc-inline { display: inline-flex; align-items: center; gap: 8px; }

      .azc-trust {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        margin-top: 16px; font-size: 11.5px; color: var(--muted); text-align: center;
      }
      .azc-trust svg { color: var(--lime); flex: none; }

      .azc-foot {
        text-align: center; margin-top: 18px;
        font-size: 11.5px; line-height: 1.5; color: var(--muted);
      }
      .azc-foot strong { color: var(--text); font-weight: 600; }

      /* Error screen */
      .azc-errscreen { text-align: center; max-width: 320px; }
      .azc-errbadge {
        width: 56px; height: 56px; border-radius: 18px; margin: 0 auto 16px;
        display: grid; place-items: center; color: var(--danger);
        background: rgba(244,110,97,0.10); border: 1px solid rgba(244,110,97,0.24);
      }
      .azc-errmsg { margin-top: 8px; font-size: 13.5px; color: var(--text); line-height: 1.5; }

      .azc-spin { animation: azc-spin 1s linear infinite; }
      @keyframes azc-spin { to { transform: rotate(360deg); } }
      @keyframes azc-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @keyframes azc-fade { from { opacity: 0; } to { opacity: 1; } }

      @media (prefers-reduced-motion: reduce) {
        .azc-card, .azc-scope { animation: none !important; }
      }
    `}</style>
  );
}
