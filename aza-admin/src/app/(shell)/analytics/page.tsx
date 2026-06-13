"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getWebhookAnalytics,
  getGeoAnalytics,
  type WebhookAnalytics,
  type GeoAnalytics,
} from "@/lib/admin-api";
import { Globe, Loader2, Webhook } from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString();
}

function PctBar({ pct, color = "#B7EE7A" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function WebhookSection() {
  const { data, isLoading } = useQuery<WebhookAnalytics>({
    queryKey: ["webhookAnalytics"],
    queryFn: getWebhookAnalytics,
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-32">
      <Loader2 size={20} className="animate-spin text-foreground/30" />
    </div>
  );

  if (!data) return null;

  const successColor = data.successRate >= 90 ? "#B7EE7A" : data.successRate >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Deliveries", value: fmt(data.total) },
          { label: "Succeeded", value: fmt(data.delivered), sub: `${data.successRate}%` },
          { label: "Failed", value: fmt(data.failed) },
          { label: "Avg Attempts", value: String(data.avgAttempts) },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-foreground/40 text-xs">{label}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
            {sub && <p className="text-xs text-[#B7EE7A] mt-0.5">{sub} success rate</p>}
          </div>
        ))}
      </div>

      {/* Success rate bar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-foreground/70">Platform Success Rate</p>
          <span className="text-sm font-bold" style={{ color: successColor }}>{data.successRate}%</span>
        </div>
        <PctBar pct={data.successRate} color={successColor} />
      </div>

      {/* By event type */}
      {data.byEventType.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-foreground/40 uppercase tracking-wider mb-4">By Event Type</p>
          <div className="space-y-4">
            {data.byEventType.map(row => (
              <div key={row.eventType}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-foreground font-mono">{row.eventType}</span>
                  <div className="flex items-center gap-3 text-xs text-foreground/50">
                    <span>{fmt(row.total)} total</span>
                    <span className={row.successRate >= 90 ? "text-[#B7EE7A]" : row.successRate >= 70 ? "text-amber-400" : "text-red-400"}>
                      {row.successRate}%
                    </span>
                  </div>
                </div>
                <PctBar
                  pct={row.successRate}
                  color={row.successRate >= 90 ? "#B7EE7A" : row.successRate >= 70 ? "#f59e0b" : "#ef4444"}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GeoSection() {
  const { data, isLoading } = useQuery<GeoAnalytics>({
    queryKey: ["geoAnalytics"],
    queryFn: () => getGeoAnalytics(20),
    refetchInterval: 120_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-32">
      <Loader2 size={20} className="animate-spin text-foreground/30" />
    </div>
  );

  if (!data) return null;

  const maxSessions = Math.max(...data.topLocations.map(l => l.sessions), 1);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Sessions", value: fmt(data.totalSessions) },
          { label: "With Location", value: fmt(data.sessionsWithLocation) },
          { label: "Unknown", value: fmt(data.unknownSessions) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-foreground/40 text-xs">{label}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Location list */}
      {data.topLocations.length > 0 ? (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-foreground/40 uppercase tracking-wider mb-4">Top Locations</p>
          <div className="space-y-3">
            {data.topLocations.map((loc, i) => (
              <div key={loc.location}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground">{i + 1}. {loc.location}</span>
                  <span className="text-xs text-foreground/50">{fmt(loc.sessions)} sessions</span>
                </div>
                <PctBar pct={(loc.sessions / maxSessions) * 100} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-foreground/30 text-sm">
          No location data available yet.
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <p className="text-foreground/40 text-sm mt-1">Webhook delivery health and geographic session distribution.</p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Webhook size={15} className="text-foreground/40" />
          <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">Webhook Delivery Analytics</h2>
        </div>
        <WebhookSection />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Globe size={15} className="text-foreground/40" />
          <h2 className="text-sm font-semibold text-foreground/70 uppercase tracking-wider">Geographic Distribution</h2>
        </div>
        <GeoSection />
      </section>
    </div>
  );
}
