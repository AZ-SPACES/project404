'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { LogOut, ChevronRight, ExternalLink, Shield, Key, Copy, Check } from 'lucide-react';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

const API =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== 'http://localhost:8080'
    ? process.env.NEXT_PUBLIC_API_URL
    : typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://api.aza.systems'
    : 'http://localhost:8080';

function TokenBadge({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const preview = token.slice(0, 24) + '…';

  function copy() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      title="Click to copy token"
      className="w-full text-left rounded-xl px-3 py-2.5 transition-colors"
      style={{ background: 'rgba(183,238,122,0.06)', border: '1px solid rgba(183,238,122,0.14)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(183,238,122,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(183,238,122,0.06)')}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(183,238,122,0.55)' }}>
        {copied ? '✓ Copied!' : 'User token (Bearer)'}
      </p>
      <p className="text-xs font-mono break-all" style={{ color: 'rgba(183,238,122,0.8)' }}>
        {preview}
      </p>
    </button>
  );
}

function ApiKeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [focused, setFocused] = useState(false);

  function copy() {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Key size={10} style={{ color: 'rgba(183,238,122,0.55)' }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(183,238,122,0.55)' }}>
            Merchant API Key
          </span>
        </div>
        {value && (
          <button onClick={copy} className="flex items-center gap-1 text-[10px] transition-colors" style={{ color: 'rgba(183,238,122,0.4)' }}>
            {copied ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
          </button>
        )}
      </div>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="sk_live_... or sk_test_..."
        className="w-full rounded-xl px-3 py-2 text-xs font-mono outline-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${focused ? 'rgba(183,238,122,0.4)' : 'rgba(255,255,255,0.08)'}`,
          color: 'rgba(183,238,122,0.8)',
        }}
      />
      <p className="text-[10px] px-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Required for <code style={{ color: 'rgba(183,238,122,0.4)' }}>/merchant/*</code> endpoints
      </p>
    </div>
  );
}

export default function ApiExplorerPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('aza_dev_token');
    if (!stored) {
      router.replace('/developers/login');
      return;
    }
    setToken(stored);
    const savedKey = sessionStorage.getItem('aza_dev_api_key') ?? '';
    setApiKey(savedKey);
    setMounted(true);
  }, [router]);

  useEffect(() => {
    if (mounted) sessionStorage.setItem('aza_dev_api_key', apiKey);
  }, [apiKey, mounted]);

  function logout() {
    sessionStorage.removeItem('aza_dev_token');
    sessionStorage.removeItem('aza_dev_api_key');
    router.push('/developers/login');
  }

  function requestInterceptor(req: any) {
    if (token) req.headers['Authorization'] = `Bearer ${token}`;
    if (apiKey) req.headers['X-Api-Key'] = apiKey;
    return req;
  }

  if (!mounted || !token) return null;

  return (
    <div className="min-h-screen flex" style={{ background: '#f8f9fa' }}>

      {/* ── Sidebar ── */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col"
        style={{
          background: 'linear-gradient(180deg, #0e2a0e 0%, #132613 100%)',
          borderRight: '1px solid rgba(183,238,122,0.08)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div className="p-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <a href="/" className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0"
              style={{ background: '#B7EE7A', color: '#174717' }}
            >
              A
            </span>
            <div>
              <p className="text-white font-extrabold text-sm leading-none" style={{ letterSpacing: '-0.04em' }}>
                aza
              </p>
              <p className="text-[10px] font-medium" style={{ color: 'rgba(183,238,122,0.5)', letterSpacing: '0.05em' }}>
                API EXPLORER
              </p>
            </div>
          </a>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 p-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'rgba(183,238,122,0.4)' }}>
            Endpoints
          </p>

          {[
            { label: 'Authentication',   anchor: '#/Authentication'   },
            { label: 'Users',            anchor: '#/User'             },
            { label: 'Wallets',          anchor: '#/Wallet'           },
            { label: 'Transfers',        anchor: '#/Transfer'         },
            { label: 'Contacts',         anchor: '#/Contacts'         },
            { label: 'KYC',              anchor: '#/KYC'              },
            { label: 'Notifications',    anchor: '#/Notifications'    },
            { label: 'Biometric',        anchor: '#/Biometric'        },
          ].map(item => (
            <a
              key={item.label}
              href={item.anchor}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors group"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#B7EE7A';
                e.currentTarget.style.background = 'rgba(183,238,122,0.07)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {item.label}
              <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'rgba(183,238,122,0.4)' }}>
              Merchant
            </p>
            {[
              { label: 'Sessions',       anchor: '#/Merchant Sessions'   },
              { label: 'API Keys',       anchor: '#/Merchant API Keys'   },
              { label: 'Webhooks',       anchor: '#/Merchant Webhooks'   },
              { label: 'Invoices',       anchor: '#/Merchant Invoices'   },
              { label: 'Payouts',        anchor: '#/Merchant Payouts'    },
              { label: 'Discount Codes', anchor: '#/Merchant Discount'   },
              { label: 'Customers',      anchor: '#/Merchant Customers'  },
              { label: 'Settlements',    anchor: '#/Merchant Settlements' },
              { label: 'Disputes',       anchor: '#/Merchant Disputes'   },
            ].map(item => (
              <a
                key={item.label}
                href={item.anchor}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm font-medium transition-colors group"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#B7EE7A'; e.currentTarget.style.background = 'rgba(183,238,122,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
              >
                {item.label}
                <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'rgba(183,238,122,0.4)' }}>
              Resources
            </p>
            <a
              href={`${API}/v3/api-docs`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(183,238,122,0.8)'; e.currentTarget.style.background = 'rgba(183,238,122,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <ExternalLink size={12} />
              OpenAPI JSON
            </a>
            <a
              href="/developers/guides"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(183,238,122,0.8)'; e.currentTarget.style.background = 'rgba(183,238,122,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <ExternalLink size={12} />
              Developer Guides
            </a>
          </div>
        </nav>

        {/* Token + API Key + logout */}
        <div className="p-4 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 px-1">
            <Shield size={12} style={{ color: '#B7EE7A' }} />
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Authenticated
            </span>
          </div>
          <TokenBadge token={token} />
          <ApiKeyInput value={apiKey} onChange={setApiKey} />
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium w-full transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main: Swagger UI ── */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-3"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(0,0,0,0.07)',
          }}
        >
          <div>
            <h1 className="font-bold text-sm" style={{ color: '#174717' }}>AZA API Reference</h1>
            <p className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
              All requests are authenticated with your active token.
            </p>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: 'rgba(23,71,23,0.08)', color: '#174717' }}
          >
            v1
          </span>
        </div>

        {/* Swagger UI */}
        <div className="swagger-wrapper">
          <SwaggerUI
            url={`${API}/v3/api-docs`}
            requestInterceptor={requestInterceptor}
            docExpansion="list"
            defaultModelsExpandDepth={-1}
            tryItOutEnabled
          />
        </div>
      </main>

      {/* Swagger UI overrides */}
      <style>{`
        .swagger-wrapper .swagger-ui .topbar { display: none; }
        .swagger-wrapper .swagger-ui .info { margin: 24px 0 8px; }
        .swagger-wrapper .swagger-ui .scheme-container { display: none; }
        .swagger-wrapper .swagger-ui .auth-wrapper { display: none; }
        .swagger-wrapper .swagger-ui .opblock-tag {
          font-family: var(--font-inter), sans-serif;
          font-size: 0.9rem;
          font-weight: 700;
          color: #174717;
          border-bottom: 1px solid rgba(23,71,23,0.12);
        }
        .swagger-wrapper .swagger-ui .opblock .opblock-summary-method {
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.7rem;
          min-width: 64px;
        }
        .swagger-wrapper .swagger-ui { font-family: var(--font-inter), sans-serif; }
        .swagger-wrapper .swagger-ui .btn.authorize { display: none; }
        .swagger-wrapper .swagger-ui .information-container { padding: 0 20px; }
        .swagger-wrapper { padding-bottom: 80px; }
      `}</style>
    </div>
  );
}
