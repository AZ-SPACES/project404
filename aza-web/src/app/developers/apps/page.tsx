'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, Plus, ArrowLeft, CheckCircle2, AlertTriangle, Clock,
  Ban, FileArchive, ExternalLink, Loader2, Server, HardDriveUpload,
} from 'lucide-react';
import { DevNav } from '../_ui/DevNav';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string };
}

interface MiniApp {
  id: string;
  name: string;
  description?: string;
  category?: string;
  iconUrl?: string;
  url?: string;
  developerName?: string;
  supportUrl?: string;
  version?: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
  requestedPermissions?: string[];
  rejectionReason?: string;
  hostingMode?: 'EXTERNAL' | 'AZA_HOSTED';
  bundleVersion?: string;
  pendingBundleVersion?: string;
  bundleSizeBytes?: number;
  bundleUploadedAt?: string;
  previewUrl?: string;
}

const CATEGORIES = [
  'Finance', 'Bills & Utilities', 'Entertainment', 'Shopping',
  'Transport', 'Business', 'Productivity', 'Games',
];

const PERMISSIONS: { id: string; label: string; help: string }[] = [
  { id: 'USER_PROFILE',      label: 'Profile',            help: 'First name, username and avatar' },
  { id: 'USER_PHONE',        label: 'Phone number',       help: 'Only if you need to contact the user' },
  { id: 'USER_EMAIL',        label: 'Email address',      help: 'Only if you need to contact the user' },
  { id: 'MAKE_PAYMENTS',     label: 'Take payments',      help: 'Charge the user with their confirmation' },
  { id: 'READ_BALANCE',      label: 'Read wallet balance', help: 'Show what the user can afford' },
  { id: 'READ_TRANSACTIONS', label: 'Read transactions',  help: 'Recent history — rarely approved' },
  { id: 'DIRECT_DEBIT',      label: 'Standing mandate',   help: 'Recurring charges the user pre-approves' },
];

const STATUS_STYLE: Record<MiniApp['status'], { label: string; bg: string; fg: string; ring: string; Icon: typeof Clock }> = {
  DRAFT:          { label: 'Draft',           bg: '#f3f4f6', fg: '#4b5563', ring: '#e5e7eb', Icon: FileArchive },
  PENDING_REVIEW: { label: 'In review',       bg: '#fff2df', fg: '#b45309', ring: '#fbdca0', Icon: Clock },
  ACTIVE:         { label: 'Live',            bg: '#eaf7e0', fg: '#1e6b23', ring: '#cdeab3', Icon: CheckCircle2 },
  REJECTED:       { label: 'Changes needed',  bg: '#fdeaea', fg: '#c62828', ring: '#f6c9c9', Icon: AlertTriangle },
  SUSPENDED:      { label: 'Suspended',       bg: '#fdeaea', fg: '#c62828', ring: '#f6c9c9', Icon: Ban },
};

const MAX_BUNDLE_BYTES = 25 * 1024 * 1024; // matches spring.servlet.multipart.max-file-size

function formatBytes(bytes?: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DeveloperAppsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [apps, setApps] = useState<MiniApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MiniApp | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('aza_dev_token');
    if (!stored) {
      router.replace('/developers/login');
      return;
    }
    setToken(stored); // eslint-disable-line react-hooks/set-state-in-effect
  }, [router]);

  // No setLoading(true) here: `loading` already starts true for the initial fetch, and the
  // refreshes triggered after a save happen behind the editor where no spinner is shown.
  // Setting it synchronously would also make this a cascading render inside the effect below.
  const load = useCallback(async (jwt: string) => {
    try {
      const res = await fetch(`${API}/api/v1/dev/miniapps`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.status === 401) {
        sessionStorage.removeItem('aza_dev_token');
        router.replace('/developers/login');
        return;
      }
      const body: ApiResponse<MiniApp[]> = await res.json();
      setApps(body.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  if (!token) return null;

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#111827] antialiased">
      <DevNav />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-24 pt-12 sm:px-6">
        {editing || creating ? (
          <AppEditor
            token={token}
            app={editing}
            existingIds={apps.map(a => a.id)}
            onClose={() => { setEditing(null); setCreating(false); }}
            onSaved={async () => { await load(token); }}
          />
        ) : (
          <AppList
            apps={apps}
            loading={loading}
            onNew={() => setCreating(true)}
            onEdit={setEditing}
          />
        )}
      </main>
    </div>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────

function AppList({ apps, loading, onNew, onEdit }: {
  apps: MiniApp[];
  loading: boolean;
  onNew: () => void;
  onEdit: (a: MiniApp) => void;
}) {
  return (
    <>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ letterSpacing: '-0.03em' }}>
            Your mini apps
          </h1>
          <p className="mt-2 max-w-lg text-base text-[#6b7280]">
            Build a web app, upload it, and reach every Aza user. No app store, no developer
            account, no server of your own required.
          </p>
        </div>
        <button
          onClick={onNew}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#0e2a0e] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#174717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] focus-visible:ring-offset-2"
        >
          <Plus size={16} /> New app
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-[#6b7280]">
          <Loader2 size={16} className="animate-spin" /> Loading your apps…
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e5e7eb] px-6 py-16 text-center">
          <FileArchive size={28} className="mx-auto text-[#9ca3af]" />
          <h2 className="mt-4 text-lg font-bold">No apps yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[#6b7280]">
            Already have a React Native or Expo app? You don&apos;t port it — read{' '}
            <Link href="/developers/guides?doc=miniapps-existing-app" className="font-semibold text-[#174717] underline">
              Already have a mobile app?
            </Link>{' '}
            first.
          </p>
          <button
            onClick={onNew}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0e2a0e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#174717]"
          >
            <Plus size={16} /> Create your first app
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {apps.map(app => {
            const s = STATUS_STYLE[app.status];
            return (
              <li key={app.id}>
                <button
                  onClick={() => onEdit(app)}
                  className="flex w-full items-center gap-4 rounded-xl border border-[#e5e7eb] px-5 py-4 text-left transition-colors hover:border-[#cdeab3] hover:bg-[#fafdf7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="truncate text-[0.95rem] font-bold">{app.name}</span>
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[0.7rem] font-bold ring-1 ring-inset"
                        style={{ background: s.bg, color: s.fg, ['--tw-ring-color' as string]: s.ring }}
                      >
                        <s.Icon size={11} /> {s.label}
                      </span>
                      {app.pendingBundleVersion && app.status === 'ACTIVE' && (
                        <span className="shrink-0 rounded bg-[#e8f0fe] px-2 py-0.5 text-[0.7rem] font-bold text-[#1a56db] ring-1 ring-inset ring-[#c7dbfb]">
                          Update in review
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-mono text-[0.75rem] text-[#9ca3af]">
                      {app.id}
                      {app.hostingMode === 'AZA_HOSTED' && ' · hosted by Aza'}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-[#9ca3af]">Edit</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────

function AppEditor({ token, app, existingIds, onClose, onSaved }: {
  token: string;
  app: MiniApp | null;
  existingIds: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isNew = app === null;
  const [id, setId] = useState(app?.id ?? '');
  const [name, setName] = useState(app?.name ?? '');
  const [description, setDescription] = useState(app?.description ?? '');
  const [category, setCategory] = useState(app?.category ?? CATEGORIES[0]);
  const [developerName, setDeveloperName] = useState(app?.developerName ?? '');
  const [supportUrl, setSupportUrl] = useState(app?.supportUrl ?? '');
  const [version, setVersion] = useState(app?.version ?? '1.0.0');
  const [iconUrl, setIconUrl] = useState(app?.iconUrl ?? '');
  const [hosting, setHosting] = useState<'AZA_HOSTED' | 'EXTERNAL'>(app?.hostingMode ?? 'AZA_HOSTED');
  const [url, setUrl] = useState(app?.hostingMode === 'EXTERNAL' ? (app?.url ?? '') : '');
  const [perms, setPerms] = useState<string[]>(app?.requestedPermissions ?? ['USER_PROFILE']);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [current, setCurrent] = useState<MiniApp | null>(app);

  const locked = current?.status === 'PENDING_REVIEW';

  // The id becomes a DNS label when Aza hosts the app, so it is fixed at creation:
  // changing it later would move the origin and orphan everything in the old one's storage.
  const idError = isNew && id !== '' && !/^[a-z0-9_]{3,100}$/.test(id)
    ? 'Use 3–100 characters: lowercase letters, digits and underscores.'
    : isNew && existingIds.includes(id)
      ? 'You already have an app with this id.'
      : null;

  async function save(submitForReview: boolean) {
    setError(null);
    setNotice(null);
    if (idError) { setError(idError); return; }
    if (hosting === 'EXTERNAL' && !/^https:\/\/.+/.test(url)) {
      setError('Enter the HTTPS URL where your app is hosted.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/dev/miniapps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id, name, description, category, iconUrl: iconUrl || undefined,
          hostingMode: hosting,
          url: hosting === 'EXTERNAL' ? url : undefined,
          developerName, supportUrl: supportUrl || undefined, version,
          requestedPermissions: perms,
          submitForReview,
        }),
      });
      const body: ApiResponse<MiniApp> = await res.json();
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? body.message ?? 'Could not save your app.');
        return;
      }
      setCurrent(body.data ?? null);
      setNotice(submitForReview ? 'Submitted for review.' : 'Saved.');
      await onSaved();
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={onClose}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#6b7280] hover:text-[#111827]"
      >
        <ArrowLeft size={15} /> All apps
      </button>

      <h1 className="text-2xl font-black tracking-tight sm:text-3xl" style={{ letterSpacing: '-0.03em' }}>
        {isNew ? 'New mini app' : current?.name}
      </h1>

      {current?.status === 'REJECTED' && current.rejectionReason && (
        <Callout tone="error" title="Changes needed">{current.rejectionReason}</Callout>
      )}
      {locked && (
        <Callout tone="info" title="In review">
          Your app is locked while our team reviews it — usually 2–5 business days. You&apos;ll get
          a notification in the Aza app when it&apos;s done.
        </Callout>
      )}

      <div className="mt-8 flex flex-col gap-6">
        <Field label="App name" hint="Shown to users in the Hub">
          <input className={inputCls} value={name} disabled={locked}
                 onChange={e => setName(e.target.value)} maxLength={80} placeholder="Bolt Ghana" />
        </Field>

        <Field label="App ID" hint={isNew ? 'Permanent. Becomes your subdomain if Aza hosts the app.' : 'Cannot be changed'}>
          <input
            className={`${inputCls} font-mono ${idError ? 'border-[#c62828]' : ''}`}
            value={id} disabled={!isNew}
            onChange={e => setId(e.target.value.toLowerCase())}
            placeholder="bolt_ghana"
          />
          {idError && <p className="mt-1.5 text-[0.8rem] text-[#c62828]">{idError}</p>}
          {isNew && id && !idError && hosting === 'AZA_HOSTED' && (
            <p className="mt-1.5 font-mono text-[0.75rem] text-[#6b7280]">
              https://{id.replace(/_/g, '-')}.miniapps.aza.systems
            </p>
          )}
        </Field>

        <Field label="Description" hint="What your app does — max 500 characters">
          <textarea className={`${inputCls} min-h-[80px] resize-y`} value={description} disabled={locked}
                    onChange={e => setDescription(e.target.value)} maxLength={500} />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Category">
            <select className={inputCls} value={category} disabled={locked}
                    onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Version">
            <input className={inputCls} value={version} disabled={locked}
                   onChange={e => setVersion(e.target.value)} maxLength={20} placeholder="1.0.0" />
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Developer name" hint="Shown on the consent sheet">
            <input className={inputCls} value={developerName} disabled={locked}
                   onChange={e => setDeveloperName(e.target.value)} maxLength={100} />
          </Field>
          <Field label="Support URL" hint="Optional — where users get help">
            <input className={inputCls} value={supportUrl} disabled={locked}
                   onChange={e => setSupportUrl(e.target.value)} placeholder="https://…" />
          </Field>
        </div>

        <Field label="Icon URL" hint="Optional — an HTTPS image URL">
          <input className={inputCls} value={iconUrl} disabled={locked}
                 onChange={e => setIconUrl(e.target.value)} placeholder="https://…" />
        </Field>

        {/* ── Hosting ── */}
        <div>
          <h2 className="text-sm font-bold">Hosting</h2>
          <p className="mt-1 text-[0.8rem] text-[#6b7280]">
            You don&apos;t need a domain, a server, or an Apple/Google developer account.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <HostingChoice
              selected={hosting === 'AZA_HOSTED'} disabled={locked}
              onSelect={() => setHosting('AZA_HOSTED')}
              Icon={HardDriveUpload} title="Aza hosts it"
              body="Upload your build output. Served from your own origin on our infrastructure."
            />
            <HostingChoice
              selected={hosting === 'EXTERNAL'} disabled={locked}
              onSelect={() => setHosting('EXTERNAL')}
              Icon={Server} title="I'll host it"
              body="You already have infrastructure and want to deploy it yourself."
            />
          </div>

          {hosting === 'EXTERNAL' && (
            <div className="mt-4">
              <Field label="App URL" hint="Must be HTTPS and publicly reachable">
                <input className={inputCls} value={url} disabled={locked}
                       onChange={e => setUrl(e.target.value)} placeholder="https://myapp.example.com" />
              </Field>
            </div>
          )}
        </div>

        {/* ── Permissions ── */}
        <div>
          <h2 className="text-sm font-bold">Permissions</h2>
          <p className="mt-1 text-[0.8rem] text-[#6b7280]">
            Request only what your app actually uses. Every extra permission is one more thing a
            reviewer has to justify, and one more reason a user declines.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {PERMISSIONS.map(p => (
              <label key={p.id}
                     className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
                       perms.includes(p.id) ? 'border-[#cdeab3] bg-[#fafdf7]' : 'border-[#e5e7eb]'
                     } ${locked ? 'cursor-not-allowed opacity-60' : 'hover:border-[#cdeab3]'}`}>
                <input
                  type="checkbox" className="mt-0.5 accent-[#2e7d2e]" disabled={locked}
                  checked={perms.includes(p.id)}
                  onChange={e => setPerms(v => e.target.checked ? [...v, p.id] : v.filter(x => x !== p.id))}
                />
                <span className="min-w-0">
                  <span className="block text-[0.85rem] font-semibold">{p.label}</span>
                  <span className="block text-[0.78rem] text-[#6b7280]">{p.help}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Bundle upload ── */}
        {hosting === 'AZA_HOSTED' && !isNew && current && (
          <BundleUpload
            token={token}
            app={current}
            onUploaded={async (updated) => { setCurrent(updated); await onSaved(); }}
          />
        )}
        {hosting === 'AZA_HOSTED' && isNew && (
          <Callout tone="info" title="Save first, then upload">
            Create the app to reserve <code className="font-mono">{id || 'your-app-id'}</code>, then
            upload your bundle on this page.
          </Callout>
        )}

        {error && <Callout tone="error" title="Couldn't save">{error}</Callout>}
        {notice && <Callout tone="success" title={notice}>{null}</Callout>}

        <div className="flex flex-wrap items-center gap-3 border-t border-[#e5e7eb] pt-6">
          <button
            onClick={() => save(false)} disabled={saving || locked}
            className="rounded-lg border border-[#e5e7eb] px-4 py-2.5 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#f8f9fa] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving || locked || (hosting === 'AZA_HOSTED' && !current?.pendingBundleVersion && !current?.bundleVersion)}
            className="rounded-lg bg-[#0e2a0e] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#174717] disabled:opacity-50"
          >
            Submit for review
          </button>
          {hosting === 'AZA_HOSTED' && !current?.pendingBundleVersion && !current?.bundleVersion && (
            <span className="text-[0.8rem] text-[#6b7280]">Upload a bundle before submitting.</span>
          )}
        </div>
      </div>
    </>
  );
}

// ── Bundle upload ─────────────────────────────────────────────────────────────

function BundleUpload({ token, app, onUploaded }: {
  token: string;
  app: MiniApp;
  onUploaded: (updated: MiniApp) => Promise<void>;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    setError(null);

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Upload a .zip of your build output.');
      return;
    }
    if (file.size > MAX_BUNDLE_BYTES) {
      setError(`That zip is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BUNDLE_BYTES)}.`);
      return;
    }

    // XHR rather than fetch: fetch still has no upload-progress event, and a bundle upload
    // on Ghanaian mobile data is long enough that a silent wait reads as a hang.
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener('load', () => {
      setProgress(null);
      let body: ApiResponse<MiniApp> | null = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }

      if (xhr.status >= 200 && xhr.status < 300 && body?.success && body.data) {
        void onUploaded(body.data);
        return;
      }
      setError(
        body?.error?.message
        ?? (xhr.status === 413
              ? 'That bundle is too large for the server to accept.'
              : 'Upload failed. Please try again.')
      );
    });

    xhr.addEventListener('error', () => {
      setProgress(null);
      setError('Network error during upload.');
    });

    setProgress(0);
    xhr.open('POST', `${API}/api/v1/dev/miniapps/${app.id}/bundle`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
  }

  const busy = progress !== null;

  return (
    <div>
      <h2 className="text-sm font-bold">Bundle</h2>
      <p className="mt-1 text-[0.8rem] text-[#6b7280]">
        Zip the <em>contents</em> of your build output — <code className="font-mono">dist/</code> for
        Vite, or <code className="font-mono">npx expo export --platform web</code> for Expo.
        Uploading never disturbs your live version; it stages the build for review.
      </p>

      {app.bundleVersion && (
        <p className="mt-3 text-[0.8rem] text-[#374151]">
          <strong>Live:</strong>{' '}
          <span className="font-mono text-[#6b7280]">{app.bundleVersion}</span>
          {app.url && (
            <>
              {' · '}
              <a href={app.url} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1 font-semibold text-[#174717] underline">
                open <ExternalLink size={11} />
              </a>
            </>
          )}
        </p>
      )}

      {app.pendingBundleVersion && (
        <div className="mt-3 rounded-lg bg-[#e8f0fe] px-4 py-3 ring-1 ring-inset ring-[#c7dbfb]">
          <p className="text-[0.82rem] text-[#1a3a6b]">
            <strong>Staged for review:</strong>{' '}
            <span className="font-mono">{app.pendingBundleVersion}</span>
            {' · '}{formatBytes(app.bundleSizeBytes)}
          </p>
          {app.previewUrl && (
            <a href={app.previewUrl} target="_blank" rel="noreferrer"
               className="mt-1 inline-flex items-center gap-1 text-[0.82rem] font-semibold text-[#1a56db] underline">
              Preview it <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !busy) upload(file);
        }}
        className={`mt-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? 'border-[#2e7d2e] bg-[#fafdf7]' : 'border-[#e5e7eb]'
        }`}
      >
        {busy ? (
          <>
            <Loader2 size={22} className="mx-auto animate-spin text-[#2e7d2e]" />
            <p className="mt-3 text-sm font-semibold">Uploading… {progress}%</p>
            <div className="mx-auto mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-[#e5e7eb]">
              <div className="h-full rounded-full bg-[#2e7d2e] transition-[width]"
                   style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <>
            <Upload size={22} className="mx-auto text-[#9ca3af]" />
            <p className="mt-3 text-sm text-[#374151]">
              Drop <code className="font-mono">bundle.zip</code> here, or{' '}
              <button onClick={() => inputRef.current?.click()}
                      className="font-semibold text-[#174717] underline">
                choose a file
              </button>
            </p>
            <p className="mt-1 text-[0.75rem] text-[#9ca3af]">
              Max {formatBytes(MAX_BUNDLE_BYTES)} zipped · 50 MB unpacked · 2000 files
            </p>
          </>
        )}
        <input
          ref={inputRef} type="file" accept=".zip,application/zip" className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && <Callout tone="error" title="Upload rejected">{error}</Callout>}
    </div>
  );
}

// ── Small UI pieces ───────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-[#e5e7eb] px-3.5 py-2.5 text-sm text-[#111827] ' +
  'placeholder:text-[#9ca3af] focus:border-[#2e7d2e] focus:outline-none focus:ring-2 ' +
  'focus:ring-[#B7EE7A] disabled:bg-[#f8f9fa] disabled:text-[#6b7280]';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">{label}</span>
      {hint && <span className="mb-1.5 block text-[0.78rem] text-[#6b7280]">{hint}</span>}
      {children}
    </label>
  );
}

function HostingChoice({ selected, disabled, onSelect, Icon, title, body }: {
  selected: boolean; disabled?: boolean; onSelect: () => void;
  Icon: typeof Server; title: string; body: string;
}) {
  return (
    <button
      type="button" onClick={onSelect} disabled={disabled}
      className={`rounded-xl border px-4 py-3.5 text-left transition-colors disabled:opacity-60 ${
        selected ? 'border-[#2e7d2e] bg-[#fafdf7] ring-1 ring-inset ring-[#cdeab3]' : 'border-[#e5e7eb] hover:border-[#cdeab3]'
      }`}
    >
      <Icon size={17} className={selected ? 'text-[#2e7d2e]' : 'text-[#9ca3af]'} />
      <span className="mt-2 block text-[0.9rem] font-bold">{title}</span>
      <span className="mt-0.5 block text-[0.78rem] leading-snug text-[#6b7280]">{body}</span>
    </button>
  );
}

function Callout({ tone, title, children }: {
  tone: 'error' | 'info' | 'success';
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    error:   { bg: '#fdeaea', ring: '#f6c9c9', fg: '#c62828', Icon: AlertTriangle },
    info:    { bg: '#e8f0fe', ring: '#c7dbfb', fg: '#1a56db', Icon: Clock },
    success: { bg: '#eaf7e0', ring: '#cdeab3', fg: '#1e6b23', Icon: CheckCircle2 },
  }[tone];

  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-lg px-4 py-3 ring-1 ring-inset"
         style={{ background: styles.bg, ['--tw-ring-color' as string]: styles.ring }}>
      <styles.Icon size={15} className="mt-0.5 shrink-0" style={{ color: styles.fg }} />
      <div className="min-w-0 text-[0.85rem]" style={{ color: styles.fg }}>
        <strong>{title}</strong>
        {children ? <div className="mt-0.5 leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}
