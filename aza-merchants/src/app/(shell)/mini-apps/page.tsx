"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMyMiniApps,
  saveMiniApp,
  uploadMiniAppBundle,
  MiniApp,
  MiniAppHosting,
  MiniAppStatus,
  MINI_APP_CATEGORIES,
  MINI_APP_PERMISSIONS,
  MINI_APP_MAX_BUNDLE_BYTES,
} from "@/lib/merchant-api";
import {
  Loader2, Plus, AlertCircle, ArrowLeft, Upload, ExternalLink,
  CheckCircle2, Clock, AlertTriangle, Ban, FileArchive, Blocks,
  HardDriveUpload, Server,
} from "lucide-react";

function fmtBytes(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS: Record<MiniAppStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  DRAFT:          { label: "Draft",          cls: "bg-muted/30 border-border text-foreground/50",        Icon: FileArchive },
  PENDING_REVIEW: { label: "In review",      cls: "bg-amber-500/10 border-amber-500/20 text-amber-400",  Icon: Clock },
  ACTIVE:         { label: "Live",           cls: "bg-[#B7EE7A]/10 border-[#B7EE7A]/25 text-[#B7EE7A]",  Icon: CheckCircle2 },
  REJECTED:       { label: "Changes needed", cls: "bg-red-500/10 border-red-500/20 text-red-400",        Icon: AlertTriangle },
  SUSPENDED:      { label: "Suspended",      cls: "bg-red-500/10 border-red-500/20 text-red-400",        Icon: Ban },
};

export default function MiniAppsPage() {
  const [apps, setApps] = useState<MiniApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MiniApp | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setApps(await getMyMiniApps());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your mini apps");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (editing || creating) {
    return (
      <MiniAppEditor
        app={editing}
        existingIds={apps.map((a) => a.id)}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={load}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Mini Apps</h1>
          <p className="text-foreground/40 text-sm mt-0.5">Web apps that run inside AZA, reaching every AZA user</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-foreground text-sm font-semibold transition-colors flex-shrink-0"
        >
          <Plus size={14} /> New app
        </button>
      </div>

      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#B7EE7A]/6 border border-[#B7EE7A]/15">
        <Blocks size={16} className="text-[#B7EE7A] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-foreground/60">
          You don&apos;t need a domain, a server, or an Apple/Google developer account — mini apps run in
          AZA&apos;s WebView and never go through either app store. Upload a static build and AZA hosts it
          at its own origin. Building with Expo? Export to web with{" "}
          <span className="font-mono text-foreground/80">npx expo export --platform web</span> and upload that.
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
          <Blocks size={28} className="mx-auto mb-3 text-foreground/15" />
          <p className="text-sm text-foreground/40">No mini apps yet</p>
          <p className="text-xs text-foreground/25 mt-1 mb-4">Ship the one flow your customers need inside AZA</p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted/30 border border-border text-sm font-medium text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
          >
            <Plus size={14} /> Create your first app
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => {
            const s = STATUS[app.status];
            return (
              <button
                key={app.id}
                onClick={() => setEditing(app)}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-xl bg-card border border-border text-left hover:border-[#B7EE7A]/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground truncate">{app.name}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${s.cls}`}>
                      <s.Icon size={10} /> {s.label}
                    </span>
                    {app.pendingBundleVersion && app.status === "ACTIVE" && (
                      <span className="px-2 py-0.5 rounded-md border border-blue-500/20 bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                        Update in review
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-foreground/30 truncate">
                    {app.id}{app.hostingMode === "AZA_HOSTED" && " · hosted by AZA"}
                  </p>
                </div>
                <span className="text-xs text-foreground/30 flex-shrink-0">Edit</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────────

const input =
  "w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground " +
  "placeholder:text-foreground/25 focus:outline-none focus:border-[#B7EE7A]/40 transition-colors " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-foreground/30 mb-1 uppercase tracking-wider font-medium">{label}</p>
      {hint && <p className="text-[11px] text-foreground/35 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function MiniAppEditor({ app, existingIds, onClose, onSaved }: {
  app: MiniApp | null;
  existingIds: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isNew = app === null;
  const [current, setCurrent] = useState<MiniApp | null>(app);
  const [id, setId] = useState(app?.id ?? "");
  const [name, setName] = useState(app?.name ?? "");
  const [description, setDescription] = useState(app?.description ?? "");
  const [category, setCategory] = useState(app?.category ?? MINI_APP_CATEGORIES[0]);
  const [developerName, setDeveloperName] = useState(app?.developerName ?? "");
  const [supportUrl, setSupportUrl] = useState(app?.supportUrl ?? "");
  const [version, setVersion] = useState(app?.version ?? "1.0.0");
  const [iconUrl, setIconUrl] = useState(app?.iconUrl ?? "");
  const [hosting, setHosting] = useState<MiniAppHosting>(app?.hostingMode ?? "AZA_HOSTED");
  const [url, setUrl] = useState(app?.hostingMode === "EXTERNAL" ? (app?.url ?? "") : "");
  const [perms, setPerms] = useState<string[]>(app?.requestedPermissions ?? ["USER_PROFILE"]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const locked = current?.status === "PENDING_REVIEW";
  const hasBundle = Boolean(current?.pendingBundleVersion || current?.bundleVersion);

  // 50 rather than 100 when AZA hosts: the id becomes a DNS label with "-mini-preview"
  // appended, and the whole thing has to fit inside 63 characters.
  const idError =
    isNew && id !== "" && !/^[a-z0-9_]{3,100}$/.test(id)
      ? "Use 3–100 characters: lowercase letters, digits and underscores."
      : isNew && hosting === "AZA_HOSTED" && id.length > 50
        ? "Use at most 50 characters when AZA hosts your app — the id becomes part of your hostname."
        : isNew && existingIds.includes(id)
          ? "You already have an app with this id."
          : null;

  async function save(submitForReview: boolean) {
    setError(null);
    setNotice(null);
    if (idError) { setError(idError); return; }
    if (hosting === "EXTERNAL" && !/^https:\/\/.+/.test(url)) {
      setError("Enter the HTTPS URL where your app is hosted.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveMiniApp({
        id, name, description, category,
        iconUrl: iconUrl || undefined,
        hostingMode: hosting,
        url: hosting === "EXTERNAL" ? url : undefined,
        developerName,
        supportUrl: supportUrl || undefined,
        version,
        requestedPermissions: perms,
        submitForReview,
      });
      setCurrent(saved);
      setNotice(submitForReview ? "Submitted for review." : "Saved.");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your app");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-foreground transition-colors"
      >
        <ArrowLeft size={13} /> All mini apps
      </button>

      <div>
        <h1 className="text-xl font-bold text-foreground">{isNew ? "New mini app" : current?.name}</h1>
        {!isNew && <p className="font-mono text-[11px] text-foreground/30 mt-0.5">{current?.id}</p>}
      </div>

      {current?.status === "REJECTED" && current.rejectionReason && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          <div><strong>Changes needed.</strong> <span className="text-red-400/80">{current.rejectionReason}</span></div>
        </div>
      )}
      {locked && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <Clock size={15} className="mt-0.5 flex-shrink-0" />
          <div><strong>In review.</strong> <span className="text-amber-400/80">Locked until our team responds — usually 2–5 business days.</span></div>
        </div>
      )}

      <div className="space-y-5 p-5 rounded-xl bg-card border border-border">
        <Field label="App name" hint="Shown to users in the AZA Hub">
          <input className={input} value={name} disabled={locked} maxLength={80}
                 onChange={(e) => setName(e.target.value)} placeholder="Bolt Ghana" />
        </Field>

        <Field label="App ID" hint={isNew ? "Permanent. Becomes your hostname if AZA hosts the app." : "Cannot be changed"}>
          <input className={`${input} font-mono ${idError ? "border-red-500/40" : ""}`}
                 value={id} disabled={!isNew}
                 onChange={(e) => setId(e.target.value.toLowerCase())} placeholder="bolt_ghana" />
          {idError && <p className="mt-1.5 text-[11px] text-red-400">{idError}</p>}
          {isNew && id && !idError && hosting === "AZA_HOSTED" && (
            <p className="mt-1.5 font-mono text-[11px] text-foreground/40">
              https://{id.replace(/_/g, "-")}-mini.aza.systems
            </p>
          )}
        </Field>

        <Field label="Description" hint="Max 500 characters">
          <textarea className={`${input} min-h-[72px] resize-y`} value={description} disabled={locked}
                    maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Category">
            <select className={input} value={category} disabled={locked}
                    onChange={(e) => setCategory(e.target.value)}>
              {MINI_APP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Version">
            <input className={input} value={version} disabled={locked} maxLength={20}
                   onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Developer name" hint="Shown on the consent sheet">
            <input className={input} value={developerName} disabled={locked} maxLength={100}
                   onChange={(e) => setDeveloperName(e.target.value)} />
          </Field>
          <Field label="Support URL" hint="Optional">
            <input className={input} value={supportUrl} disabled={locked}
                   onChange={(e) => setSupportUrl(e.target.value)} placeholder="https://…" />
          </Field>
        </div>

        <Field label="Icon URL" hint="Optional — an HTTPS image URL">
          <input className={input} value={iconUrl} disabled={locked}
                 onChange={(e) => setIconUrl(e.target.value)} placeholder="https://…" />
        </Field>
      </div>

      {/* ── Hosting ── */}
      <div className="p-5 rounded-xl bg-card border border-border space-y-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">Hosting</h2>
          <p className="text-xs text-foreground/40 mt-0.5">No domain, server, or app store developer account required.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {([
            { mode: "AZA_HOSTED" as const, Icon: HardDriveUpload, title: "AZA hosts it",
              body: "Upload your build output. Served from its own origin on our infrastructure." },
            { mode: "EXTERNAL" as const, Icon: Server, title: "I'll host it",
              body: "You already have infrastructure and want to deploy it yourself." },
          ]).map(({ mode, Icon, title, body }) => (
            <button
              key={mode} type="button" disabled={locked} onClick={() => setHosting(mode)}
              className={`text-left px-4 py-3 rounded-xl border transition-colors disabled:opacity-50 ${
                hosting === mode
                  ? "border-[#B7EE7A]/40 bg-[#B7EE7A]/6"
                  : "border-border bg-black/20 hover:border-[#B7EE7A]/20"
              }`}
            >
              <Icon size={16} className={hosting === mode ? "text-[#B7EE7A]" : "text-foreground/30"} />
              <span className="block mt-2 text-sm font-bold text-foreground">{title}</span>
              <span className="block mt-0.5 text-[11px] leading-snug text-foreground/40">{body}</span>
            </button>
          ))}
        </div>

        {hosting === "EXTERNAL" && (
          <Field label="App URL" hint="Must be HTTPS and publicly reachable">
            <input className={input} value={url} disabled={locked}
                   onChange={(e) => setUrl(e.target.value)} placeholder="https://myapp.example.com" />
          </Field>
        )}

        {hosting === "AZA_HOSTED" && (
          isNew ? (
            <p className="text-xs text-foreground/40 px-4 py-3 rounded-lg bg-black/20 border border-border">
              Save the app first to reserve{" "}
              <span className="font-mono text-foreground/70">{id || "your-app-id"}</span>, then upload your bundle here.
            </p>
          ) : current && (
            <BundleUpload app={current} onUploaded={async (u) => { setCurrent(u); await onSaved(); }} />
          )
        )}
      </div>

      {/* ── Permissions ── */}
      <div className="p-5 rounded-xl bg-card border border-border space-y-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Permissions</h2>
          <p className="text-xs text-foreground/40 mt-0.5">
            Request only what you use. Every extra permission is one more thing a reviewer has to
            justify, and one more reason a user declines.
          </p>
        </div>
        {MINI_APP_PERMISSIONS.map((p) => (
          <label key={p.id}
                 className={`flex items-start gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                   perms.includes(p.id) ? "border-[#B7EE7A]/30 bg-[#B7EE7A]/6" : "border-border bg-black/20"
                 } ${locked ? "opacity-50 cursor-not-allowed" : "hover:border-[#B7EE7A]/25"}`}>
            <input type="checkbox" className="mt-0.5 accent-[#B7EE7A]" disabled={locked}
                   checked={perms.includes(p.id)}
                   onChange={(e) => setPerms((v) => e.target.checked ? [...v, p.id] : v.filter((x) => x !== p.id))} />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-foreground">{p.label}</span>
              <span className="block text-[11px] text-foreground/40">{p.help}</span>
            </span>
          </label>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} />{error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#B7EE7A]/10 border border-[#B7EE7A]/20 text-[#B7EE7A] text-sm">
          <CheckCircle2 size={15} />{notice}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(false)} disabled={saving || locked}
          className="px-4 py-2 rounded-xl bg-muted/30 border border-border text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button
          onClick={() => save(true)}
          disabled={saving || locked || (hosting === "AZA_HOSTED" && !hasBundle)}
          className="px-4 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-foreground transition-colors disabled:opacity-50"
        >
          Submit for review
        </button>
        {hosting === "AZA_HOSTED" && !hasBundle && !isNew && (
          <span className="text-xs text-foreground/35">Upload a bundle before submitting.</span>
        )}
      </div>
    </div>
  );
}

// ─── Bundle upload ───────────────────────────────────────────────────────────

function BundleUpload({ app, onUploaded }: {
  app: MiniApp;
  onUploaded: (updated: MiniApp) => Promise<void>;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Upload a .zip of your build output.");
      return;
    }
    if (file.size > MINI_APP_MAX_BUNDLE_BYTES) {
      setError(`That zip is ${fmtBytes(file.size)}. The limit is ${fmtBytes(MINI_APP_MAX_BUNDLE_BYTES)}.`);
      return;
    }
    setProgress(0);
    try {
      const updated = await uploadMiniAppBundle(app.id, file, setProgress);
      await onUploaded(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground/40">
        Zip the <em>contents</em> of your build output — <span className="font-mono text-foreground/70">dist/</span> for
        Vite, or the output of <span className="font-mono text-foreground/70">npx expo export --platform web</span>.
        Uploading never disturbs your live version; it stages the build for review.
      </p>

      {app.bundleVersion && (
        <p className="text-xs text-foreground/50">
          <span className="text-foreground/70 font-semibold">Live:</span>{" "}
          <span className="font-mono text-foreground/40">{app.bundleVersion}</span>
          {app.url && (
            <>
              {" · "}
              <a href={app.url} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1 text-[#B7EE7A] hover:underline">
                open <ExternalLink size={10} />
              </a>
            </>
          )}
        </p>
      )}

      {app.pendingBundleVersion && (
        <div className="px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-xs text-blue-300">
            <strong>Staged for review:</strong>{" "}
            <span className="font-mono">{app.pendingBundleVersion}</span> · {fmtBytes(app.bundleSizeBytes)}
          </p>
          {app.previewUrl && (
            <a href={app.previewUrl} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-blue-400 hover:underline">
              Preview it <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) upload(f);
        }}
        className={`rounded-xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
          dragging ? "border-[#B7EE7A]/50 bg-[#B7EE7A]/6" : "border-border bg-black/20"
        }`}
      >
        {busy ? (
          <>
            <Loader2 size={20} className="mx-auto animate-spin text-[#B7EE7A]" />
            <p className="mt-3 text-sm font-semibold text-foreground">Uploading… {progress}%</p>
            <div className="mx-auto mt-3 h-1.5 w-52 rounded-full bg-muted/40 overflow-hidden">
              <div className="h-full rounded-full bg-[#B7EE7A] transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <>
            <Upload size={20} className="mx-auto text-foreground/25" />
            <p className="mt-3 text-xs text-foreground/50">
              Drop <span className="font-mono text-foreground/70">bundle.zip</span> here, or{" "}
              <button onClick={() => fileRef.current?.click()} className="text-[#B7EE7A] font-semibold hover:underline">
                choose a file
              </button>
            </p>
            <p className="mt-1 text-[10px] text-foreground/25">
              Max {fmtBytes(MINI_APP_MAX_BUNDLE_BYTES)} zipped · 50 MB unpacked · 2000 files
            </p>
          </>
        )}
        <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden"
               onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
        </div>
      )}
    </div>
  );
}
