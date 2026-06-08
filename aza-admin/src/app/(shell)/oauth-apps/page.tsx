"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminOAuthStats,
  getAdminOAuthClients,
  adminSuspendOAuthClient,
  adminRestoreOAuthClient,
  adminDeleteOAuthClient,
  AdminOAuthStats,
  AdminOAuthClient,
  Page,
} from "@/lib/admin-api";
import {
  KeyRound,
  Search,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  ShieldOff,
  Trash2,
  ExternalLink,
  Users,
  Activity,
} from "lucide-react";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function AppAvatar({ app }: { app: AdminOAuthClient }) {
  if (app.logoUrl) {
    return (
      <img
        src={app.logoUrl}
        alt={app.appName}
        className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0"
      />
    );
  }
  const initials = app.appName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-lg bg-muted/40 border border-border flex items-center justify-center flex-shrink-0 text-xs font-bold text-foreground/60">
      {initials}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="px-2 py-0.5 rounded text-xs font-semibold border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
      Active
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded text-xs font-semibold border text-red-400 bg-red-500/10 border-red-500/20">
      Suspended
    </span>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border border-border bg-muted/30 text-foreground/60">
      {scope}
    </span>
  );
}

type ActiveFilter = "all" | "active" | "suspended";

export default function OAuthAppsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<ActiveFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminOAuthClient | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // debounce search
  const handleSearchChange = (v: string) => {
    setSearch(v);
    clearTimeout((window as any).__oauthSearchTimer);
    (window as any).__oauthSearchTimer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(0);
    }, 300);
  };

  const activeParam = filter === "all" ? undefined : filter === "active" ? true : false;

  const { data: stats } = useQuery<AdminOAuthStats>({
    queryKey: ["adminOAuthStats"],
    queryFn: getAdminOAuthStats,
  });

  const { data, isLoading, error } = useQuery<Page<AdminOAuthClient>>({
    queryKey: ["adminOAuthClients", { filter, page, search: debouncedSearch }],
    queryFn: () => getAdminOAuthClients(page, 20, debouncedSearch || undefined, activeParam),
  });

  const suspendMutation = useMutation({
    mutationFn: (clientId: string) => adminSuspendOAuthClient(clientId),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["adminOAuthClients"] });
      qc.invalidateQueries({ queryKey: ["adminOAuthStats"] });
      setSelected(updated);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (clientId: string) => adminRestoreOAuthClient(clientId),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["adminOAuthClients"] });
      qc.invalidateQueries({ queryKey: ["adminOAuthStats"] });
      setSelected(updated);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (clientId: string) => adminDeleteOAuthClient(clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminOAuthClients"] });
      qc.invalidateQueries({ queryKey: ["adminOAuthStats"] });
      setSelected(null);
      setConfirmDelete(false);
    },
  });

  const clients = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">OAuth Apps</h1>
        <p className="text-sm text-foreground/50 mt-0.5">
          Third-party apps registered to use Sign in with AZA
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Apps", value: stats?.totalClients ?? "—", icon: KeyRound, color: "text-blue-400" },
          { label: "Active", value: stats?.activeClients ?? "—", icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Suspended", value: stats?.suspendedClients ?? "—", icon: ShieldOff, color: "text-red-400" },
          { label: "Active Tokens", value: stats?.activeTokens ?? "—", icon: Activity, color: "text-purple-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted/40 ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-xs text-foreground/50">{label}</p>
              <p className="text-xl font-bold text-foreground">{value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or client ID…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex gap-1 bg-muted/30 border border-border rounded-lg p-1">
          {(["all", "active", "suspended"] as ActiveFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-foreground/40">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 gap-2 text-red-400">
            <AlertCircle size={20} />
            <span className="text-sm">Failed to load apps</span>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-foreground/40">
            <KeyRound size={32} />
            <p className="text-sm">No OAuth apps found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50">App</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50">Scopes</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50">Tokens</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-foreground/50">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((app) => (
                <tr
                  key={app.clientId}
                  onClick={() => { setSelected(app); setConfirmDelete(false); }}
                  className="hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AppAvatar app={app} />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{app.appName}</p>
                        <p className="text-xs text-foreground/40 truncate font-mono">{app.clientId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground/80">@{app.ownerHandle}</p>
                    <p className="text-xs text-foreground/40">{app.ownerEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {app.allowedScopes.map((s) => <ScopeBadge key={s} scope={s} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-foreground/70">
                      <Users size={13} />
                      {app.activeTokenCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge active={app.active} />
                  </td>
                  <td className="px-4 py-3 text-foreground/50">{fmtDate(app.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-foreground/50">
            Page {page + 1} of {totalPages} · {data?.totalElements ?? 0} total
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="w-full max-w-md bg-background border-l border-border overflow-y-auto flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div className="flex items-center gap-3">
                <AppAvatar app={selected} />
                <div>
                  <h2 className="font-semibold text-foreground">{selected.appName}</h2>
                  <StatusBadge active={selected.active} />
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-foreground/40 hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 px-6 py-5 space-y-5">
              {/* Info rows */}
              <Section label="Client ID">
                <code className="text-xs bg-muted/40 px-2 py-1 rounded font-mono break-all">
                  {selected.clientId}
                </code>
              </Section>

              {selected.appDescription && (
                <Section label="Description">
                  <p className="text-sm text-foreground/70">{selected.appDescription}</p>
                </Section>
              )}

              {selected.websiteUrl && (
                <Section label="Website">
                  <a
                    href={selected.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary flex items-center gap-1 hover:underline"
                  >
                    {selected.websiteUrl}
                    <ExternalLink size={12} />
                  </a>
                </Section>
              )}

              <Section label="Owner">
                <p className="text-sm text-foreground/80">@{selected.ownerHandle}</p>
                <p className="text-xs text-foreground/50">{selected.ownerEmail}</p>
              </Section>

              <Section label="Requested Scopes">
                <div className="flex flex-wrap gap-1.5">
                  {selected.allowedScopes.map((s) => <ScopeBadge key={s} scope={s} />)}
                </div>
              </Section>

              <Section label="Active Sessions">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-foreground/50" />
                  <span className="text-sm font-semibold text-foreground">{selected.activeTokenCount}</span>
                  <span className="text-xs text-foreground/50">users currently connected</span>
                </div>
              </Section>

              <Section label="Registered">
                <p className="text-sm text-foreground/70">{fmtDate(selected.createdAt)}</p>
              </Section>

              {/* Actions */}
              <div className="pt-2 space-y-2">
                {selected.active ? (
                  <button
                    onClick={() => suspendMutation.mutate(selected.clientId)}
                    disabled={suspendMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-amber-500/40 text-amber-400 bg-amber-500/10 text-sm font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    {suspendMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShieldOff size={15} />}
                    Suspend App
                  </button>
                ) : (
                  <button
                    onClick={() => restoreMutation.mutate(selected.clientId)}
                    disabled={restoreMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {restoreMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    Restore App
                  </button>
                )}

                {confirmDelete ? (
                  <div className="border border-red-500/30 rounded-lg p-4 bg-red-500/5 space-y-3">
                    <p className="text-sm text-red-400 font-medium">
                      This will permanently delete the app and revoke all {selected.activeTokenCount} active sessions. This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-2 rounded-lg border border-border text-xs text-foreground/60 hover:bg-muted/40"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(selected.clientId)}
                        disabled={deleteMutation.isPending}
                        className="flex-1 py-2 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {deleteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
                        Yes, delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-500/40 text-red-400 bg-red-500/10 text-sm font-medium hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={15} />
                    Delete App
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground/40 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}
