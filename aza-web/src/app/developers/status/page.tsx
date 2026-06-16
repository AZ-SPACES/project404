'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

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
  { name: 'API Gateway',       description: 'Core REST API — authentication, users, wallets', url: `${API}/actuator/health` },
  { name: 'Merchant API',      description: 'Checkout sessions, invoices, payouts',           url: `${API}/api/v1/merchant/public/aza` },
  { name: 'Payment Processing',description: 'Session creation and completion',                 url: `${API}/actuator/health` },
  { name: 'Webhook Delivery',  description: 'Real-time event dispatch',                       url: `${API}/actuator/health` },
];

function statusColor(s: ServiceStatus) {
  if (s === 'operational') return '#22c55e';
  if (s === 'degraded')    return '#f59e0b';
  if (s === 'down')        return '#ef4444';
  return '#9ca3af';
}

function StatusIcon({ status, size = 18 }: { status: ServiceStatus; size?: number }) {
  if (status === 'operational') return <CheckCircle size={size} color="#22c55e" />;
  if (status === 'degraded')    return <AlertTriangle size={size} color="#f59e0b" />;
  if (status === 'down')        return <XCircle size={size} color="#ef4444" />;
  return <Clock size={size} color="#9ca3af" className="animate-pulse" />;
}

function StatusPill({ status }: { status: ServiceStatus }) {
  const labels: Record<ServiceStatus, string> = {
    operational: 'Operational',
    degraded:    'Degraded',
    down:        'Down',
    checking:    'Checking…',
  };
  return (
    <span
      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: statusColor(status) + '20', color: statusColor(status) }}
    >
      {labels[status]}
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
  const overallBg =
    overall === 'operational' ? 'linear-gradient(135deg, #052e16 0%, #14532d 100%)' :
    overall === 'degraded'    ? 'linear-gradient(135deg, #451a03 0%, #78350f 100%)' :
    overall === 'down'        ? 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)' :
                                'linear-gradient(135deg, #0e2a0e 0%, #132613 100%)';

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans antialiased">
      {/* Hero banner */}
      <div style={{ background: overallBg }} className="transition-all duration-700">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Link
            href="/developers/guides"
            className="inline-flex items-center gap-1.5 text-xs font-medium mb-8 transition-colors"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
          >
            <ArrowLeft size={12} /> Developer Docs
          </Link>

          <div className="flex items-center gap-4 mb-3">
            <Image src="/logo.png" alt="Aza" width={88} height={40} className="h-10 w-auto shrink-0" />
            <div>
              <p className="text-white font-extrabold text-xl" style={{ letterSpacing: '-0.04em' }}>Aza System Status</p>
              <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>api.aza.systems</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <StatusIcon status={overall} size={28} />
            <p className="text-white font-bold text-2xl" style={{ letterSpacing: '-0.03em' }}>
              {OVERALL_LABEL[overall]}
            </p>
          </div>

          {lastRefreshed && (
            <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Last checked {lastRefreshed.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Service cards */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Services</h2>
          <button
            onClick={runChecks}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {services.map((service, i) => (
            <div
              key={service.name}
              className={`flex items-center justify-between px-5 py-4 ${i < services.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className="flex items-center gap-3">
                <StatusIcon status={service.status} size={16} />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{service.name}</p>
                  <p className="text-xs text-gray-500">{service.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {service.latencyMs !== null && (
                  <span className="text-xs font-mono text-gray-400">{service.latencyMs} ms</span>
                )}
                <StatusPill status={service.status} />
              </div>
            </div>
          ))}
        </div>

        {/* Uptime note */}
        <div className="mt-6 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">About this page</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Status is checked live from your browser by pinging the Aza API endpoints directly. Results reflect
            reachability from your network. For production monitoring integrations, poll{' '}
            <code className="text-[#174717] bg-gray-100 px-1.5 py-0.5 rounded text-xs">
              {API}/actuator/health
            </code>{' '}
            from your server.
          </p>
        </div>

        {/* Quick links */}
        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <Link
            href="/developers/guides"
            className="text-xs font-semibold text-[#174717] hover:underline"
          >
            ← Developer Guides
          </Link>
          <span className="text-gray-300">·</span>
          <Link
            href="/developers/api-explorer"
            className="text-xs font-semibold text-[#174717] hover:underline"
          >
            API Explorer
          </Link>
          <span className="text-gray-300">·</span>
          <Link
            href="/developers/guides?doc=errors"
            className="text-xs font-semibold text-[#174717] hover:underline"
          >
            Error Reference
          </Link>
        </div>
      </div>
    </div>
  );
}
