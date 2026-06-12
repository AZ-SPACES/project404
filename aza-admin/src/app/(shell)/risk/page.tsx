"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRiskAlerts,
  getRiskRules,
  getRiskStats,
  updateRiskAlert,
  updateRiskRules,
  resetUserRateLimit,
  resetIpRateLimit,
  resetAllRateLimits,
  RiskAlert,
  RiskStats,
  Page,
  type RiskRules,
} from "@/lib/admin-api";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function RiskRulesCard() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<RiskRules | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: rules } = useQuery({
    queryKey: ["riskRules"],
    queryFn: getRiskRules,
  });

  const effective = draft ?? rules;

  const save = useMutation({
    mutationFn: () => updateRiskRules(draft!),
    onSuccess: (updated) => {
      queryClient.setQueryData(["riskRules"], updated);
      setDraft(null);
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!effective) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-sm font-medium text-foreground mb-1">Monitoring rules</p>
      <p className="text-xs text-foreground/40 mb-4">
        Thresholds the transaction risk engine applies live — changes are audit-logged and take effect immediately.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-foreground/40 mb-1">Large transfer flag (GHS ≥)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={effective.largeTransferGhs}
            onChange={(e) => setDraft({ ...effective, largeTransferGhs: e.target.value })}
            className="w-44 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground/40 mb-1">Max outgoing transfers / hour</label>
          <input
            type="number"
            min="1"
            value={effective.velocityMaxHourly}
            onChange={(e) => setDraft({ ...effective, velocityMaxHourly: e.target.value })}
            className="w-44 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
          />
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={!draft || save.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-40 transition-colors"
        >
          {save.isPending && <Loader2 size={14} className="animate-spin" />}
          Save rules
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved.</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}

const SEVERITY_MAP = {
  CRITICAL: { cls: "text-red-400 bg-red-500/10 border-red-500/20", dot: "bg-red-500" },
  HIGH: { cls: "text-orange-400 bg-orange-500/10 border-orange-500/20", dot: "bg-orange-500" },
  MEDIUM: { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-500" },
  LOW: { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20", dot: "bg-blue-400" },
};

const STATUS_MAP = {
  OPEN: { cls: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Open" },
  INVESTIGATING: { cls: "text-blue-400 bg-blue-500/10 border-blue-500/20", label: "Investigating" },
  RESOLVED: { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Resolved" },
  FALSE_POSITIVE: { cls: "text-foreground/40 bg-muted/30 border-border", label: "False Positive" },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  VELOCITY: "High Velocity",
  LARGE_TRANSFER: "Large Transfer",
  UNUSUAL_PATTERN: "Unusual Pattern",
  MULTIPLE_DEVICES: "Multiple Devices",
  BLACKLIST_MATCH: "Blacklist Match",
  PEP_MATCH: "PEP Match",
};

function SeverityBadge({ severity }: { severity: RiskAlert["severity"] }) {
  const cfg = SEVERITY_MAP[severity];
  return <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold border ${cfg.cls}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
    {severity}
  </span>;
}

function StatusBadge({ status }: { status: RiskAlert["status"] }) {
  const cfg = STATUS_MAP[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

type SeverityFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type StatusFilter = "ALL" | "OPEN" | "INVESTIGATING" | "RESOLVED";

export default function RiskPage() {
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
  const [page, setPage] = useState(0);
  const [actioning, setActioning] = useState<RiskAlert | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [rlUserId, setRlUserId] = useState("");
  const [rlIp, setRlIp] = useState("");
  const [rlToast, setRlToast] = useState<string | null>(null);

  const showRlToast = (msg: string) => {
    setRlToast(msg);
    setTimeout(() => setRlToast(null), 3000);
  };

  const { data: riskStats } = useQuery<RiskStats>({
    queryKey: ["riskStats"],
    queryFn: getRiskStats,
  });

  const { data, isLoading, error } = useQuery<Page<RiskAlert>>({
    queryKey: ["riskAlerts", { severityFilter, statusFilter, page }],
    queryFn: () => getRiskAlerts(
      page, 20,
      severityFilter !== "ALL" ? severityFilter : undefined,
      statusFilter !== "ALL" ? statusFilter : undefined,
    ),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      updateRiskAlert(id, newStatus, actionNotes),
    onSuccess: (updated) => {
      queryClient.setQueryData<Page<RiskAlert>>(["riskAlerts", { severityFilter, statusFilter, page }], (prev) =>
        prev ? { ...prev, content: prev.content.map(a => a.id === updated.id ? updated : a) } : prev
      );
      queryClient.invalidateQueries({ queryKey: ["riskStats"] });
      setActioning(null);
      setActionNotes("");
    },
  });

  const resetUserMutation = useMutation({
    mutationFn: (userId: string) => resetUserRateLimit(userId),
    onSuccess: () => {
      showRlToast("Rate limits cleared for user " + rlUserId.trim());
      setRlUserId("");
    },
  });

  const resetIpMutation = useMutation({
    mutationFn: (ip: string) => resetIpRateLimit(ip),
    onSuccess: () => {
      showRlToast("Rate limits cleared for IP " + rlIp.trim());
      setRlIp("");
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: resetAllRateLimits,
    onSuccess: (result) => {
      showRlToast(`Flushed ${result.keysDeleted} rate-limit keys`);
    },
  });

  const rlLoading = resetUserMutation.isPending ? "user" : resetIpMutation.isPending ? "ip" : resetAllMutation.isPending ? "all" : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {rlToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm px-4 py-3 rounded-xl shadow-2xl">
          {rlToast}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Risk Management</h1>
        <p className="text-foreground/40 text-sm mt-0.5">Fraud detection and real-time risk monitoring</p>
      </div>

      {riskStats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Open Alerts", value: riskStats.openAlerts, color: "text-amber-400" },
            { label: "Critical", value: riskStats.criticalAlerts, color: "text-red-400" },
            { label: "Investigating", value: riskStats.investigatingAlerts, color: "text-blue-400" },
            { label: "Resolved Today", value: riskStats.resolvedToday, color: "text-emerald-400" },
            { label: "Avg Risk Score", value: riskStats.averageRiskScore.toFixed(0), color: "text-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] text-foreground/35 uppercase tracking-wider font-medium mb-1">{label}</p>
              <p className={`text-2xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <RiskRulesCard />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit">
          {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as SeverityFilter[]).map((s) => (
            <button key={s} onClick={() => { setSeverityFilter(s); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${severityFilter === s ? "bg-[#B7EE7A] text-black" : "text-foreground/50 hover:text-foreground"}`}>
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit">
          {(["ALL", "OPEN", "INVESTIGATING", "RESOLVED"] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "bg-muted/50 text-foreground" : "text-foreground/50 hover:text-foreground"}`}>
              {s === "ALL" ? "All Status" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-foreground/30" size={24} />
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-20 text-foreground/25">
          <ShieldAlert size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No risk alerts found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.content.map((alert) => (
            <div key={alert.id} className={`bg-card border rounded-xl px-5 py-4 ${
              alert.severity === "CRITICAL" ? "border-red-500/15" :
              alert.severity === "HIGH" ? "border-orange-500/10" : "border-border"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <SeverityBadge severity={alert.severity} />
                    <span className="px-2 py-0.5 rounded text-xs border border-border text-foreground/50">
                      {ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}
                    </span>
                    <StatusBadge status={alert.status} />
                    {alert.riskScore > 0 && (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                        alert.riskScore >= 80 ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        alert.riskScore >= 60 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        "bg-muted/30 text-foreground/40 border-border"
                      }`}>Score: {alert.riskScore}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mb-1.5">
                    <p className="text-sm font-semibold text-foreground">{alert.userName}</p>
                    {alert.userHandle && <p className="text-xs text-foreground/35">@{alert.userHandle}</p>}
                  </div>
                  <p className="text-sm text-foreground/55 leading-relaxed">{alert.description}</p>
                  {alert.transactionId && (
                    <p className="text-xs text-foreground/30 mt-1 font-mono">Txn: {alert.transactionId}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-xs text-foreground/30">{fmtDate(alert.triggeredAt)}</p>
                  {alert.status !== "RESOLVED" && alert.status !== "FALSE_POSITIVE" && (
                    <button
                      onClick={() => { setActioning(alert); setActionNotes(""); }}
                      className="px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted border border-border text-xs text-foreground/60 hover:text-foreground transition-all font-medium"
                    >
                      Action
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0 || isLoading} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Previous</button>
          <span className="text-sm text-foreground/40">{page + 1} / {data.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages - 1 || isLoading} className="px-4 py-2 text-sm rounded-xl bg-muted/30 hover:bg-muted disabled:opacity-30 border border-border">Next</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={15} className="text-foreground/40" />
          <h2 className="text-sm font-semibold text-foreground">Rate Limit Management</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-xs text-foreground/40 font-medium">By User ID</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="User UUID…"
                value={rlUserId}
                onChange={(e) => setRlUserId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rlUserId.trim() && resetUserMutation.mutate(rlUserId.trim())}
                className="flex-1 min-w-0 bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 font-mono"
              />
              <button
                onClick={() => resetUserMutation.mutate(rlUserId.trim())}
                disabled={!rlUserId.trim() || rlLoading !== null}
                className="px-3 py-2 rounded-xl bg-[#B7EE7A]/15 border border-[#B7EE7A]/25 text-[#B7EE7A] text-xs font-semibold hover:bg-[#B7EE7A]/25 disabled:opacity-40 transition-all flex-shrink-0"
              >
                {rlLoading === "user" ? <Loader2 size={13} className="animate-spin" /> : "Clear"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-foreground/40 font-medium">By IP Address</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 1.2.3.4"
                value={rlIp}
                onChange={(e) => setRlIp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rlIp.trim() && resetIpMutation.mutate(rlIp.trim())}
                className="flex-1 min-w-0 bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 font-mono"
              />
              <button
                onClick={() => resetIpMutation.mutate(rlIp.trim())}
                disabled={!rlIp.trim() || rlLoading !== null}
                className="px-3 py-2 rounded-xl bg-[#B7EE7A]/15 border border-[#B7EE7A]/25 text-[#B7EE7A] text-xs font-semibold hover:bg-[#B7EE7A]/25 disabled:opacity-40 transition-all flex-shrink-0"
              >
                {rlLoading === "ip" ? <Loader2 size={13} className="animate-spin" /> : "Clear"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-foreground/40 font-medium">Nuclear Option</p>
            <button
              onClick={() => {
                if (confirm("This will flush ALL rate-limit counters for every user and IP. Continue?")) {
                  resetAllMutation.mutate();
                }
              }}
              disabled={rlLoading !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-40 transition-all"
            >
              {rlLoading === "all" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Reset All Rate Limits
            </button>
            <p className="text-[10px] text-foreground/20">Clears every counter for every user and IP</p>
          </div>
        </div>
      </div>

      {actioning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setActioning(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-foreground">Action Risk Alert</h3>
              <button onClick={() => setActioning(null)} className="text-foreground/40 hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="bg-muted/20 border border-border rounded-xl p-4 mb-4 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-sm text-foreground/40">User</span>
                <span className="text-sm text-foreground font-medium">{actioning.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-foreground/40">Alert Type</span>
                <span className="text-sm text-foreground/70">{ALERT_TYPE_LABELS[actioning.alertType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-foreground/40">Severity</span>
                <SeverityBadge severity={actioning.severity} />
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 block">Notes</label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Add investigation notes..."
                rows={3}
                className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20 resize-none"
              />
            </div>

            {actionMutation.error && (
              <p className="text-red-400 text-sm mb-3">{(actionMutation.error as Error).message}</p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => actionMutation.mutate({ id: actioning.id, newStatus: "INVESTIGATING" })}
                disabled={actionMutation.isPending}
                className="py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs font-semibold hover:bg-blue-500/25 disabled:opacity-50 transition-all"
              >
                Investigate
              </button>
              <button
                onClick={() => actionMutation.mutate({ id: actioning.id, newStatus: "RESOLVED" })}
                disabled={actionMutation.isPending}
                className="py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-1"
              >
                <CheckCircle2 size={12} />
                Resolve
              </button>
              <button
                onClick={() => actionMutation.mutate({ id: actioning.id, newStatus: "FALSE_POSITIVE" })}
                disabled={actionMutation.isPending}
                className="py-2.5 rounded-xl bg-muted/30 border border-border text-foreground/40 text-xs font-semibold hover:bg-muted disabled:opacity-50 transition-all"
              >
                False +
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
