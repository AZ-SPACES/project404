'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock, ArrowUpRight } from 'lucide-react';
import { DevNav } from '../_ui/DevNav';
import { DevFooter } from '../_ui/DevFooter';

const API = 'https://api.aza.systems';

type ServiceStatus = 'operational' | 'degraded' | 'down' | 'checking';

interface ServiceCheck {
  name: string;
  description: string;
  url: string;
  status: ServiceStatus;
  latencyMs: number | null;
  checkedAt: Date | null;
}

const SERVICES: Omit<ServiceCheck, 'status' | 'latencyMs' | 'checkedAt'>[] = [
  { name: 'API Gateway',        description: 'Core REST API — authentication, users, wallets', url: `${API}/actuator/health` },
  { name: 'Merchant API',       description: 'Checkout sessions, invoices, payouts',           url: `${API}/api/v1/merchant/public/aza` },
  { name: 'Payment Processing', description: 'Session creation and completion',                 url: `${API}/actuator/health` },
  { name: 'Webhook Delivery',   description: 'Real-time event dispatch',                        url: `${API}/actuator/health` },
];

// Light-surface palette per status. `accent` drives icons/dots, `tint`/`border`
// wash the overall banner, and `pillBg`/`pillText` style the per-service pills.
const THEME: Record<ServiceStatus, {
  accent: string; tint: string; border: string; pillBg: string; pillText: string; label: string;
}> = {
  operational: { accent: '#16a34a', tint: '#f0fdf4', border: '#bbf7d0', pillBg: '#dcfce7', pillText: '#15803d', label: 'Operational' },
  degraded:    { accent: '#d97706', tint: '#fffbeb', border: '#fde68a', pillBg: '#fef3c7', pillText: '#b45309', label: 'Degraded'    },
  down:        { accent: '#dc2626', tint: '#fef2f2', border: '#fecaca', pillBg: '#fee2e2', pillText: '#b91c1c', label: 'Down'        },
  checking:    { accent: '#9ca3af', tint: '#f9fafb', border: '#e5e7eb', pillBg: '#f3f4f6', pillText: '#6b7280', label: 'Checking…'   },
};

function StatusIcon({ status, size = 18 }: { status: ServiceStatus; size?: number }) {
  const c = THEME[status].accent;
  if (status === 'operational') return <CheckCircle size={size} color={c} />;
  if (status === 'degraded')    return <AlertTriangle size={size} color={c} />;
  if (status === 'down')        return <XCircle size={size} color={c} />;
  return <Clock size={size} color={c} className="animate-pulse" />;
}

function StatusPill({ status }: { status: ServiceStatus }) {
  const t = THEME[status];
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
      style={{ background: t.pillBg, color: t.pillText }}
    >
      {t.label}
    </span>
  );
}

async function checkService(url: string): Promise<{ status: ServiceStatus; latencyMs: number }> {
  const start = performance.now();
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok || res.status === 404) {
      return { status: latencyMs > 3000 ? 'degraded' : 'operational', latencyMs };
    }
    if (res.status >= 500) return { status: 'down', latencyMs };
    return { status: 'degraded', latencyMs };
  } catch {
    return { status: 'down', latencyMs: Math.round(performance.now() - start) };
  }
}

function overallStatus(services: ServiceCheck[]): ServiceStatus {
  if (services.every(s => s.status === 'checking')) return 'checking';
  if (services.some(s => s.status === 'down'))        return 'down';
  if (services.some(s => s.status === 'degraded'))    return 'degraded';
  if (services.some(s => s.status === 'checking'))    return 'degraded';
  return 'operational';
}

const OVERALL_LABEL: Record<ServiceStatus, string> = {
  checking:    'Checking system status…',
  operational: 'All systems operational',
  degraded:    'Partial service degradation',
  down:        'Service disruption detected',
};

export default function StatusPage() {
  const [services, setServices] = useState<ServiceCheck[]>(
    SERVICES.map(s => ({ ...s, status: 'checking', latencyMs: null, checkedAt: null }))
  );
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const runChecks = useCallback(async () => {
    setRefreshing(true);
    setServices(prev => prev.map(s => ({ ...s, status: 'checking', latencyMs: null })));
    const now = new Date();

    // Services sharing the same health URL reuse a single in-flight request
    const inFlight = new Map<string, Promise<{ status: ServiceStatus; latencyMs: number }>>();
    const results = await Promise.all(
      SERVICES.map(s => {
        if (!inFlight.has(s.url)) inFlight.set(s.url, checkService(s.url));
        return inFlight.get(s.url)!;
      })
    );

    setServices(SERVICES.map((s, i) => ({
      ...s,
      status:    results[i].status,
      latencyMs: results[i].latencyMs,
      checkedAt: now,
    })));
    setLastRefreshed(now);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    // Kick off an immediate check on mount, then poll every minute.
    runChecks(); // eslint-disable-line react-hooks/set-state-in-effect
    const timer = setInterval(runChecks, 60_000);
    return () => clearInterval(timer);
  }, [runChecks]);

  const overall = overallStatus(services);
  const t = THEME[overall];
  const upCount = services.filter(s => s.status === 'operational').length;

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#111827] antialiased">
      <DevNav active="/developers/status" />

      <main className="flex-1">
        {/* Page header */}
        <div className="mx-auto max-w-3xl px-5 pt-14 pb-6 sm:px-6">
          <h1
            className="text-3xl font-black tracking-tight text-[#111827] sm:text-4xl"
            style={{ letterSpacing: '-0.03em', textWrap: 'balance' } as React.CSSProperties}
          >
            System Status
          </h1>
          <p className="mt-3 max-w-md text-base text-[#6b7280]">
            Live reachability of the Aza API and platform services, checked directly from your browser.
          </p>
        </div>

        {/* Overall status banner */}
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <div
            className="rounded-2xl border p-5 transition-colors duration-500 sm:p-6"
            style={{ background: t.tint, borderColor: t.border }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white shadow-sm">
                  {overall === 'operational' && (
                    <span
                      className="absolute inline-flex h-3 w-3 animate-ping rounded-full opacity-60"
                      style={{ background: t.accent }}
                    />
                  )}
                  <StatusIcon status={overall} size={24} />
                </span>
                <div>
                  <p className="text-lg font-extrabold tracking-tight text-[#111827] sm:text-xl" style={{ letterSpacing: '-0.02em' }}>
                    {OVERALL_LABEL[overall]}
                  </p>
                  <p className="mt-0.5 text-sm text-[#6b7280]">
                    {overall === 'checking'
                      ? 'Pinging endpoints…'
                      : `${upCount} of ${services.length} services operational`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pl-16 sm:pl-0">
                {lastRefreshed && (
                  <span className="text-xs text-[#9ca3af]">
                    Updated {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={runChecks}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] transition-colors hover:border-[#0e2a0e] hover:text-[#111827] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A]"
                >
                  <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Service cards */}
        <section className="mx-auto max-w-3xl px-5 py-8 sm:px-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#6b7280]">Services</h2>

          <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {services.map((service, i) => (
              <div
                key={service.name}
                className={`flex items-center justify-between gap-3 px-5 py-4 ${i < services.length - 1 ? 'border-b border-[#f3f4f6]' : ''}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StatusIcon status={service.status} size={16} />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#111827]">{service.name}</p>
                    <p className="truncate text-sm text-[#6b7280]">{service.description}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {service.latencyMs !== null && (
                    <span className="hidden font-mono text-xs text-[#9ca3af] sm:inline">{service.latencyMs} ms</span>
                  )}
                  <StatusPill status={service.status} />
                </div>
              </div>
            ))}
          </div>

          {/* About */}
          <div className="mt-6 rounded-2xl border border-[#e5e7eb] bg-[#f8f9fa] p-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#9ca3af]">About this page</p>
            <p className="text-sm leading-relaxed text-[#6b7280]">
              Status is checked live from your browser by pinging the Aza API endpoints directly, so results reflect
              reachability from your network. This page auto-refreshes every 60 seconds. For production monitoring,
              poll{' '}
              <code className="rounded bg-[#eaf7e0] px-1.5 py-0.5 text-xs text-[#174717]">
                {API}/actuator/health
              </code>{' '}
              from your server.
            </p>
          </div>

          {/* Related links */}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            {[
              { href: '/developers/guides', label: 'Developer Guides' },
              { href: '/developers/api-explorer', label: 'API Explorer' },
              { href: '/developers/guides?doc=errors', label: 'Error Reference' },
            ].map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#174717] transition-colors hover:text-[#2e7d2e]"
              >
                {l.label}
                <ArrowUpRight size={13} />
              </Link>
            ))}
          </div>
        </section>
      </main>

      <DevFooter />
    </div>
  );
}
