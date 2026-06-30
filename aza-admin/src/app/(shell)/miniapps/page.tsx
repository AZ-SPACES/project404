"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMiniAppReports,
  getMiniAppReportStats,
  resolveMiniAppReport,
  getAllMiniApps,
  setMiniAppMaintenance,
  disableMiniApp,
  enableMiniApp,
  getMiniAppSubmissions,
  approveMiniApp,
  rejectMiniApp,
  suspendMiniApp,
  isPendingApproval,
  MiniAppReport,
  MiniAppReportStats,
  MiniAppSubmission,
  AdminMiniApp,
  Page,
} from "@/lib/admin-api";
import { Flag, CheckCircle2, XCircle, Clock, Loader2, X, Ban, Wrench, LayoutGrid, Package, Check, ExternalLink } from "lucide-react";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

const REASON_LABELS: Record<string, string> = {
  SPAM:          "Spam",
  INAPPROPRIATE: "Inappropriate",
  NOT_WORKING:   "Not Working",
  MISLEADING:    "Misleading",
  OTHER:         "Other",
};

const STATUS_MAP = {
  OPEN:      { label: "Open",      cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  RESOLVED:  { label: "Resolved",  cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  DISMISSED: { label: "Dismissed", cls: "text-foreground/30 bg-muted/30 border-border" },
};

function StatusBadge({ status }: { status: MiniAppReport["status"] }) {
  const cfg = STATUS_MAP[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

const APP_STATUS_MAP = {
  ACTIVE:      { label: "Active",      cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  MAINTENANCE: { label: "Maintenance", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  DISABLED:    { label: "Disabled",    cls: "text-red-400 bg-red-500/10 border-red-500/20" },
};

function AppStatusBadge({ status }: { status: AdminMiniApp["status"] }) {
  const cfg = APP_STATUS_MAP[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

type FilterStatus = "ALL" | "OPEN" | "RESOLVED" | "DISMISSED";

type AppAction =
  | { type: "maintenance"; app: AdminMiniApp }
  | { type: "disable"; app: AdminMiniApp };

const SUBMISSION_STATUS_MAP = {
  PENDING_REVIEW: { label: "Pending", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  ACTIVE:         { label: "Live",    cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  REJECTED:       { label: "Rejected", cls: "text-red-400 bg-red-500/10 border-red-500/20" },
  SUSPENDED:      { label: "Suspended", cls: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  DRAFT:          { label: "Draft",   cls: "text-foreground/40 bg-muted/30 border-border" },
};

function SubmissionStatusBadge({ status }: { status: MiniAppSubmission["status"] }) {
  const cfg = SUBMISSION_STATUS_MAP[status] ?? { label: status, cls: "text-foreground/40 bg-muted/30 border-border" };
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>{cfg.label}</span>;
}

const PERM_LABELS: Record<string, string> = {
  USER_PROFILE:      "Profile",
  USER_PHONE:        "Phone",
  USER_EMAIL:        "Email",
  MAKE_PAYMENTS:     "Payments",
  READ_BALANCE:      "Balance",
  READ_TRANSACTIONS: "Transactions",
};

export default function MiniAppsPage() {
  const queryClient = useQueryClient();

  // Reports section state
  const [filter, setFilter] = useState<FilterStatus>("OPEN");
  const [page, setPage] = useState(0);
  const [resolving, setResolving] = useState<MiniAppReport | null>(null);
  const [resolution, setResolution] = useState("");
  const [disableWithReport, setDisableWithReport] = useState(false);

  // Catalog section state
  const [appAction, setAppAction] = useState<AppAction | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const [notice, setNotice] = useState("");

  // Submissions section state
  const [subPage, setSubPage] = useState(0);
  const [reviewTarget, setReviewTarget] = useState<MiniAppSubmission | null>(null);
  const [reviewAction, setReviewAction] = useState<"reject" | "suspend" | null>(null);
  const [reviewReason, setReviewReason] = useState("");

  const { data: submissions, isLoading: subsLoading, error: subsError } = useQuery<Page<MiniAppSubmission>>({
    queryKey: ["miniAppSubmissions", subPage],
    queryFn: () => getMiniAppSubmissions(subPage, 20),
    retry: 1,
  });

  const approveMutation = useMutation({
    mutationFn: (appId: string) => approveMiniApp(appId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniAppSubmissions"] });
      setNotice("App approved and is now live.");
    },
    onError: (e: Error) => setNotice("Error: " + e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ appId, reason, action }: { appId: string; reason: string; action: "reject" | "suspend" }) =>
      action === "suspend" ? suspendMiniApp(appId, reason) : rejectMiniApp(appId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniAppSubmissions"] });
      setReviewTarget(null);
      setReviewReason("");
      setReviewAction(null);
    },
  });

  const { data: stats } = useQuery<MiniAppReportStats>({
    queryKey: ["miniAppStats"],
    queryFn: getMiniAppReportStats,
  });

  const { data: allApps, isLoading: appsLoading, error: appsError } = useQuery<AdminMiniApp[]>({
    queryKey: ["allMiniApps"],
    queryFn: getAllMiniApps,
    retry: 1,
  });

  const maintenanceMutation = useMutation({
    mutationFn: ({ appId, message }: { appId: string; message: string }) =>
      setMiniAppMaintenance(appId, message || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allMiniApps"] });
      setAppAction(null);
      setActionMessage("");
    },
  });

  const disableAppMutation = useMutation({
    mutationFn: ({ appId, reason }: { appId: string; reason: string }) =>
      disableMiniApp(appId, reason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allMiniApps"] });
      setAppAction(null);
      setActionMessage("");
    },
  });

  const enableMutation = useMutation({
    mutationFn: (appId: string) => enableMiniApp(appId),
    onSuccess: (result) => {
      if (isPendingApproval(result)) {
        setNotice("Re-enable submitted — another ADMIN must approve it in Approvals.");
        queryClient.invalidateQueries({ queryKey: ["allMiniApps"] });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["allMiniApps"] });
    },
  });

  const { data, isLoading, error } = useQuery<Page<MiniAppReport>>({
    queryKey: ["miniAppReports", { filter, page }],
    queryFn: () => getMiniAppReports(page, 20, filter === "ALL" ? undefined : filter),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ action }: { action: "RESOLVE" | "DISMISS" }) =>
      resolveMiniAppReport(resolving!.id, action, resolution, action === "RESOLVE" && disableWithReport),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["miniAppReports"] });
      queryClient.invalidateQueries({ queryKey: ["miniAppStats"] });
      queryClient.invalidateQueries({ queryKey: ["allMiniApps"] });
      setResolving(null);
      setResolution("");
      setDisableWithReport(false);
    },
  });

  const reports = data?.content ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mini Apps</h1>
        <p className="text-foreground/40 text-sm mt-1">Manage availability and review user reports</p>
      </div>

      {notice && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-emerald-400 text-sm flex items-center justify-between">
          {notice}
          <button onClick={() => setNotice("")}><X size={14} /></button>
        </div>
      )}

      {/* ── Developer Submissions ───────────────────────────────────────────── */}
      <div className="bg-muted/30 border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Package size={14} className="text-foreground/50" />
          <h2 className="text-sm font-semibold">Developer Submissions</h2>
          {submissions && (
            <span className="ml-auto text-xs text-foreground/40">{submissions.totalElements} pending</span>
          )}
        </div>

        {subsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-foreground/40" />
          </div>
        ) : subsError ? (
          <div className="text-center py-8 text-foreground/30 text-sm">Could not load submissions</div>
        ) : (submissions?.content ?? []).length === 0 ? (
          <div className="text-center py-10 text-foreground/30 text-sm">No pending submissions</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-foreground/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">App</th>
                  <th className="text-left px-4 py-3">Developer</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Permissions</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Submitted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(submissions?.content ?? []).map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {sub.iconUrl ? (
                          <img src={sub.iconUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-foreground/30">
                            <Package size={14} />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{sub.name}</p>
                          <p className="text-foreground/40 text-xs truncate max-w-[200px]">{sub.description}</p>
                        </div>
                      </div>
                      {sub.screenshotUrls?.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {sub.screenshotUrls.map((shot, i) => (
                            <a key={i} href={shot} target="_blank" rel="noopener noreferrer" title="Open full size">
                              <img
                                src={shot}
                                alt={`Screenshot ${i + 1}`}
                                loading="lazy"
                                className="w-12 h-12 rounded-md object-cover border border-border hover:ring-2 hover:ring-emerald-400/50 transition"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground/60">{sub.developerName}</td>
                    <td className="px-4 py-3 text-foreground/50">{sub.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {sub.requestedPermissions.map((p) => (
                          <span key={p} className="px-1.5 py-0.5 rounded text-xs bg-muted/50 text-foreground/60">
                            {PERM_LABELS[p] ?? p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3"><SubmissionStatusBadge status={sub.status} /></td>
                    <td className="px-4 py-3 text-foreground/40 whitespace-nowrap text-xs">
                      {sub.submittedAt ? fmtDate(sub.submittedAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <a
                          href={sub.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground/40 hover:text-foreground"
                          title="Preview"
                        >
                          <ExternalLink size={13} />
                        </a>
                        {sub.status === "PENDING_REVIEW" && (
                          <>
                            <button
                              onClick={() => approveMutation.mutate(sub.id)}
                              disabled={approveMutation.isPending}
                              className="text-xs text-emerald-400 hover:underline disabled:opacity-50 flex items-center gap-1"
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button
                              onClick={() => { setReviewTarget(sub); setReviewAction("reject"); setReviewReason(""); }}
                              className="text-xs text-red-400 hover:underline"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {sub.status === "ACTIVE" && (
                          <button
                            onClick={() => { setReviewTarget(sub); setReviewAction("suspend"); setReviewReason(""); }}
                            className="text-xs text-orange-400 hover:underline"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {submissions && submissions.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-foreground/40">
                <span>Page {subPage + 1} of {submissions.totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={subPage === 0}
                    onClick={() => setSubPage(p => p - 1)}
                    className="px-3 py-1 rounded border border-border hover:bg-muted/50 disabled:opacity-30"
                  >Previous</button>
                  <button
                    disabled={subPage + 1 >= submissions.totalPages}
                    onClick={() => setSubPage(p => p + 1)}
                    className="px-3 py-1 rounded border border-border hover:bg-muted/50 disabled:opacity-30"
                  >Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Catalog ─────────────────────────────────────────────────────────── */}
      <div className="bg-muted/30 border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <LayoutGrid size={14} className="text-foreground/50" />
          <h2 className="text-sm font-semibold">All Mini Apps</h2>
          <span className="text-xs text-foreground/40">Toggle maintenance or disable apps platform-wide</span>
        </div>

        {appsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-foreground/40" />
          </div>
        ) : appsError ? (
          <div className="text-center py-10 text-red-400 text-sm space-y-1">
            <p>Could not load mini apps — backend may need a restart.</p>
            <p className="text-foreground/30 text-xs">{(appsError as Error).message}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-foreground/40 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">App</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 max-w-xs">Note / Message</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(allApps ?? []).map((app) => (
                <tr key={app.appId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={`/miniapp-icons/${app.appId}.png`}
                        alt=""
                        className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div>
                        <p className="font-medium">{app.name}</p>
                        <p className="text-foreground/40 text-xs">{app.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground/50">{app.category}</td>
                  <td className="px-4 py-3">
                    <AppStatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3 text-foreground/50 max-w-xs truncate text-xs">
                    {app.reason ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {app.status === "ACTIVE" && (
                        <>
                          <button
                            onClick={() => { setAppAction({ type: "maintenance", app }); setActionMessage(""); }}
                            className="text-xs text-amber-400 hover:underline"
                          >
                            Maintenance
                          </button>
                          <button
                            onClick={() => { setAppAction({ type: "disable", app }); setActionMessage(""); }}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Disable
                          </button>
                        </>
                      )}
                      {app.status === "MAINTENANCE" && (
                        <>
                          <button
                            onClick={() => { setAppAction({ type: "disable", app }); setActionMessage(""); }}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Disable
                          </button>
                          <button
                            disabled={enableMutation.isPending}
                            onClick={() => enableMutation.mutate(app.appId)}
                            className="text-xs text-emerald-400 hover:underline disabled:opacity-50"
                          >
                            End maintenance
                          </button>
                        </>
                      )}
                      {app.status === "DISABLED" && (
                        <button
                          disabled={enableMutation.isPending}
                          onClick={() => enableMutation.mutate(app.appId)}
                          className="text-xs text-emerald-400 hover:underline disabled:opacity-50"
                        >
                          Re-enable
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Report stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total",     value: stats?.total     ?? "—", icon: Flag,          cls: "text-foreground/60" },
          { label: "Open",      value: stats?.open      ?? "—", icon: Clock,         cls: "text-amber-400" },
          { label: "Resolved",  value: stats?.resolved  ?? "—", icon: CheckCircle2,  cls: "text-emerald-400" },
          { label: "Dismissed", value: stats?.dismissed ?? "—", icon: XCircle,       cls: "text-foreground/30" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="bg-muted/30 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className={cls} />
              <span className="text-xs text-foreground/40 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Reports table ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Flag size={14} className="text-foreground/50" />
        <h2 className="text-sm font-semibold">User Reports</h2>
      </div>

      <div className="flex gap-1 bg-muted/30 border border-border rounded-lg p-1 w-fit">
        {(["ALL", "OPEN", "RESOLVED", "DISMISSED"] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(0); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f ? "bg-muted/50 text-foreground" : "text-foreground/40 hover:text-foreground"
            }`}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="bg-muted/30 border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-foreground/40" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400 text-sm">{(error as Error).message}</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16 text-foreground/30 text-sm">No reports found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-foreground/40 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">App</th>
                <th className="text-left px-4 py-3">Reporter</th>
                <th className="text-left px-4 py-3">Reason</th>
                <th className="text-left px-4 py-3">Details</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-foreground/70">{r.appId}</td>
                  <td className="px-4 py-3 text-foreground/70">
                    {r.reportedByHandle ? `@${r.reportedByHandle}` : r.reportedByUserId.slice(0, 8) + "…"}
                  </td>
                  <td className="px-4 py-3">{REASON_LABELS[r.reason] ?? r.reason}</td>
                  <td className="px-4 py-3 text-foreground/50 max-w-xs truncate">{r.details ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-foreground/40 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    {r.status === "OPEN" && (
                      <button
                        onClick={() => { setResolving(r); setResolution(""); setDisableWithReport(false); }}
                        className="text-xs text-[#B7EE7A] hover:underline"
                      >
                        Review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-foreground/40">
            <span>Page {page + 1} of {data.totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded border border-border hover:bg-muted/50 disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={page + 1 >= data.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded border border-border hover:bg-muted/50 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── App action modal (maintenance / disable) ─────────────────────── */}
      {appAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                {appAction.type === "maintenance" ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Wrench size={16} className="text-amber-400" />
                      <h2 className="text-lg font-semibold">Set Maintenance Mode</h2>
                    </div>
                    <p className="text-foreground/40 text-sm">{appAction.app.name}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <Ban size={16} className="text-red-400" />
                      <h2 className="text-lg font-semibold">Disable App</h2>
                    </div>
                    <p className="text-foreground/40 text-sm">{appAction.app.name}</p>
                  </>
                )}
              </div>
              <button
                onClick={() => setAppAction(null)}
                className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {appAction.type === "maintenance" ? (
              <>
                <p className="text-sm text-foreground/50 mb-4">
                  The app will appear greyed-out in the hub with a maintenance notice. All users will
                  receive a push notification with your message.
                </p>
                <label className="block text-xs text-foreground/40 uppercase tracking-wider mb-1.5">
                  User-facing message (optional)
                </label>
                <textarea
                  className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-foreground/20 mb-4"
                  rows={3}
                  placeholder="e.g. We're upgrading CediRates — it'll be back in ~30 minutes."
                  value={actionMessage}
                  onChange={(e) => setActionMessage(e.target.value)}
                />
                {maintenanceMutation.error && (
                  <p className="text-red-400 text-sm mb-3">{(maintenanceMutation.error as Error).message}</p>
                )}
                <button
                  disabled={maintenanceMutation.isPending}
                  onClick={() => maintenanceMutation.mutate({ appId: appAction.app.appId, message: actionMessage })}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {maintenanceMutation.isPending
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Wrench size={16} />}
                  Set maintenance &amp; notify users
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-foreground/50 mb-4">
                  The app will be hidden from the hub for all users immediately. Re-enabling requires a
                  second admin to approve.
                </p>
                <label className="block text-xs text-foreground/40 uppercase tracking-wider mb-1.5">
                  Internal reason (optional)
                </label>
                <textarea
                  className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-foreground/20 mb-4"
                  rows={3}
                  placeholder="e.g. Violates TOS section 4.2"
                  value={actionMessage}
                  onChange={(e) => setActionMessage(e.target.value)}
                />
                {disableAppMutation.error && (
                  <p className="text-red-400 text-sm mb-3">{(disableAppMutation.error as Error).message}</p>
                )}
                <button
                  disabled={disableAppMutation.isPending}
                  onClick={() => disableAppMutation.mutate({ appId: appAction.app.appId, reason: actionMessage })}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {disableAppMutation.isPending
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Ban size={16} />}
                  Disable platform-wide
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Report review modal ──────────────────────────────────────────────── */}
      {resolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Review Report</h2>
                <p className="text-foreground/40 text-sm mt-0.5">
                  {REASON_LABELS[resolving.reason]} · {resolving.appId}
                </p>
              </div>
              <button
                onClick={() => setResolving(null)}
                className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {resolving.details && (
              <div className="bg-muted/30 rounded-lg px-4 py-3 mb-4 text-sm text-foreground/60">
                {resolving.details}
              </div>
            )}

            <label className="block text-xs text-foreground/40 uppercase tracking-wider mb-1.5">
              Resolution note
            </label>
            <textarea
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-foreground/20 mb-4"
              rows={3}
              placeholder="Describe the action taken…"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />

            <label className="flex items-center gap-2 mb-4 text-sm text-foreground/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={disableWithReport}
                onChange={(e) => setDisableWithReport(e.target.checked)}
                className="accent-red-500"
              />
              Also disable <span className="font-mono">{resolving.appId}</span> platform-wide
            </label>

            {resolveMutation.error && (
              <p className="text-red-400 text-sm mb-3">{(resolveMutation.error as Error).message}</p>
            )}

            <div className="flex gap-3">
              <button
                disabled={resolveMutation.isPending}
                onClick={() => resolveMutation.mutate({ action: "RESOLVE" })}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {resolveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Resolve
              </button>
              <button
                disabled={resolveMutation.isPending}
                onClick={() => resolveMutation.mutate({ action: "DISMISS" })}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 text-foreground/60 hover:text-foreground text-sm font-medium transition-colors disabled:opacity-50"
              >
                <XCircle size={16} />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Submission reject / suspend modal ──────────────────────────────── */}
      {reviewTarget && reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {reviewAction === "reject" ? (
                    <XCircle size={16} className="text-red-400" />
                  ) : (
                    <Ban size={16} className="text-orange-400" />
                  )}
                  <h2 className="text-lg font-semibold">
                    {reviewAction === "reject" ? "Reject Submission" : "Suspend App"}
                  </h2>
                </div>
                <p className="text-foreground/40 text-sm">{reviewTarget.name}</p>
              </div>
              <button
                onClick={() => { setReviewTarget(null); setReviewReason(""); }}
                className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <label className="block text-xs text-foreground/40 uppercase tracking-wider mb-1.5">
              {reviewAction === "reject" ? "Reason for rejection (shown to developer)" : "Reason for suspension (shown to developer)"}
            </label>
            <textarea
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-foreground/20 mb-4"
              rows={3}
              placeholder={reviewAction === "reject" ? "e.g. App URL returned 404, please resubmit" : "e.g. Reports of misleading content"}
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
            />

            {rejectMutation.error && (
              <p className="text-red-400 text-sm mb-3">{(rejectMutation.error as Error).message}</p>
            )}

            <button
              disabled={!reviewReason.trim() || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({ appId: reviewTarget.id, reason: reviewReason, action: reviewAction! })}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${
                reviewAction === "reject" ? "bg-red-700 hover:bg-red-600" : "bg-orange-700 hover:bg-orange-600"
              }`}
            >
              {rejectMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : reviewAction === "reject" ? (
                <XCircle size={16} />
              ) : (
                <Ban size={16} />
              )}
              {reviewAction === "reject" ? "Reject & notify developer" : "Suspend & notify developer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
