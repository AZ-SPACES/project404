"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFeeRules, getFeeStats, updateFeeRule, FeeRule, FeeStats } from "@/lib/admin-api";
import { Coins, AlertCircle, CheckCircle2, Loader2, Pencil, X, Save } from "lucide-react";

function fmtGhs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TX_TYPE_LABELS: Record<string, string> = {
  P2P_TRANSFER: "P2P Transfer",
  WALLET_TOPUP: "Wallet Top-up",
  WITHDRAWAL: "Withdrawal",
  BILL_PAYMENT: "Bill Payment",
  AIRTIME: "Airtime Purchase",
};

function FeeTypeBadge({ type }: { type: "FLAT" | "PERCENTAGE" }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
      type === "PERCENTAGE"
        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
        : "bg-purple-500/10 text-purple-400 border-purple-500/20"
    }`}>
      {type === "PERCENTAGE" ? "%" : "Flat"}
    </span>
  );
}

export default function FeesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<FeeRule | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<FeeRule>>({});
  const [success, setSuccess] = useState(false);

  const { data: rules = [], isLoading, error } = useQuery<FeeRule[]>({
    queryKey: ["feeRules"],
    queryFn: getFeeRules,
  });

  const { data: feeStats } = useQuery<FeeStats>({
    queryKey: ["feeStats"],
    queryFn: getFeeStats,
  });

  const saveMutation = useMutation({
    mutationFn: () => updateFeeRule(editing!.id, {
      amount: editDraft.amount,
      active: editDraft.active,
      minFee: editDraft.minFee ?? null,
      maxFee: editDraft.maxFee ?? null,
    }),
    onSuccess: () => {
      // Maker-checker: the rule is unchanged until a second staff member approves.
      setEditing(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-foreground/30" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Fee Management</h1>
        <p className="text-foreground/40 text-sm mt-0.5">Platform fee schedule and revenue configuration</p>
      </div>

      {feeStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Revenue Today", value: fmtGhs(feeStats.totalFeeRevenueToday), color: "text-[#B7EE7A]" },
            { label: "Revenue This Month", value: fmtGhs(feeStats.totalFeeRevenueMonth), color: "text-[#B7EE7A]" },
            { label: "Avg Fee / Transaction", value: fmtGhs(feeStats.averageFeePerTransaction), color: "text-foreground" },
            { label: "Active Fee Rules", value: feeStats.activeFeeRules.toString(), color: "text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] text-foreground/35 uppercase tracking-wider font-medium mb-1">{label}</p>
              <p className={`text-xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          Fee management endpoint not yet connected — configure rules once the backend API is available.
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          Change submitted — another FINANCE/ADMIN staff member must approve it in Approvals.
        </div>
      )}

      {rules.length === 0 ? (
        <div className="text-center py-20 text-foreground/25">
          <Coins size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No fee rules configured</p>
          <p className="text-xs mt-1 text-foreground/20">Fee rules will appear here once the backend API is connected.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Rule</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden sm:table-cell">Transaction Type</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Type</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Amount</th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden md:table-cell">Tier</th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-foreground">{rule.name}</p>
                    {rule.description && <p className="text-xs text-foreground/35 mt-0.5">{rule.description}</p>}
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <span className="text-xs text-foreground/55 px-2 py-1 rounded bg-muted/30 border border-border">
                      {TX_TYPE_LABELS[rule.transactionType] ?? rule.transactionType}
                    </span>
                  </td>
                  <td className="px-5 py-4"><FeeTypeBadge type={rule.feeType} /></td>
                  <td className="px-5 py-4 text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {rule.feeType === "PERCENTAGE" ? `${rule.amount}%` : fmtGhs(rule.amount)}
                    </p>
                    {(rule.minFee !== null || rule.maxFee !== null) && (
                      <p className="text-[11px] text-foreground/30">
                        {rule.minFee !== null && `min ${fmtGhs(rule.minFee)}`}
                        {rule.minFee !== null && rule.maxFee !== null && " · "}
                        {rule.maxFee !== null && `max ${fmtGhs(rule.maxFee)}`}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center hidden md:table-cell">
                    {rule.tierMinAmount !== null || rule.tierMaxAmount !== null ? (
                      <p className="text-xs text-foreground/40">
                        {rule.tierMinAmount !== null ? fmtGhs(rule.tierMinAmount) : "0"}
                        {" → "}
                        {rule.tierMaxAmount !== null ? fmtGhs(rule.tierMaxAmount) : "∞"}
                      </p>
                    ) : (
                      <span className="text-xs text-foreground/20">All amounts</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      rule.active
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : "text-foreground/30 bg-muted/30 border-border"
                    }`}>
                      {rule.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => { setEditing(rule); setEditDraft({ amount: rule.amount, active: rule.active, minFee: rule.minFee, maxFee: rule.maxFee }); }}
                      className="p-1.5 rounded-lg hover:bg-muted/40 text-foreground/30 hover:text-foreground transition-all"
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditing(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-foreground">Edit Fee Rule</h3>
              <button onClick={() => setEditing(null)} className="text-foreground/40 hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 block">
                  Fee Amount {editing.feeType === "PERCENTAGE" ? "(%)" : "(GHS)"}
                </label>
                <input
                  type="number"
                  value={editDraft.amount ?? ""}
                  onChange={(e) => setEditDraft((d) => ({ ...d, amount: Number(e.target.value) }))}
                  step={editing.feeType === "PERCENTAGE" ? "0.01" : "0.50"}
                  className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/20"
                />
              </div>

              {editing.feeType === "PERCENTAGE" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 block">Min Fee (GHS)</label>
                    <input
                      type="number"
                      value={editDraft.minFee ?? ""}
                      onChange={(e) => setEditDraft((d) => ({ ...d, minFee: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="No minimum"
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground/40 uppercase tracking-wider mb-2 block">Max Fee (GHS)</label>
                    <input
                      type="number"
                      value={editDraft.maxFee ?? ""}
                      onChange={(e) => setEditDraft((d) => ({ ...d, maxFee: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="No maximum"
                      className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-foreground/70">Rule Active</span>
                <button
                  onClick={() => setEditDraft((d) => ({ ...d, active: !d.active }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${editDraft.active ? "bg-[#B7EE7A]" : "bg-muted/50"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${editDraft.active ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>

            {saveMutation.error && (
              <p className="text-red-400 text-sm mt-3">{(saveMutation.error as Error).message}</p>
            )}

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full mt-5 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#B7EE7A] text-black text-sm font-semibold hover:bg-[#B7EE7A]/90 disabled:opacity-50 transition-all"
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
