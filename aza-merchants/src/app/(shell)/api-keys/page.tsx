"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getApiKeys,
  createApiKey,
  updateApiKey,
  rollApiKey,
  revokeApiKey,
  getApiLogs,
  ApiKey,
  ApiLog,
} from "@/lib/merchant-api";
import {
  Loader2,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  X,
  ShieldCheck,
  AlertTriangle,
  Edit2,
  RefreshCw,
  List,
  Activity,
} from "lucide-react";
import { format, parseISO } from "date-fns";

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  try { return format(parseISO(iso), "MMM d, yyyy"); }
  catch { return iso; }
}

function fmtDateTime(iso: string) {
  try { return format(parseISO(iso), "MMM d, h:mm a"); }
  catch { return iso; }
}

// ─── New Key Modal ─────────────────────────────────────────────────────────────

function NewKeyModal({
  environment,
  fullKey,
  onClose,
}: {
  environment: "TEST" | "LIVE";
  fullKey: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(fullKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-[#161616] border border-white/8 rounded-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors">
          <X size={16} />
        </button>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Save your key</p>
            <p className="text-xs text-white/40">This is shown once only</p>
          </div>
        </div>
        <div className="bg-black/40 border border-white/8 rounded-xl p-3.5 mb-4">
          <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider font-medium">{environment} Secret Key</p>
          <p className="text-xs font-mono text-white/80 break-all">{fullKey}</p>
        </div>
        <button
          onClick={copy}
          className="w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 mb-3"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied to clipboard" : "Copy key"}
        </button>
        <p className="text-xs text-white/25 text-center">
          Your secret key is like a password — never put it in client-side code.
        </p>
      </div>
    </div>
  );
}

// ─── Edit Key Modal ────────────────────────────────────────────────────────────

function EditKeyModal({
  apiKey,
  onSave,
  onClose,
}: {
  apiKey: ApiKey;
  onSave: (id: string, data: { label?: string; ipWhitelist?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(apiKey.label ?? "");
  const [ipWhitelist, setIpWhitelist] = useState(apiKey.ipWhitelist ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(apiKey.id, {
        label: label || undefined,
        ipWhitelist: ipWhitelist || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-[#161616] border border-white/8 rounded-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors">
          <X size={16} />
        </button>
        <h3 className="text-base font-semibold text-white mb-5">Edit API Key</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production Server"
              className="w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              IP Whitelist <span className="text-white/25 font-normal">optional — comma separated</span>
            </label>
            <input
              type="text"
              value={ipWhitelist}
              onChange={(e) => setIpWhitelist(e.target.value)}
              placeholder="192.168.1.1, 10.0.0.0/24"
              className="w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Create Key Modal ──────────────────────────────────────────────────────────

function CreateKeyModal({
  environment,
  onCreate,
  onClose,
}: {
  environment: "TEST" | "LIVE";
  onCreate: (data: {
    environment: "TEST" | "LIVE";
    label?: string;
    type?: "SECRET" | "RESTRICTED";
    scopes?: string;
    ipWhitelist?: string;
    expirationDays?: number;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [keyType, setKeyType] = useState<"SECRET" | "RESTRICTED">("SECRET");
  const [scopes, setScopes] = useState<Record<string, boolean>>({ "sessions:read": false, "sessions:write": false });
  const [ipWhitelist, setIpWhitelist] = useState("");
  const [expirationDays, setExpirationDays] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const selectedScopes = Object.entries(scopes)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(",");
      await onCreate({
        environment,
        label: label || undefined,
        type: keyType,
        scopes: keyType === "RESTRICTED" && selectedScopes ? selectedScopes : undefined,
        ipWhitelist: ipWhitelist || undefined,
        expirationDays: expirationDays ?? undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-[#161616] border border-white/8 rounded-2xl p-6 relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors">
          <X size={16} />
        </button>
        <h3 className="text-base font-semibold text-white mb-1">New {environment} API Key</h3>
        <p className="text-xs text-white/35 mb-5">Configure permissions and restrictions for this key.</p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production Server Key"
              className="w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Key Type</label>
            <div className="flex gap-2">
              {(["SECRET", "RESTRICTED"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setKeyType(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    keyType === t
                      ? "bg-[#B7EE7A]/15 border-[#B7EE7A]/40 text-[#B7EE7A]"
                      : "bg-white/4 border-white/10 text-white/50 hover:text-white"
                  }`}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {keyType === "RESTRICTED" && (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Permissions</label>
              <div className="space-y-2">
                {Object.keys(scopes).map((scope) => (
                  <label key={scope} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopes[scope]}
                      onChange={() => setScopes((prev) => ({ ...prev, [scope]: !prev[scope] }))}
                      className="w-3.5 h-3.5 accent-[#B7EE7A]"
                    />
                    <span className="text-xs font-mono text-white/65">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              IP Whitelist <span className="text-white/25 font-normal">optional</span>
            </label>
            <input
              type="text"
              value={ipWhitelist}
              onChange={(e) => setIpWhitelist(e.target.value)}
              placeholder="192.168.1.1, 10.0.0.0/24"
              className="w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Expiration</label>
            <div className="flex gap-2">
              {[{ label: "Never", val: null }, { label: "30 days", val: 30 }, { label: "90 days", val: 90 }].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setExpirationDays(opt.val)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    expirationDays === opt.val
                      ? "bg-[#B7EE7A]/15 border-[#B7EE7A]/40 text-[#B7EE7A]"
                      : "bg-white/4 border-white/10 text-white/50 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            {creating ? "Creating…" : "Create key"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Key Row ───────────────────────────────────────────────────────────────────

function KeyRow({
  apiKey,
  onRevoke,
  revoking,
  onEdit,
  onRoll,
  rolling,
}: {
  apiKey: ApiKey;
  onRevoke: (id: string) => void;
  revoking: boolean;
  onEdit: (key: ApiKey) => void;
  onRoll: (id: string) => void;
  rolling: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmRoll, setConfirmRoll] = useState(false);
  const isRevoked = !!apiKey.revokedAt;
  return (
    <div className={`p-4 rounded-xl border transition-colors ${
      isRevoked ? "bg-white/2 border-white/5 opacity-50" : "bg-white/4 border-white/8"
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-white">
            {apiKey.keyPrefix}<span className="text-white/30">••••••••••••••••</span>
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            {apiKey.label && <span className="text-xs text-white/45">{apiKey.label}</span>}
            <span className="text-xs text-white/30">Created {fmtDate(apiKey.createdAt)}</span>
            <span className="text-xs text-white/20">·</span>
            <span className="text-xs text-white/30">Last used {fmtDate(apiKey.lastUsedAt)}</span>
            {apiKey.expiresAt && (
              <>
                <span className="text-xs text-white/20">·</span>
                <span className="text-xs text-amber-400">Expires {fmtDate(apiKey.expiresAt)}</span>
              </>
            )}
          </div>
          {apiKey.ipWhitelist && (
            <p className="text-[10px] font-mono text-white/30 mt-1 truncate">IP: {apiKey.ipWhitelist}</p>
          )}
        </div>

        {!isRevoked && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(apiKey)}
              className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/8 transition-colors"
              title="Edit key"
            >
              <Edit2 size={13} />
            </button>
            {!confirmRoll ? (
              <button
                onClick={() => setConfirmRoll(true)}
                className="p-1.5 rounded-lg text-white/25 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                title="Roll key"
              >
                <RefreshCw size={13} />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-white/40">Roll?</span>
                <button
                  onClick={() => { setConfirmRoll(false); onRoll(apiKey.id); }}
                  disabled={rolling}
                  className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors"
                >
                  {rolling ? <Loader2 size={12} className="animate-spin" /> : "Yes"}
                </button>
                <button onClick={() => setConfirmRoll(false)} className="px-2 py-1 rounded-lg bg-white/6 text-white/40 text-xs font-medium hover:text-white transition-colors">No</button>
              </div>
            )}
            {confirming ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-white/40">Revoke?</span>
                <button onClick={() => onRevoke(apiKey.id)} disabled={revoking} className="px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors">
                  {revoking ? <Loader2 size={12} className="animate-spin" /> : "Yes"}
                </button>
                <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded-lg bg-white/6 text-white/40 text-xs font-medium hover:text-white transition-colors">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Revoke key">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}

        {isRevoked && (
          <span className="text-xs text-white/30 font-medium flex-shrink-0">Revoked {fmtDate(apiKey.revokedAt)}</span>
        )}
      </div>
    </div>
  );
}

// ─── API Logs View ─────────────────────────────────────────────────────────────

function ApiLogsView() {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await getApiLogs(p, 20);
      if (p === 0) {
        setLogs(res.content);
      } else {
        setLogs((prev) => [...prev, ...res.content]);
      }
      setPage(p);
      setHasMore(p < res.totalPages - 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-white/30" size={22} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
        <AlertCircle size={15} />{error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-16 text-center">
        <Activity size={28} className="mx-auto mb-3 text-white/15" />
        <p className="text-sm text-white/30">No API request logs yet</p>
        <p className="text-xs text-white/20 mt-1">Requests made with your API keys will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const isErr = log.statusCode >= 400;
        return (
          <div key={log.id} className="bg-white/4 border border-white/8 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold font-mono ${log.method === "POST" ? "text-blue-400" : "text-white/60"}`}>
                {log.method}
              </span>
              <span className="text-sm font-mono text-white/80 flex-1 truncate">{log.path}</span>
              <span className={`text-sm font-bold font-mono ${isErr ? "text-red-400" : "text-[#B7EE7A]"}`}>
                {log.statusCode}
              </span>
            </div>
            <div className="flex justify-between mt-2">
              {log.ipAddress && (
                <span className="text-[10px] text-white/30 font-mono">IP: {log.ipAddress}</span>
              )}
              <span className="text-[10px] text-white/30 ml-auto">{fmtDateTime(log.createdAt)}</span>
            </div>
            {log.errorMessage && (
              <p className="text-[11px] text-red-400 font-mono mt-1.5 truncate">Error: {log.errorMessage}</p>
            )}
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={() => load(page + 1)}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/50 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : "Load more"}
        </button>
      )}
    </div>
  );
}

// ─── Key Section ───────────────────────────────────────────────────────────────

function KeySection({
  title,
  description,
  environment,
  keys,
  onCreate,
  onRevoke,
  revoking,
  onEdit,
  onRoll,
  rolling,
  color,
}: {
  title: string;
  description: string;
  environment: "TEST" | "LIVE";
  keys: ApiKey[];
  onCreate: (data: Parameters<typeof createApiKey>[0]) => Promise<void>;
  onRevoke: (id: string) => void;
  revoking: string | null;
  onEdit: (key: ApiKey) => void;
  onRoll: (id: string) => void;
  rolling: string | null;
  color: string;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <>
      {showCreateModal && (
        <CreateKeyModal
          environment={environment}
          onCreate={async (data) => { await onCreate(data); setShowCreateModal(false); }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-semibold ${color}`}>{title}</p>
            <p className="text-xs text-white/35 mt-0.5">{description}</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/6 border border-white/10 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Plus size={12} />
            Generate
          </button>
        </div>
        {activeKeys.length === 0 ? (
          <div className="py-6 text-center">
            <Key size={20} className="mx-auto mb-2 text-white/15" />
            <p className="text-xs text-white/25">No active {environment.toLowerCase()} keys</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeKeys.map((k) => (
              <KeyRow
                key={k.id}
                apiKey={k}
                onRevoke={onRevoke}
                revoking={revoking === k.id}
                onEdit={onEdit}
                onRoll={onRoll}
                rolling={rolling === k.id}
              />
            ))}
          </div>
        )}
        {revokedKeys.length > 0 && (
          <div className="space-y-2">
            {revokedKeys.map((k) => (
              <KeyRow
                key={k.id}
                apiKey={k}
                onRevoke={onRevoke}
                revoking={false}
                onEdit={onEdit}
                onRoll={onRoll}
                rolling={false}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [rolling, setRolling] = useState<string | null>(null);
  const [newKeyModal, setNewKeyModal] = useState<{ environment: "TEST" | "LIVE"; fullKey: string } | null>(null);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [activeTab, setActiveTab] = useState<"KEYS" | "LOGS">("KEYS");

  async function loadKeys() {
    setLoading(true);
    try {
      const k = await getApiKeys();
      setKeys(k);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadKeys(); }, []);

  async function handleCreate(data: Parameters<typeof createApiKey>[0]) {
    setError(null);
    try {
      const res = await createApiKey(data);
      if (res.fullKey) {
        setNewKeyModal({ environment: data.environment, fullKey: res.fullKey });
      }
      setKeys((prev) => [res, ...prev]);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      await revokeApiKey(id);
      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRevoking(null);
    }
  }

  async function handleUpdate(id: string, data: { label?: string; ipWhitelist?: string }) {
    await updateApiKey(id, data);
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, ...data } : k));
    setEditingKey(null);
  }

  async function handleRoll(id: string) {
    setRolling(id);
    try {
      const updated = await rollApiKey(id);
      if (updated.fullKey) {
        const env = keys.find((k) => k.id === id)?.environment ?? "LIVE";
        setNewKeyModal({ environment: env, fullKey: updated.fullKey });
      }
      await loadKeys();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRolling(null);
    }
  }

  const testKeys = keys.filter((k) => k.environment === "TEST");
  const liveKeys = keys.filter((k) => k.environment === "LIVE");

  return (
    <>
      {newKeyModal && (
        <NewKeyModal
          environment={newKeyModal.environment}
          fullKey={newKeyModal.fullKey}
          onClose={() => setNewKeyModal(null)}
        />
      )}
      {editingKey && (
        <EditKeyModal
          apiKey={editingKey}
          onSave={handleUpdate}
          onClose={() => setEditingKey(null)}
        />
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">API Keys</h1>
            <p className="text-white/40 text-sm mt-0.5">Manage your API credentials for integrations</p>
          </div>
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("KEYS")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "KEYS" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
              }`}
            >
              <List size={13} />Keys
            </button>
            <button
              onClick={() => setActiveTab("LOGS")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "LOGS" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
              }`}
            >
              <Activity size={13} />Logs
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={15} />{error}
          </div>
        )}

        {activeTab === "KEYS" ? (
          <>
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-500/6 border border-amber-500/15">
              <ShieldCheck size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300/80">
                Keep your secret keys secure. Never expose them in client-side code, public repos, or browser environments.
                Use test keys during development — test transactions never move real money.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="animate-spin text-white/30" size={22} />
              </div>
            ) : (
              <>
                <KeySection
                  title="Test keys"
                  description="Use with aza_test_ prefix. Safe for development."
                  environment="TEST"
                  keys={testKeys}
                  onCreate={handleCreate}
                  onRevoke={handleRevoke}
                  revoking={revoking}
                  onEdit={setEditingKey}
                  onRoll={handleRoll}
                  rolling={rolling}
                  color="text-white/60"
                />
                <KeySection
                  title="Live keys"
                  description="Use with aza_live_ prefix. Real money moves."
                  environment="LIVE"
                  keys={liveKeys}
                  onCreate={handleCreate}
                  onRevoke={handleRevoke}
                  revoking={revoking}
                  onEdit={setEditingKey}
                  onRoll={handleRoll}
                  rolling={rolling}
                  color="text-[#B7EE7A]"
                />
              </>
            )}
          </>
        ) : (
          <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
            <p className="text-sm font-semibold text-white mb-4">API Request Logs</p>
            <ApiLogsView />
          </div>
        )}
      </div>
    </>
  );
}
