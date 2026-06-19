'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, ChevronRight, ExternalLink, Shield, Key, Copy, Check } from 'lucide-react';

// We drive the plain Swagger UI bundle (swagger-ui-dist) directly instead of the
// `swagger-ui-react` wrapper: under React 19 that wrapper's OperationContainer uses
// UNSAFE_componentWillReceiveProps, which leaves operations stuck on an infinite
// spinner when expanded. The bundle renders the same UI without that React layer.

// Structurally compatible with Swagger UI's loosely-typed Request
type SwaggerRequest = { headers?: Record<string, string> };

// The explorer is test-mode only: it never sends a live (aza_live_) key, so a
// stray "Try it out" can't move real money on production.
const isTestKey = (k: string) => k.trim().startsWith('aza_test_');

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

  const isLive = value.trim().startsWith('aza_live_');
  const valid = value === '' || isTestKey(value);

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
            Merchant API Key · test only
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
        placeholder="aza_test_..."
        className="w-full rounded-xl px-3 py-2 text-xs font-mono outline-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${!valid ? 'rgba(248,113,113,0.6)' : focused ? 'rgba(183,238,122,0.4)' : 'rgba(255,255,255,0.08)'}`,
          color: 'rgba(183,238,122,0.8)',
        }}
      />
      {!valid ? (
        <p className="text-[10px] px-1" style={{ color: '#f87171' }}>
          {isLive
            ? 'Live keys are blocked here — the explorer runs against test data only. Use an aza_test_… key.'
            : 'Enter a test key starting with aza_test_…'}
        </p>
      ) : (
        <p className="text-[10px] px-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Test keys only (<code style={{ color: 'rgba(183,238,122,0.4)' }}>aza_test_…</code>) for{' '}
          <code style={{ color: 'rgba(183,238,122,0.4)' }}>/merchant/*</code> endpoints
        </p>
      )}
    </div>
  );
}

export default function ApiExplorerPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [mounted, setMounted] = useState(false);

  // The Swagger UI instance reads creds through refs so we can init it once and
  // not tear it down on every keystroke in the API-key field.
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);
  const apiKeyRef = useRef('');
  const initedRef = useRef(false);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

  useEffect(() => {
    const id = 'swagger-ui-css';
    if (!document.getElementById(id)) {
      const link = Object.assign(document.createElement('link'), {
        id, rel: 'stylesheet', href: '/swagger-ui.css',
      });
      document.head.appendChild(link);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  useEffect(() => {
    // Auth gate: redirect if there's no session, otherwise hydrate from
    // sessionStorage. Both require a real mount (no SSR/session access).
    const stored = sessionStorage.getItem('aza_dev_token');
    if (!stored) {
      router.replace('/developers/login');
      return;
    }
    setToken(stored); // eslint-disable-line react-hooks/set-state-in-effect
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

  function requestInterceptor(req: SwaggerRequest) {
    // Test mode: refuse to send a live key so "Try it out" can never act on real
    // merchant data. Throwing aborts the request and surfaces the message in the UI.
    const key = apiKeyRef.current;
    if (key && !isTestKey(key)) {
      throw new Error('AZA API Explorer is test-mode only — use a test key (aza_test_…). Live keys are blocked.');
    }
    const headers = (req.headers ??= {});
    if (tokenRef.current) headers['Authorization'] = `Bearer ${tokenRef.current}`;
    if (key) headers['X-Api-Key'] = key;
    return req;
  }

  // Boot the Swagger UI bundle once we have a session and the container is mounted.
  useEffect(() => {
    if (!mounted || !token || !containerRef.current || initedRef.current) return;
    initedRef.current = true;
    let cancelled = false;
    // Import the browser bundle directly (not the package index, which pulls in
    // node-only `path`/`__dirname` via absolute-path.js and breaks bundling).
    import('swagger-ui-dist/swagger-ui-bundle.js').then((mod) => {
      const SwaggerUIBundle = (mod.default ?? mod) as typeof import('swagger-ui-dist')['SwaggerUIBundle'];
      if (cancelled || !containerRef.current) return;
      SwaggerUIBundle({
        domNode: containerRef.current,
        url: `${API}/v3/api-docs`,
        presets: [SwaggerUIBundle.presets.apis],
        requestInterceptor,
        docExpansion: 'list',
        defaultModelsExpandDepth: -1,
        tryItOutEnabled: true,
        // Only GET is executable — writes hit production and aren't sandboxed here.
        supportedSubmitMethods: ['get'],
        deepLinking: true,
      });
    });
    return () => { cancelled = true; };
    // requestInterceptor is stable (reads refs); init must run once when ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, token]);

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
          <Link href="/" className="flex flex-col gap-2">
            <Image src="/logo.png" alt="AZA" width={53} height={24} className="h-6 w-auto self-start" />
            <div>
              <p className="text-[10px] font-medium mt-1" style={{ color: 'rgba(183,238,122,0.5)', letterSpacing: '0.05em' }}>
                API EXPLORER
              </p>
            </div>
          </Link>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 p-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2 px-2" style={{ color: 'rgba(183,238,122,0.4)' }}>
            Partners / Third-party
          </p>

          {[
            { label: 'Sign in with AZA', anchor: '#/Sign in with AZA' },
            { label: 'OAuth Payments',   anchor: '#/OAuth Payments'   },
            { label: 'Developer Clients', anchor: '#/Developer Clients' },
            { label: 'Checkout',         anchor: '#/Checkout'         },
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
              Merchant API
            </p>
            {[
              { label: 'Merchant',       anchor: '#/Merchant'                 },
              { label: 'Team',           anchor: '#/Merchant Team'            },
              { label: 'Products',       anchor: '#/Merchant Products'        },
              { label: 'Invoices',       anchor: '#/Merchant Invoices'        },
              { label: 'Discount Codes', anchor: '#/Merchant Discount Codes'  },
              { label: 'Subscriptions',  anchor: '#/Merchant Subscriptions'   },
              { label: 'Plans',          anchor: '#/Merchant Plans'           },
              { label: 'Settlements',    anchor: '#/Merchant Settlements'     },
              { label: 'Notifications',  anchor: '#/Merchant Notifications'   },
              { label: 'Bulk Transfers', anchor: '#/Merchant Bulk Transfers'  },
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
              Test mode — only <code style={{ color: '#174717' }}>aza_test_…</code> keys execute here.
            </p>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5"
            style={{ background: 'rgba(217,119,6,0.1)', color: '#b45309' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d97706' }} />
            Test mode · v1
          </span>
        </div>

        {/* Integration overview */}
        <div className="px-6 pt-6">
          <div
            className="rounded-2xl p-5"
            style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)' }}
          >
            <h2 className="font-bold text-sm mb-1" style={{ color: '#174717' }}>
              Integrate with AZA
            </h2>
            <p className="text-xs mb-4" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Call the <strong>Merchant API</strong> server-to-server with your API key to create a
              checkout session — it returns a hosted <strong>pay.aza.systems</strong> link. Redirect
              your customer there to pay; AZA handles the UI, 2FA and receipts, then notifies you by
              webhook. Manage everything in the dashboard.
            </p>
            <p className="text-[11px] mb-4 rounded-lg px-3 py-2" style={{ background: 'rgba(217,119,6,0.08)', color: '#b45309' }}>
              This explorer runs in <strong>test mode</strong>: &quot;Try it out&quot; executes
              read-only <code>GET</code> calls only, and merchant calls require a <code>aza_test_…</code>
              key — so it can never write to or move money from live data.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  title: 'Hosted checkout',
                  host: 'pay.aza.systems',
                  href: 'https://pay.aza.systems',
                  desc: 'Secure payment pages from a checkout session — no card UI to build.',
                },
                {
                  title: 'Merchant dashboard',
                  host: 'merchants.aza.systems',
                  href: 'https://merchants.aza.systems',
                  desc: 'KYB, API keys, webhooks, payouts, settlements and reporting.',
                },
                {
                  title: 'Sign in with AZA',
                  host: 'OAuth 2.0',
                  href: '/developers/guides',
                  desc: 'Authenticate AZA users and request payments in your own app.',
                },
              ].map(card => (
                <a
                  key={card.title}
                  href={card.href}
                  target={card.href.startsWith('http') ? '_blank' : undefined}
                  rel={card.href.startsWith('http') ? 'noreferrer' : undefined}
                  className="rounded-xl p-3.5 transition-colors group"
                  style={{ background: '#f8f9fa', border: '1px solid rgba(0,0,0,0.06)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(23,71,23,0.3)'; e.currentTarget.style.background = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.background = '#f8f9fa'; }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: '#174717' }}>{card.title}</span>
                    <ExternalLink size={12} style={{ color: 'rgba(23,71,23,0.5)' }} />
                  </div>
                  <p className="text-[11px] font-mono mb-1.5" style={{ color: 'rgba(0,0,0,0.4)' }}>{card.host}</p>
                  <p className="text-[11px] leading-snug" style={{ color: 'rgba(0,0,0,0.5)' }}>{card.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Swagger UI (rendered into this node by swagger-ui-dist) */}
        <div className="swagger-wrapper">
          <div ref={containerRef} />
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
