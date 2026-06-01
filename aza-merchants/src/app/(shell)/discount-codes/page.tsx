"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getDiscountCodes, createDiscountCode, updateDiscountCode, deleteDiscountCode,
  DiscountCode,
} from "@/lib/merchant-api";
import { Loader2, Tag, Plus, X, Trash2, Copy, Check, ToggleLeft, ToggleRight } from "lucide-react";

function fmtDate(s: string | null) {
  if (!s) return "Never";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: DiscountCode) => void }) {
  const [form, setForm] = useState({
    code: "",
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
    value: "",
    maxUses: "",
    expiresAt: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(form.value);
    if (isNaN(value) || value <= 0) { setError("Enter a valid discount value"); return; }
    if (form.discountType === "PERCENTAGE" && value > 100) { setError("Percentage cannot exceed 100"); return; }
    setLoading(true);
    setError(null);
    try {
      const code = await createDiscountCode({
        code: form.code.trim().toUpperCase() || undefined,
        discountType: form.discountType,
        value,
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
      });
      onCreate(code);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-foreground">New Discount Code</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-foreground/40 mb-1.5">Code <span className="text-foreground/20">(leave blank to auto-generate)</span></label>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground font-mono placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50 uppercase"
              placeholder="SUMMER20"
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-xs text-foreground/40 mb-1.5">Discount type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["PERCENTAGE", "FIXED"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, discountType: t }))}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${form.discountType === t ? "bg-[#B7EE7A]/10 border-[#B7EE7A]/40 text-[#B7EE7A]" : "border-border text-foreground/50 hover:border-border"}`}
                >
                  {t === "PERCENTAGE" ? "% Percentage" : "GHS Fixed"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground/40 mb-1.5">
                {form.discountType === "PERCENTAGE" ? "Discount (%)" : "Amount (GHS)"}
              </label>
              <input
                required
                type="number"
                min="0.01"
                max={form.discountType === "PERCENTAGE" ? "100" : undefined}
                step="0.01"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50"
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/40 mb-1.5">Max uses <span className="text-foreground/20">(optional)</span></label>
              <input
                type="number"
                min="1"
                value={form.maxUses}
                onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50"
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-foreground/40 mb-1.5">Expires <span className="text-foreground/20">(optional)</span></label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50"
            />
          </div>

          {error && <p className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-foreground/60 hover:text-foreground hover:bg-muted/30 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-foreground transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Create Code
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CodeRow({ code, onToggle, onDelete }: { code: DiscountCode; onToggle: () => void; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleToggle() {
    setToggling(true);
    try { await onToggle(); } finally { setToggling(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }

  const usageText = code.maxUses ? `${code.usedCount} / ${code.maxUses} uses` : `${code.usedCount} uses`;

  return (
    <div className="px-5 py-4 flex items-center gap-4 hover:bg-muted/10 transition-colors">
      {/* Code chip */}
      <button
        onClick={copyCode}
        className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-sm font-mono font-semibold text-foreground hover:bg-muted transition-colors flex-shrink-0"
      >
        {copied ? <Check size={12} className="text-[#B7EE7A]" /> : <Copy size={12} />}
        {code.code}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {code.discountType === "PERCENTAGE" ? `${code.value}% off` : `GHS ${code.value} off`}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${code.active ? "bg-[#B7EE7A]/10 text-[#B7EE7A]" : "bg-muted/50 text-foreground/30"}`}>
            {code.active ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="text-xs text-foreground/35 mt-0.5">
          {usageText} · expires {fmtDate(code.expiresAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-30"
          title={code.active ? "Deactivate" : "Activate"}
        >
          {toggling ? <Loader2 size={15} className="animate-spin" /> : code.active ? <ToggleRight size={16} className="text-[#B7EE7A]" /> : <ToggleLeft size={16} />}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30"
          title="Delete"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function DiscountCodesPage() {
  const [codes, setCodes] = useState<DiscountCode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setCodes(await getDiscountCodes()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load codes"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(code: DiscountCode) {
    const updated = await updateDiscountCode(code.id, { active: !code.active });
    setCodes((cs) => cs ? cs.map((c) => c.id === code.id ? updated : c) : cs);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this discount code?")) return;
    await deleteDiscountCode(id);
    setCodes((cs) => cs ? cs.filter((c) => c.id !== id) : cs);
  }

  return (
    <div className="space-y-6">
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(c) => { setCodes((cs) => cs ? [c, ...cs] : [c]); setShowCreate(false); }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Discount Codes</h1>
          <p className="text-foreground/40 text-sm mt-0.5">Promo codes customers enter at checkout</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-foreground rounded-xl transition-colors"
        >
          <Plus size={15} />
          New Code
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-[#B7EE7A]" size={22} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : !codes || codes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Tag size={32} className="text-foreground/15" />
            <p className="text-foreground/40 text-sm">No discount codes yet</p>
            <button onClick={() => setShowCreate(true)} className="text-sm text-[#B7EE7A] hover:underline">
              Create your first code
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {codes.map((code) => (
              <CodeRow
                key={code.id}
                code={code}
                onToggle={() => handleToggle(code)}
                onDelete={() => handleDelete(code.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-semibold text-foreground mb-2">How discount codes work</p>
        <ul className="space-y-1.5 text-xs text-foreground/40">
          <li>• Customers enter the code at checkout before paying</li>
          <li>• Percentage codes reduce the amount by a % of the total</li>
          <li>• Fixed codes deduct a flat amount from the total</li>
          <li>• Codes are case-insensitive and validated against expiry and usage limits</li>
        </ul>
      </div>
    </div>
  );
}
