'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ShieldCheck, Eye, EyeOff, AlertCircle, Loader2, Lock } from 'lucide-react';
import { AzaMark } from '@/components/AzaMark';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.aza.systems';

const SCOPE_LABELS: Record<string, { label: string; short: string }> = {
  identity:      { label: 'Your profile',   short: 'PROFILE' },
  email:         { label: 'Email address',  short: 'EMAIL'   },
  phone:         { label: 'Phone number',   short: 'PHONE'   },
  'wallet:read': { label: 'Wallet balance', short: 'WALLET'  },
  payment:       { label: 'Make payments',  short: 'PAYMENTS'},
  direct_debit:  { label: 'Request standing charges', short: 'DIRECT DEBIT' },
};

interface ClientInfo {
  clientId: string;
  appName: string;
  appDescription: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  scopes: string[];
}

// Turn the opaque OAuth state into a stable, ticket-like pass number.
function passNumber(state: string | null): string {
  const raw = (state ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().padEnd(8, '0');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

const ISSUED = new Date().toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
}).toUpperCase();

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
      window.location.assign(json.data);
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

  const canPay = client.scopes.includes('payment');
  const canRequestMandate = client.scopes.includes('direct_debit');
  const disabled = submitting || !identifier.trim() || !password;
  const passNo = passNumber(state);

  return (
    <div className="pass-counter">
      <Styles />
      <main className="pass-wrap">
        <article className="pass" aria-label="Aza access pass">

          {/* Header stub */}
          <header className="pass-head">
            <div className="pass-head-brand">
              <AzaMark size={30} className="pass-mark" priority />
              <div className="pass-head-txt">
                <span className="pass-head-title">AZA</span>
                <span className="pass-head-sub">ACCESS&nbsp;PASS</span>
              </div>
            </div>
            <div className="pass-head-no">
              <span className="pass-k">PASS №</span>
              <span className="pass-v">{passNo}</span>
            </div>
          </header>

          {/* Ticket body */}
          <div className="pass-body">
            <div className="pass-field">
              <span className="pass-k">ISSUED TO</span>
              <div className="pass-app">
                <div className="pass-app-mark">
                  {client.logoUrl ? (
                    <Image src={client.logoUrl} alt="" width={40} height={40} unoptimized className="pass-app-img" />
                  ) : (
                    <span>{client.appName[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="pass-app-txt">
                  <span className="pass-app-name">{client.appName}</span>
                  {client.appDescription && <span className="pass-app-desc">{client.appDescription}</span>}
                </div>
              </div>
            </div>

            <div className="pass-meta">
              <div className="pass-field">
                <span className="pass-k">ISSUED</span>
                <span className="pass-meta-v">{ISSUED}</span>
              </div>
              <div className="pass-field">
                <span className="pass-k">ISSUER</span>
                <span className="pass-meta-v">aza.systems</span>
              </div>
            </div>

            <div className="pass-field">
              <span className="pass-k">This pass grants access to</span>
              <ul className="pass-scopes">
                {client.scopes.map((scope, i) => {
                  const meta = SCOPE_LABELS[scope];
                  return (
                    <li key={scope} className="pass-scope" style={{ animationDelay: `${140 + i * 55}ms` }}>
                      <ShieldCheck size={15} strokeWidth={2.3} className="pass-scope-ic" />
                      <span className="pass-scope-label">{meta?.label ?? scope}</span>
                      <span className="pass-scope-code">{meta?.short ?? scope}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {canPay && (
              <p className="pass-note">
                <Lock size={12} strokeWidth={2.4} />
                Every payment is still confirmed by you inside Aza.
              </p>
            )}
            {canRequestMandate && (
              <p className="pass-note">
                <Lock size={12} strokeWidth={2.4} />
                This only lets {client.appName} ask you to approve a standing charge — you&apos;ll
                review the exact amount and limits separately before anything is authorized.
              </p>
            )}
          </div>

          {/* Perforated tear line */}
          <div className="pass-tear" aria-hidden="true">
            <span className="pass-notch pass-notch--l" />
            <span className="pass-dash" />
            <span className="pass-notch pass-notch--r" />
          </div>

          {/* Validation stub — sign in */}
          <form className="pass-stub" onSubmit={handleApprove}>
            <span className="pass-k pass-stub-k">Sign in to validate this pass</span>

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
              className="pass-input"
            />

            <div className="pass-pw">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="pass-input"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="pass-pw-toggle"
                aria-label={showPw ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {authError && (
              <div className="pass-error" role="alert">
                <AlertCircle size={14} className="pass-error-ic" />
                <span>{authError}</span>
              </div>
            )}

            <button type="submit" disabled={disabled} className="pass-allow">
              {submitting ? (
                <span className="pass-inline"><Loader2 size={15} className="pass-spin" /> Validating…</span>
              ) : (
                <>Approve &amp; grant access</>
              )}
            </button>

            <button type="button" onClick={handleDeny} disabled={submitting} className="pass-deny">
              Cancel
            </button>
          </form>

          {/* Barcode footer */}
          <footer className="pass-foot">
            <div className="pass-barcode" aria-hidden="true" />
            <div className="pass-foot-row">
              <span>AZA · OAUTH 2.0</span>
              <span>{passNo}</span>
            </div>
          </footer>
        </article>

        <p className="pass-legal">
          <Lock size={11} strokeWidth={2.4} />
          Aza never shares your password with {client.appName}. Revoke anytime in
          {' '}<strong>Profile → Connected&nbsp;Apps</strong>.
        </p>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="pass-counter pass-counter--center">
      <Styles />
      <div className="pass-loader">
        <Loader2 size={22} className="pass-spin" />
        <span>Printing your access pass…</span>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="pass-counter pass-counter--center">
      <Styles />
      <div className="pass-void">
        <div className="pass-void-stamp">PASS DECLINED</div>
        <AlertCircle size={22} className="pass-void-ic" />
        <p className="pass-void-msg">{message}</p>
      </div>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      .pass-counter {
        --counter: #071a0d;
        --lime: #B7EE7A;
        --lime-ink: #0e2a0e;
        --paper: #ffffff;
        --paper-2: #f6f8f4;
        --head: #0e2a0e;
        --ink: #14251a;
        --muted: #6b7a6f;
        --faint: #9aa79d;
        --border: #e6ebe4;
        --green: #2e7d2e;
        --danger: #c62828;
        --mono: var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, monospace;
        min-height: 100dvh;
        display: flex; align-items: center; justify-content: center;
        padding: 40px 20px;
        font-family: var(--font-inter), system-ui, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(120% 60% at 50% -10%, rgba(183,238,122,0.14), transparent 55%),
          radial-gradient(90% 60% at 50% 115%, rgba(46,125,46,0.22), transparent 60%),
          var(--counter);
      }
      .pass-counter--center { flex-direction: column; }
      .pass-wrap { width: 100%; max-width: 400px; }

      /* ── Ticket ── */
      .pass {
        position: relative;
        background: var(--paper);
        border-radius: 20px;
        overflow: hidden;
        box-shadow:
          0 1px 0 rgba(255,255,255,0.6) inset,
          0 30px 70px -30px rgba(0,0,0,0.8),
          0 8px 24px -12px rgba(0,0,0,0.5);
        animation: pass-print .6s cubic-bezier(.2,.9,.25,1) both;
      }

      /* Header */
      .pass-head {
        background: var(--head);
        color: #fff;
        padding: 16px 20px;
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        position: relative;
      }
      .pass-head::after {
        content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
        background: repeating-linear-gradient(90deg, var(--lime) 0 10px, transparent 10px 18px);
        opacity: .5;
      }
      .pass-head-brand { display: flex; align-items: center; gap: 11px; }
      .pass-mark { border-radius: 8px; }
      .pass-head-txt { display: flex; flex-direction: column; line-height: 1; gap: 3px; }
      .pass-head-title { font-size: 15px; font-weight: 800; letter-spacing: 0.16em; }
      .pass-head-sub {
        font-family: var(--mono);
        font-size: 9.5px; letter-spacing: 0.22em; color: var(--lime);
      }
      .pass-head-no { text-align: right; display: flex; flex-direction: column; gap: 3px; }
      .pass-head-no .pass-k { color: rgba(255,255,255,0.5); }
      .pass-head-no .pass-v {
        font-family: var(--mono); font-size: 13px; font-weight: 600;
        color: var(--lime); letter-spacing: 0.08em;
      }

      /* Shared key/value labels */
      .pass-k {
        font-family: var(--mono);
        font-size: 9px; font-weight: 600; letter-spacing: 0.18em;
        text-transform: uppercase; color: var(--faint);
      }

      /* Body */
      .pass-body { padding: 20px 20px 22px; display: flex; flex-direction: column; gap: 18px; }
      .pass-field { display: flex; flex-direction: column; gap: 8px; }

      .pass-app { display: flex; align-items: center; gap: 12px; }
      .pass-app-mark {
        width: 44px; height: 44px; border-radius: 12px; flex: none;
        display: grid; place-items: center; overflow: hidden;
        background: var(--paper-2); border: 1px solid var(--border);
        color: var(--green); font-size: 18px; font-weight: 800;
      }
      .pass-app-img { width: 44px; height: 44px; object-fit: cover; }
      .pass-app-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .pass-app-name { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
      .pass-app-desc { font-size: 12.5px; color: var(--muted); }

      .pass-meta {
        display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
        padding: 12px 14px; border-radius: 12px;
        background: var(--paper-2); border: 1px solid var(--border);
      }
      .pass-meta-v { font-family: var(--mono); font-size: 12.5px; font-weight: 600; color: var(--ink); letter-spacing: 0.03em; }

      .pass-scopes { list-style: none; display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
      .pass-scope {
        display: flex; align-items: center; gap: 10px;
        padding: 7px 0;
        border-bottom: 1px dashed var(--border);
        animation: pass-fade .4s ease-out both;
      }
      .pass-scope:last-child { border-bottom: none; }
      .pass-scope-ic { color: var(--green); flex: none; }
      .pass-scope-label { font-size: 13.5px; font-weight: 500; color: var(--ink); flex: 1; }
      .pass-scope-code {
        font-family: var(--mono); font-size: 9.5px; font-weight: 600; letter-spacing: 0.1em;
        color: var(--green); background: rgba(46,125,46,0.09);
        padding: 3px 7px; border-radius: 5px;
      }

      .pass-note {
        display: flex; align-items: center; gap: 7px;
        font-size: 11.5px; color: var(--muted); line-height: 1.35;
      }
      .pass-note svg { color: var(--green); flex: none; }

      /* Perforation */
      .pass-tear { position: relative; height: 24px; display: flex; align-items: center; }
      .pass-dash {
        flex: 1; height: 0; margin: 0 18px;
        border-top: 2px dashed #cfd8ca;
      }
      .pass-notch {
        position: absolute; top: 50%; transform: translateY(-50%);
        width: 24px; height: 24px; border-radius: 50%;
        background: var(--counter);
      }
      .pass-notch--l { left: -12px; }
      .pass-notch--r { right: -12px; }

      /* Validation stub */
      .pass-stub {
        background: var(--paper-2);
        padding: 18px 20px 20px;
        display: flex; flex-direction: column; gap: 10px;
      }
      .pass-stub-k { margin-bottom: 2px; }
      .pass-input {
        width: 100%; padding: 12px 14px;
        background: var(--paper); border: 1px solid var(--border);
        border-radius: 11px; color: var(--ink); font-size: 14px;
        transition: border-color .16s ease, box-shadow .16s ease;
      }
      .pass-input::placeholder { color: var(--faint); }
      .pass-input:hover { border-color: #cdd6c8; }
      .pass-input:focus {
        outline: none; border-color: var(--green);
        box-shadow: 0 0 0 3px rgba(46,125,46,0.14);
      }
      .pass-pw { position: relative; }
      .pass-pw .pass-input { padding-right: 42px; }
      .pass-pw-toggle {
        position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
        display: grid; place-items: center; width: 32px; height: 32px;
        border-radius: 8px; color: var(--faint); background: transparent; cursor: pointer;
        transition: color .15s ease, background .15s ease;
      }
      .pass-pw-toggle:hover { color: var(--muted); background: #eef1ea; }

      .pass-error {
        display: flex; align-items: center; gap: 8px;
        padding: 9px 12px; border-radius: 10px; font-size: 12.5px;
        color: var(--danger); background: #fdeaea; border: 1px solid #f6c9c9;
      }
      .pass-error-ic { flex: none; }

      .pass-allow {
        width: 100%; margin-top: 4px; padding: 13px;
        border-radius: 11px; font-size: 14px; font-weight: 700;
        background: var(--lime); color: var(--lime-ink); border: none; cursor: pointer;
        transition: filter .16s ease, transform .1s ease, opacity .16s ease;
      }
      .pass-allow:hover:not(:disabled) { filter: brightness(1.04); }
      .pass-allow:active:not(:disabled) { transform: translateY(1px); }
      .pass-allow:disabled { opacity: .5; cursor: not-allowed; }

      .pass-deny {
        width: 100%; padding: 9px; border-radius: 11px;
        font-size: 13px; font-weight: 600; color: var(--muted);
        background: transparent; border: none; cursor: pointer;
        transition: color .15s ease, background .15s ease;
      }
      .pass-deny:hover:not(:disabled) { color: var(--ink); background: #eef1ea; }

      .pass-allow:focus-visible, .pass-deny:focus-visible, .pass-pw-toggle:focus-visible {
        outline: none; box-shadow: 0 0 0 3px rgba(46,125,46,0.3);
      }
      .pass-inline { display: inline-flex; align-items: center; gap: 8px; }

      /* Barcode footer */
      .pass-foot { background: var(--paper); padding: 16px 20px 18px; }
      .pass-barcode {
        height: 42px; border-radius: 3px;
        background-image: repeating-linear-gradient(90deg,
          #16241a 0 2px, transparent 2px 4px,
          #16241a 4px 7px, transparent 7px 9px,
          #16241a 9px 10px, transparent 10px 13px,
          #16241a 13px 16px, transparent 16px 17px,
          #16241a 17px 19px, transparent 19px 23px);
      }
      .pass-foot-row {
        margin-top: 9px; display: flex; justify-content: space-between;
        font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.14em; color: var(--faint);
      }

      /* Legal line */
      .pass-legal {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        flex-wrap: wrap; text-align: center;
        margin-top: 18px; font-size: 11px; line-height: 1.5; color: rgba(255,255,255,0.42);
      }
      .pass-legal svg { color: var(--lime); flex: none; }
      .pass-legal strong { color: rgba(255,255,255,0.7); font-weight: 600; }

      /* Loading */
      .pass-loader {
        display: flex; align-items: center; gap: 10px;
        font-family: var(--mono); font-size: 12px; letter-spacing: 0.06em;
        color: var(--lime);
      }

      /* Error / voided pass */
      .pass-void {
        position: relative; text-align: center; max-width: 320px;
        padding: 34px 28px; border-radius: 18px;
        background: var(--paper);
        box-shadow: 0 30px 70px -30px rgba(0,0,0,0.8);
      }
      .pass-void-stamp {
        position: absolute; top: 20px; left: 50%;
        transform: translateX(-50%) rotate(-8deg);
        font-family: var(--mono); font-size: 15px; font-weight: 800; letter-spacing: 0.14em;
        color: var(--danger); border: 3px solid var(--danger); border-radius: 8px;
        padding: 5px 12px; opacity: .85;
      }
      .pass-void-ic { color: var(--danger); margin: 44px auto 10px; display: block; }
      .pass-void-msg { font-size: 13.5px; color: var(--muted); line-height: 1.5; }

      .pass-spin { animation: pass-spin 1s linear infinite; }
      @keyframes pass-spin { to { transform: rotate(360deg); } }
      @keyframes pass-print { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
      @keyframes pass-fade { from { opacity: 0; } to { opacity: 1; } }

      @media (prefers-reduced-motion: reduce) {
        .pass, .pass-scope { animation: none !important; }
      }
    `}</style>
  );
}
