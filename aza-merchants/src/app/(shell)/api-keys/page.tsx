"use client";

import { useEffect, useState } from "react";
import {
  getApiKeys,
  createApiKey,
  revokeApiKey,
  ApiKey,
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
} from "lucide-react";
import { format, parseISO } from "date-fns";

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  try { return format(parseISO(iso), "MMM d, yyyy"); }
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
          className="w-full py-2.5 rounded-xl bg-[#10b981] hover:bg-[#0ea472] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 mb-3"
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

// ─── Key Row ───────────────────────────────────────────────────────────────────

function KeyRow({
  apiKey,
  onRevoke,
  revoking,
}: {
  apiKey: ApiKey;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const isRevoked = !!apiKey.revokedAt;
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
      isRevoked ? "bg-white/2 border-white/5 opacity-50" : "bg-white/4 border-white/8"
    }`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono font-medium text-white">
          {apiKey.keyPrefix}<span className="text-white/30">••••••••••••••••</span>
        </p>
        <div className="flex items-center gap-3 mt-1">
          {apiKey.label && <span className="text-xs text-white/45">{apiKey.label}</span>}
          <span className="text-xs text-white/30">Created {fmtDate(apiKey.createdAt)}</span>
          <span className="text-xs text-white/20">·</span>
          <span className="text-xs text-white/30">Last used {fmtDate(apiKey.lastUsedAt)}</span>
        </div>
      </div>
      {isRevoked ? (
        <span className="text-xs text-white/30 font-medium">Revoked {fmtDate(apiKey.revokedAt)}</span>
      ) : confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Revoke?</span>
          <button onClick={() => onRevoke(apiKey.id)} disabled={revoking} className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors">
            {revoking ? <Loader2 size={12} className="animate-spin" /> : "Yes"}
          </button>
          <button onClick={() => setConfirming(false)} className="px-2.5 py-1 rounded-lg bg-white/6 text-white/40 text-xs font-medium hover:text-white transition-colors">No</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="p-2 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<"TEST" | "LIVE" | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [newKeyModal, setNewKeyModal] = useState<{ environment: "TEST" | "LIVE"; fullKey: string } | null>(null);

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

  async function handleGenerate(environment: "TEST" | "LIVE") {
    setGenerating(environment);
    setError(null);
    try {
      const res = await createApiKey(environment);
      if (res.fullKey) {
        setNewKeyModal({ environment, fullKey: res.fullKey });
      }
      setKeys((prev) => [res, ...prev]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(null);
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

      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">API Keys</h1>
          <p className="text-white/40 text-sm mt-0.5">Manage your API credentials for integrations</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={15} />{error}
          </div>
        )}

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
              onGenerate={() => handleGenerate("TEST")}
              generating={generating === "TEST"}
              onRevoke={handleRevoke}
              revoking={revoking}
              color="text-white/60"
            />

            <KeySection
              title="Live keys"
              description="Use with aza_live_ prefix. Real money moves."
              environment="LIVE"
              keys={liveKeys}
              onGenerate={() => handleGenerate("LIVE")}
              generating={generating === "LIVE"}
              onRevoke={handleRevoke}
              revoking={revoking}
              color="text-[#10b981]"
            />
          </>
        )}
      </div>
    </>
  );
}

function KeySection({
  title,
  description,
  environment,
  keys,
  onGenerate,
  generating,
  onRevoke,
  revoking,
  color,
}: {
  title: string;
  description: string;
  environment: "TEST" | "LIVE";
  keys: ApiKey[];
  onGenerate: () => void;
  generating: boolean;
  onRevoke: (id: string) => void;
  revoking: string | null;
  color: string;
}) {
  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  return (
    <div className="bg-[#161616] border border-white/5 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-semibold ${color}`}>{title}</p>
          <p className="text-xs text-white/35 mt-0.5">{description}</p>
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/6 border border-white/10 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
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
            <KeyRow key={k.id} apiKey={k} onRevoke={onRevoke} revoking={revoking === k.id} />
          ))}
        </div>
      )}
      {revokedKeys.length > 0 && (
        <div className="space-y-2">
          {revokedKeys.map((k) => (
            <KeyRow key={k.id} apiKey={k} onRevoke={onRevoke} revoking={false} />
          ))}
        </div>
      )}
    </div>
  );
}
