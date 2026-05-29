"use client";

import { useEffect, useState } from "react";
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  WebhookEndpoint,
  WebhookDelivery,
} from "@/lib/merchant-api";
import {
  Loader2,
  Plus,
  Webhook,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  X,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const ALL_EVENTS = [
  "checkout.completed",
  "checkout.expired",
  "*",
];

function fmtDate(iso: string) {
  try { return format(parseISO(iso), "MMM d, h:mm a"); }
  catch { return iso; }
}

// ─── Add / Edit Modal ──────────────────────────────────────────────────────────

function EndpointModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: WebhookEndpoint;
  onSave: (data: { url: string; events: string[] }) => Promise<void>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [events, setEvents] = useState<string[]>(initial?.events ?? ["checkout.completed"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleEvent(e: string) {
    setEvents((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    if (events.length === 0) { setError("Select at least one event"); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ url, events });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-[#161616] border border-white/8 rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors">
          <X size={16} />
        </button>
        <h3 className="text-base font-semibold text-white mb-5">{initial ? "Edit endpoint" : "Add webhook endpoint"}</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Endpoint URL *</label>
            <input
              type="url" required
              value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yoursite.com/webhooks/aza"
              className="w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all"
            />
            <p className="text-[10px] text-white/25 mt-1">Must be HTTPS</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Events to listen for *</label>
            <div className="flex flex-col gap-1.5">
              {ALL_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/4 hover:bg-white/6 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="accent-[#B7EE7A] w-3.5 h-3.5"
                  />
                  <span className="text-xs text-white/70 font-mono">{ev}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : initial ? "Save changes" : "Add endpoint"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Delivery Log ──────────────────────────────────────────────────────────────

function DeliveryLog({ endpointId }: { endpointId: string }) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWebhookDeliveries(endpointId)
      .then(setDeliveries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [endpointId]);

  const STATUS_CFG: Record<string, { icon: React.ElementType; cls: string }> = {
    SUCCESS: { icon: CheckCircle2, cls: "text-emerald-400" },
    FAILED:  { icon: XCircle,      cls: "text-red-400" },
    PENDING: { icon: Clock,        cls: "text-amber-400" },
  };

  if (loading) return <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-white/30" /></div>;

  if (deliveries.length === 0) {
    return <p className="py-4 text-center text-xs text-white/25">No deliveries yet</p>;
  }

  return (
    <div className="space-y-1.5 mt-3">
      {deliveries.slice(0, 10).map((d) => {
        const cfg = STATUS_CFG[d.status] ?? STATUS_CFG.PENDING;
        const StatusIcon = cfg.icon;
        return (
          <div key={d.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-white/3 border border-white/5">
            <StatusIcon size={13} className={cfg.cls} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/70 font-mono">{d.eventType}</p>
              <p className="text-[10px] text-white/30 mt-0.5">
                {fmtDate(d.createdAt)}
                {d.httpStatus && ` · HTTP ${d.httpStatus}`}
                {d.duration && ` · ${d.duration}ms`}
                {d.attemptNumber > 1 && ` · attempt ${d.attemptNumber}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Endpoint Card ─────────────────────────────────────────────────────────────

function EndpointCard({
  endpoint,
  onUpdate,
  onDelete,
}: {
  endpoint: WebhookEndpoint;
  onUpdate: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try { await onUpdate(endpoint.id, { isActive: !endpoint.isActive }); }
    catch {}
    setToggling(false);
  }

  return (
    <>
      {editing && (
        <EndpointModal
          initial={endpoint}
          onSave={async (data) => { await onUpdate(endpoint.id, data); }}
          onClose={() => setEditing(false)}
        />
      )}
      <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${endpoint.isActive ? "bg-[#174717]" : "bg-white/20"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white font-mono truncate">{endpoint.url}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {endpoint.events.map((ev) => (
                <span key={ev} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-mono">{ev}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={handleToggle} disabled={toggling} title={endpoint.isActive ? "Disable" : "Enable"} className="p-1.5 rounded-lg text-white/25 hover:text-white/70 transition-colors">
              {toggling ? <Loader2 size={14} className="animate-spin" /> : endpoint.isActive ? <ToggleRight size={14} className="text-[#B7EE7A]" /> : <ToggleLeft size={14} />}
            </button>
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/8 transition-colors text-xs font-medium">
              Edit
            </button>
            {deleteConfirm ? (
              <>
                <button onClick={() => onDelete(endpoint.id)} className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors">Delete</button>
                <button onClick={() => setDeleteConfirm(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white transition-colors"><X size={13} /></button>
              </>
            ) : (
              <button onClick={() => setDeleteConfirm(true)} className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-lg text-white/25 hover:text-white/70 transition-colors">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>
        {expanded && (
          <div className="border-t border-white/5 px-4 pb-4">
            <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium mt-3 mb-1">Recent deliveries</p>
            <DeliveryLog endpointId={endpoint.id} />
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const w = await getWebhooks();
      setEndpoints(w);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(data: { url: string; events: string[] }) {
    const ep = await createWebhook(data);
    setEndpoints((prev) => [ep, ...prev]);
  }

  async function handleUpdate(id: string, data: any) {
    const updated = await updateWebhook(id, data);
    setEndpoints((prev) => prev.map((e) => e.id === id ? updated : e));
  }

  async function handleDelete(id: string) {
    try {
      await deleteWebhook(id);
      setEndpoints((prev) => prev.filter((e) => e.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <>
      {showAdd && (
        <EndpointModal
          onSave={handleCreate}
          onClose={() => setShowAdd(false)}
        />
      )}

      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Webhooks</h1>
            <p className="text-white/40 text-sm mt-0.5">Receive real-time events in your server</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-white font-semibold text-sm transition-colors"
          >
            <Plus size={15} />
            Add endpoint
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={15} />{error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-white/30" size={22} />
          </div>
        ) : endpoints.length === 0 ? (
          <div className="py-16 text-center bg-[#161616] border border-white/5 rounded-xl">
            <Webhook size={28} className="mx-auto mb-3 text-white/15" />
            <p className="text-sm text-white/30">No webhook endpoints</p>
            <p className="text-xs text-white/20 mt-1">Add an endpoint to receive payment events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {endpoints.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
