"use client";

import { useEffect, useState } from "react";
import {
  getOAuthClients,
  createOAuthClient,
  rotateOAuthClientSecret,
  deleteOAuthClient,
  linkOAuthClientMerchant,
  unlinkOAuthClientMerchant,
  OAuthClient,
  OAUTH_SCOPES,
} from "@/lib/merchant-api";
import {
  Loader2,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  X,
  AlertTriangle,
  RefreshCw,
  LogIn,
  Link2,
  Unlink,
  ExternalLink,
  Globe,
} from "lucide-react";
import { format, parseISO } from "date-fns";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy"); }
  catch { return iso; }
}

// ─── Copyable value ──────────────────────────────────────────────────────────

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  return (
    <div>
      <p className="text-[10px] text-foreground/30 mb-1 uppercase tracking-wider font-medium">{label}</p>
      <button
        onClick={copy}
        className="w-full flex items-center gap-2 bg-black/30 border border-border rounded-lg px-3 py-2 text-left hover:border-[#B7EE7A]/40 transition-colors group"
      >
        <span className={`flex-1 text-xs text-foreground/80 truncate ${mono ? "font-mono" : ""}`}>{value}</span>
        {copied ? <Check size={13} className="text-[#B7EE7A] flex-shrink-0" /> : <Copy size={13} className="text-foreground/30 group-hover:text-foreground/60 flex-shrink-0" />}
      </button>
    </div>
  );
}

// ─── Secret reveal modal (shown once) ────────────────────────────────────────

function SecretModal({
  clientId,
  clientSecret,
  onClose,
}: {
  clientId: string;
  clientSecret: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-foreground/30 hover:text-foreground hover:bg-muted/40 transition-colors">
          <X size={16} />
        </button>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Save your client secret</p>
            <p className="text-xs text-foreground/40">This is shown once only</p>
          </div>
        </div>
        <div className="space-y-3 mb-4">
          <CopyField label="Client ID" value={clientId} />
          <div>
            <p className="text-[10px] text-foreground/30 mb-1 uppercase tracking-wider font-medium">Client Secret</p>
            <div className="bg-black/40 border border-border rounded-lg p-3">
              <p className="text-xs font-mono text-foreground/80 break-all">{clientSecret}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-foreground/25 text-center mb-4">
          Store the secret somewhere safe. If you lose it you&apos;ll need to rotate it.
        </p>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-foreground font-semibold text-sm transition-colors"
        >
          I&apos;ve saved it
        </button>
      </div>
    </div>
  );
}

// ─── Create app modal ────────────────────────────────────────────────────────

function CreateAppModal({
  onCreate,
  onClose,
}: {
  onCreate: (data: Parameters<typeof createOAuthClient>[0]) => Promise<void>;
  onClose: () => void;
}) {
  const [appName, setAppName] = useState("");
  const [appDescription, setAppDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [redirectUris, setRedirectUris] = useState<string[]>([""]);
  const [scopes, setScopes] = useState<Record<string, boolean>>({ identity: true, email: false, phone: false, "wallet:read": false, payment: false });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setUri(i: number, val: string) {
    setRedirectUris((prev) => prev.map((u, idx) => (idx === i ? val : u)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const uris = redirectUris.map((u) => u.trim()).filter(Boolean);
    const selectedScopes = Object.entries(scopes).filter(([, v]) => v).map(([k]) => k);
    if (uris.length === 0) { setError("Add at least one redirect URI."); return; }
    if (selectedScopes.length === 0) { setError("Select at least one scope."); return; }
    setCreating(true);
    try {
      await onCreate({
        appName: appName.trim(),
        appDescription: appDescription.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        redirectUris: uris,
        scopes: selectedScopes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create app");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-foreground/30 hover:text-foreground hover:bg-muted/40 transition-colors">
          <X size={16} />
        </button>
        <h3 className="text-base font-semibold text-foreground mb-1">Create OAuth app</h3>
        <p className="text-xs text-foreground/35 mb-5">Let your users sign in with their AZA account.</p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-1.5">App name <span className="text-red-400/70">*</span></label>
            <input
              type="text"
              required
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g. Accra Travel"
              className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-1.5">
              Description <span className="text-foreground/25 font-normal">optional</span>
            </label>
            <input
              type="text"
              value={appDescription}
              onChange={(e) => setAppDescription(e.target.value)}
              placeholder="Shown to users on the consent screen"
              className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground/50 mb-1.5">Website <span className="text-foreground/25 font-normal">optional</span></label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://…"
                className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/50 mb-1.5">Logo URL <span className="text-foreground/25 font-normal">optional</span></label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…/logo.png"
                className="w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-1.5">
              Redirect URIs <span className="text-red-400/70">*</span>
              <span className="text-foreground/25 font-normal"> — where users return after login</span>
            </label>
            <div className="space-y-2">
              {redirectUris.map((uri, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={uri}
                    onChange={(e) => setUri(i, e.target.value)}
                    placeholder="https://yourapp.com/auth/callback"
                    className="flex-1 px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm font-mono transition-all"
                  />
                  {redirectUris.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRedirectUris((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-2 rounded-lg text-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRedirectUris((prev) => [...prev, ""])}
              className="mt-2 flex items-center gap-1.5 text-xs text-foreground/40 hover:text-[#B7EE7A] transition-colors"
            >
              <Plus size={12} /> Add another URI
            </button>
            <p className="text-[10px] text-foreground/25 mt-1.5">Must use HTTPS (or http://localhost for development).</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-2">Scopes <span className="text-red-400/70">*</span></label>
            <div className="space-y-1.5">
              {OAUTH_SCOPES.map((scope) => (
                <label key={scope.value} className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-muted/20 transition-colors">
                  <input
                    type="checkbox"
                    checked={scopes[scope.value]}
                    onChange={() => setScopes((prev) => ({ ...prev, [scope.value]: !prev[scope.value] }))}
                    className="w-3.5 h-3.5 accent-[#B7EE7A] mt-0.5"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-foreground/70">{scope.value}</span>
                    <p className="text-[11px] text-foreground/35 leading-tight">{scope.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-foreground font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            {creating ? "Creating…" : "Create app"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── App card ────────────────────────────────────────────────────────────────

function AppCard({
  app,
  onRotate,
  rotating,
  onDelete,
  deleting,
  onToggleMerchant,
  linking,
}: {
  app: OAuthClient;
  onRotate: (clientId: string) => void;
  rotating: boolean;
  onDelete: (clientId: string) => void;
  deleting: boolean;
  onToggleMerchant: (app: OAuthClient) => void;
  linking: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const hasPaymentScope = app.allowedScopes.includes("payment");
  const isLinked = !!app.merchantId;

  return (
    <div className="p-5 rounded-xl border border-border bg-muted/10 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-black/30 border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
          {app.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <LogIn size={16} className="text-foreground/30" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{app.appName}</p>
          {app.appDescription && <p className="text-xs text-foreground/40 truncate">{app.appDescription}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-[11px] text-foreground/30">Created {fmtDate(app.createdAt)}</span>
            {app.websiteUrl && (
              <a href={app.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-foreground/40 hover:text-[#B7EE7A] transition-colors">
                <Globe size={10} /> Website <ExternalLink size={9} />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!confirmRotate ? (
            <button
              onClick={() => setConfirmRotate(true)}
              className="p-1.5 rounded-lg text-foreground/25 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Rotate secret"
            >
              <RefreshCw size={13} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-xs text-foreground/40">Rotate?</span>
              <button onClick={() => { setConfirmRotate(false); onRotate(app.clientId); }} disabled={rotating} className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors">
                {rotating ? <Loader2 size={12} className="animate-spin" /> : "Yes"}
              </button>
              <button onClick={() => setConfirmRotate(false)} className="px-2 py-1 rounded-lg bg-muted/30 text-foreground/40 text-xs font-medium hover:text-foreground transition-colors">No</button>
            </div>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-foreground/40">Delete?</span>
              <button onClick={() => onDelete(app.clientId)} disabled={deleting} className="px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors">
                {deleting ? <Loader2 size={12} className="animate-spin" /> : "Yes"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded-lg bg-muted/30 text-foreground/40 text-xs font-medium hover:text-foreground transition-colors">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg text-foreground/25 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete app">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <CopyField label="Client ID" value={app.clientId} />

      <div>
        <p className="text-[10px] text-foreground/30 mb-1.5 uppercase tracking-wider font-medium">Scopes</p>
        <div className="flex flex-wrap gap-1.5">
          {app.allowedScopes.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded-md bg-[#B7EE7A]/10 border border-[#B7EE7A]/20 text-[11px] font-mono text-[#B7EE7A]/90">{s}</span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] text-foreground/30 mb-1.5 uppercase tracking-wider font-medium">Redirect URIs</p>
        <div className="space-y-1">
          {app.redirectUris.map((u) => (
            <p key={u} className="text-[11px] font-mono text-foreground/50 truncate">{u}</p>
          ))}
        </div>
      </div>

      {hasPaymentScope && (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground/70">Merchant account</p>
            <p className="text-[11px] text-foreground/35 truncate">
              {isLinked
                ? `Linked to ${app.merchantName ?? "your business"} — can charge wallets`
                : "Link your merchant account to enable the payment scope"}
            </p>
          </div>
          <button
            onClick={() => onToggleMerchant(app)}
            disabled={linking}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0 disabled:opacity-50 ${
              isLinked
                ? "bg-muted/20 border-border text-foreground/50 hover:text-red-400 hover:border-red-500/30"
                : "bg-[#B7EE7A]/10 border-[#B7EE7A]/30 text-[#B7EE7A] hover:bg-[#B7EE7A]/20"
            }`}
          >
            {linking ? <Loader2 size={12} className="animate-spin" /> : isLinked ? <Unlink size={12} /> : <Link2 size={12} />}
            {isLinked ? "Unlink" : "Link merchant"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function OAuthAppsPage() {
  const [apps, setApps] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [secretModal, setSecretModal] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [rotating, setRotating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setApps(await getOAuthClients());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load apps");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data: Parameters<typeof createOAuthClient>[0]) {
    const created = await createOAuthClient(data);
    setApps((prev) => [created, ...prev]);
    if (created.clientSecret) {
      setSecretModal({ clientId: created.clientId, clientSecret: created.clientSecret });
    }
  }

  async function handleRotate(clientId: string) {
    setRotating(clientId);
    try {
      const updated = await rotateOAuthClientSecret(clientId);
      if (updated.clientSecret) {
        setSecretModal({ clientId: updated.clientId, clientSecret: updated.clientSecret });
      }
      setApps((prev) => prev.map((a) => (a.clientId === clientId ? { ...a, ...updated, clientSecret: undefined } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate secret");
    } finally {
      setRotating(null);
    }
  }

  async function handleDelete(clientId: string) {
    setDeleting(clientId);
    try {
      await deleteOAuthClient(clientId);
      setApps((prev) => prev.filter((a) => a.clientId !== clientId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete app");
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleMerchant(app: OAuthClient) {
    setLinking(app.clientId);
    try {
      const updated = app.merchantId
        ? await unlinkOAuthClientMerchant(app.clientId)
        : await linkOAuthClientMerchant(app.clientId);
      setApps((prev) => prev.map((a) => (a.clientId === app.clientId ? { ...a, ...updated, clientSecret: undefined } : a)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update merchant link");
    } finally {
      setLinking(null);
    }
  }

  return (
    <>
      {secretModal && (
        <SecretModal
          clientId={secretModal.clientId}
          clientSecret={secretModal.clientSecret}
          onClose={() => setSecretModal(null)}
        />
      )}
      {showCreate && (
        <CreateAppModal onCreate={handleCreate} onClose={() => setShowCreate(false)} />
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Sign in with AZA</h1>
            <p className="text-foreground/40 text-sm mt-0.5">OAuth apps that let users authenticate with their AZA account</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-foreground text-sm font-semibold transition-colors flex-shrink-0"
          >
            <Plus size={14} /> Create app
          </button>
        </div>

        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#B7EE7A]/6 border border-[#B7EE7A]/15">
          <LogIn size={16} className="text-[#B7EE7A] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-foreground/60">
            Add a &ldquo;Sign in with AZA&rdquo; button to your app so customers can log in without a new password.
            Use the <span className="font-mono text-foreground/80">client ID</span> and <span className="font-mono text-foreground/80">secret</span> to run the OAuth 2.0 PKCE flow.
            {" "}Add the <span className="font-mono text-foreground/80">payment</span> scope and link your merchant account to charge wallets directly.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={15} />{error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-foreground/30" size={22} />
          </div>
        ) : apps.length === 0 ? (
          <div className="py-16 text-center border border-border rounded-xl bg-card">
            <LogIn size={28} className="mx-auto mb-3 text-foreground/15" />
            <p className="text-sm text-foreground/40">No OAuth apps yet</p>
            <p className="text-xs text-foreground/25 mt-1 mb-4">Create one to let users sign in with AZA</p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted/30 border border-border text-sm font-medium text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            >
              <Plus size={14} /> Create app
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {apps.map((app) => (
              <AppCard
                key={app.clientId}
                app={app}
                onRotate={handleRotate}
                rotating={rotating === app.clientId}
                onDelete={handleDelete}
                deleting={deleting === app.clientId}
                onToggleMerchant={handleToggleMerchant}
                linking={linking === app.clientId}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
