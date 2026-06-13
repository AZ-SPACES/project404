"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPromoCodes,
  createPromoCode,
  togglePromoCode,
  deletePromoCode,
  getPromoRedemptions,
  type PromoCode,
  type PromoRedemption,
} from "@/lib/admin-api";
import { Tag, Loader2, ChevronDown, ChevronRight, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function ghs(value: number) {
  return `GHS ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function RedemptionsPanel({ promoId }: { promoId: string }) {
  const { data, isLoading } = useQuery<PromoRedemption[]>({
    queryKey: ["promoRedemptions", promoId],
    queryFn: () => getPromoRedemptions(promoId),
  });

  if (isLoading)
    return (
      <div className="px-4 py-3 flex items-center gap-2 text-foreground/30 text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading redemptions…
      </div>
    );

  if (!data || data.length === 0)
    return <div className="px-4 py-3 text-sm text-foreground/30">No redemptions yet</div>;

  return (
    <div className="border-t border-border bg-muted/10">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2 text-foreground/40 font-medium">User ID</th>
            <th className="text-left px-4 py-2 text-foreground/40 font-medium">Amount</th>
            <th className="text-left px-4 py-2 text-foreground/40 font-medium">Redeemed At</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2 font-mono text-foreground/60">{r.userId}</td>
              <td className="px-4 py-2 text-foreground/70">{ghs(r.creditAmountGhs)}</td>
              <td className="px-4 py-2 text-foreground/50">{fmt(r.redeemedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PromoRow({ promo }: { promo: PromoCode }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = useMutation({
    mutationFn: () => togglePromoCode(promo.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["promoCodes"] }),
  });

  const del = useMutation({
    mutationFn: () => deletePromoCode(promo.id),
    onSuccess: () => {
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey: ["promoCodes"] });
    },
  });

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded(!expanded)} className="text-foreground/40 hover:text-foreground transition-colors">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-foreground">{promo.code}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${
                promo.active
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-foreground/5 text-foreground/40 border-border"
              }`}
            >
              {promo.active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-xs text-foreground/50 mt-0.5">
            {ghs(promo.creditAmountGhs)} credit ·{" "}
            {promo.usedCount}{promo.maxUses ? `/${promo.maxUses}` : ""} uses ·{" "}
            expires {fmtDate(promo.expiresAt)}
            {promo.description && ` · ${promo.description}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
            className="p-1.5 rounded-lg hover:bg-muted/30 text-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
            title={promo.active ? "Deactivate" : "Activate"}
          >
            {toggle.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : promo.active ? (
              <ToggleRight size={15} className="text-emerald-400" />
            ) : (
              <ToggleLeft size={15} />
            )}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                {del.isPending ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2 py-1 rounded bg-muted/30 text-foreground/50 hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-foreground/30 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {expanded && <RedemptionsPanel promoId={promo.id} />}
    </div>
  );
}

export default function VouchersPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [creditAmountGhs, setCreditAmountGhs] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [formError, setFormError] = useState("");

  const { data: promos, isLoading } = useQuery<PromoCode[]>({
    queryKey: ["promoCodes"],
    queryFn: getPromoCodes,
  });

  const create = useMutation({
    mutationFn: () =>
      createPromoCode({
        code: code.toUpperCase(),
        description: description || undefined,
        creditAmountGhs: Number(creditAmountGhs),
        maxUses: maxUses ? Number(maxUses) : undefined,
        expiresAt: expiresAt || undefined,
      }),
    onSuccess: () => {
      setCode("");
      setDescription("");
      setCreditAmountGhs("");
      setMaxUses("");
      setExpiresAt("");
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["promoCodes"] });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const inputCls =
    "w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Tag size={20} className="text-foreground/50" />
          <h1 className="text-2xl font-semibold text-foreground">Promo Code Manager</h1>
        </div>
        <p className="text-foreground/50 text-sm">Create and manage promotional voucher codes.</p>
      </div>

      {/* Create form */}
      <div className="rounded-xl border border-border p-5 mb-8">
        <h2 className="font-medium text-foreground text-sm mb-4">Create New Promo Code</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground/50 mb-1">Code *</label>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. WELCOME50"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/50 mb-1">GHS Credit Amount *</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={creditAmountGhs}
                onChange={(e) => setCreditAmountGhs(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/50 mb-1">Max Uses</label>
              <input
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/50 mb-1">Expires At</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-foreground/50 mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className={inputCls}
              />
            </div>
          </div>
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={create.isPending || !code || !creditAmountGhs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Create Code
          </button>
        </form>
      </div>

      {/* Promo codes list */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-foreground text-sm">
          Promo Codes {promos && <span className="text-foreground/40 font-normal">({promos.length})</span>}
        </h2>
      </div>

      {isLoading ? (
        <div className="h-48 bg-muted/20 rounded-xl animate-pulse" />
      ) : !promos || promos.length === 0 ? (
        <div className="rounded-xl border border-border text-center py-16 text-foreground/30">
          <Tag size={32} className="mx-auto mb-3 opacity-40" />
          <p>No promo codes yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {promos.map((promo) => (
            <PromoRow key={promo.id} promo={promo} />
          ))}
        </div>
      )}
    </div>
  );
}
