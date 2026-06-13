'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

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
      setLoadError('Missing authorization state. Please return to the app and try again.');
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

      // Backend returns the redirect URL — navigate to it so the IDE receives the code
      window.location.href = json.data;
    } catch {
      setAuthError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  function handleDeny() {
    // Redirect back with error so the IDE handles it
    window.history.back();
  }

  if (loadError) return <ErrorScreen message={loadError} />;
  if (!client)   return <LoadingScreen />;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
         style={{ background: 'linear-gradient(135deg, #0e2a0e 0%, #132613 60%, #0a1a0a 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Card */}
        <div className="rounded-2xl border p-8"
             style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>

          {/* App identity */}
          <div className="flex flex-col items-center text-center mb-7">
            {client.logoUrl ? (
              <img src={client.logoUrl} alt={client.appName}
                   className="w-14 h-14 rounded-2xl object-cover mb-3"
                   style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
            ) : (
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 text-xl font-black"
                   style={{ background: 'rgba(183,238,122,0.15)', color: '#B7EE7A' }}>
                {client.appName[0].toUpperCase()}
              </div>
            )}
            <h1 className="text-white font-bold text-lg leading-tight">
              {client.appName}
            </h1>
            {client.appDescription && (
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {client.appDescription}
              </p>
            )}
          </div>

          {/* Scopes */}
          <div className="mb-6 rounded-xl px-4 py-3 space-y-2.5"
               style={{ background: 'rgba(183,238,122,0.05)', border: '1px solid rgba(183,238,122,0.1)' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              THIS APP WANTS TO ACCESS
            </p>
            {client.scopes.map(scope => {
              const meta = SCOPE_LABELS[scope];
              return (
                <div key={scope} className="flex items-start gap-2.5">
                  <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#B7EE7A' }} />
                  <div>
                    <p className="text-xs font-semibold text-white">{meta?.label ?? scope}</p>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {meta?.description ?? scope}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Login form */}
          <form onSubmit={handleApprove} className="space-y-3">
            <p className="text-xs text-center mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Sign in with your Aza account to continue
            </p>

            <div>
              <input
                ref={identifierRef}
                type="text"
                autoComplete="username"
                placeholder="Username, email or phone"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(183,238,122,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>

            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(183,238,122,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {authError && (
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                   style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={13} className="flex-shrink-0" />
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !identifier || !password}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-opacity disabled:opacity-40"
              style={{ background: '#B7EE7A', color: '#174717' }}
            >
              {submitting
                ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />Signing in…</span>
                : `Allow ${client.appName}`}
            </button>

            <button
              type="button"
              onClick={handleDeny}
              disabled={submitting}
              className="w-full py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              Cancel
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] mt-5" style={{ color: 'rgba(255,255,255,0.2)' }}>
          You are authorising <strong className="text-white/40">{client.appName}</strong> to access your Aza account.
          You can revoke access at any time from Aza → Profile → Connected Apps.
        </p>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: 'linear-gradient(135deg, #0e2a0e 0%, #132613 60%, #0a1a0a 100%)' }}>
      <Loader2 size={24} className="animate-spin" style={{ color: '#B7EE7A' }} />
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6"
         style={{ background: 'linear-gradient(135deg, #0e2a0e 0%, #132613 60%, #0a1a0a 100%)' }}>
      <div className="text-center max-w-sm">
        <AlertCircle size={32} className="mx-auto mb-3" style={{ color: '#fca5a5' }} />
        <p className="text-white font-semibold mb-1">Authorization failed</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{message}</p>
      </div>
    </div>
  );
}
