"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getPlans, createPlan, updatePlan, deletePlan,
  getSubscriptions, cancelSubscription,
  Plan, Subscription, Page,
} from "@/lib/merchant-api";
import {
  Loader2, Repeat, Plus, X, Trash2, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight,
} from "lucide-react";

const INTERVALS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;

function fmt(n: number, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const SUB_STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-[#B7EE7A]/10 text-[#B7EE7A]",
  CANCELLED: "bg-red-400/10 text-red-400",
  PAUSED: "bg-amber-400/10 text-amber-400",
};

function CreatePlanModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Plan) => void }) {
  const [form, setForm] = useState({ name: "", description: "", amount: "", interval: "MONTHLY" as string });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return; }
    setLoading(true);
    setError(null);
    try {
      const plan = await createPlan({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        amount,
        interval: form.interval,
      });
      onCreate(plan);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-foreground">New Plan</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-foreground/40 mb-1.5">Plan Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50"
              placeholder="Monthly Basic"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground/40 mb-1.5">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50"
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground/40 mb-1.5">Amount (GHS)</label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-[#B7EE7A]/50"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-foreground/40 mb-1.5">Billing Interval</label>
              <select
                value={form.interval}
                onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value }))}
                className="w-full bg-black/30 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#B7EE7A]/50"
              >
                {INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
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
              Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [subsPage, setSubsPage] = useState<Page<Subscription> | null>(null);
  const [subsCurrentPage, setSubsCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [subsLoading, setSubsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"plans" | "subscriptions">("plans");

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setPlans(await getPlans()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load plans"); }
    finally { setLoading(false); }
  }, []);

  const loadSubs = useCallback(async (p: number) => {
    setSubsLoading(true);
    try { setSubsPage(await getSubscriptions(p, 20)); }
    catch {}
    finally { setSubsLoading(false); }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { loadSubs(subsCurrentPage); }, [loadSubs, subsCurrentPage]);

  async function handleToggle(plan: Plan) {
    setActionLoading(plan.id + ":toggle");
    try {
      const updated = await updatePlan(plan.id, { active: !plan.active });
      setPlans((ps) => ps ? ps.map((p) => p.id === plan.id ? updated : p) : ps);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this plan?")) return;
    setActionLoading(id + ":delete");
    try {
      await deletePlan(id);
      setPlans((ps) => ps ? ps.filter((p) => p.id !== id) : ps);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to delete plan");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancelSub(id: string) {
    if (!confirm("Cancel this subscription?")) return;
    setActionLoading(id + ":cancel");
    try {
      await cancelSubscription(id);
      setSubsPage((p) => p ? { ...p, content: p.content.map((s) => s.id === id ? { ...s, status: "CANCELLED" } : s) } : p);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to cancel subscription");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {showCreate && (
        <CreatePlanModal
          onClose={() => setShowCreate(false)}
          onCreate={(p) => {
            setPlans((ps) => ps ? [p, ...ps] : [p]);
            setShowCreate(false);
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Plans & Subscriptions</h1>
          <p className="text-foreground/40 text-sm mt-0.5">Recurring billing for your customers</p>
        </div>
        {tab === "plans" && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-foreground rounded-xl transition-colors"
          >
            <Plus size={15} />
            New Plan
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1 w-fit">
        {(["plans", "subscriptions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-muted/50 text-foreground" : "text-foreground/40 hover:text-foreground/70"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "plans" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin text-[#B7EE7A]" size={22} />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : !plans || plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Repeat size={32} className="text-foreground/15" />
              <p className="text-foreground/40 text-sm">No plans yet</p>
              <button onClick={() => setShowCreate(true)} className="text-sm text-[#B7EE7A] hover:underline">
                Create your first plan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {plans.map((plan) => (
                <div key={plan.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{plan.name}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${plan.active ? "bg-[#B7EE7A]/10 text-[#B7EE7A]" : "bg-muted/50 text-foreground/40"}`}>
                        {plan.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {plan.description && <p className="text-xs text-foreground/40 mt-0.5">{plan.description}</p>}
                    <p className="text-xs text-foreground/50 mt-1">
                      <span className="font-semibold text-foreground">{fmt(plan.amount, plan.currency)}</span>
                      {" "}/{" "}{plan.interval.toLowerCase()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(plan)}
                      disabled={actionLoading === plan.id + ":toggle"}
                      className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-30"
                      title={plan.active ? "Deactivate" : "Activate"}
                    >
                      {actionLoading === plan.id + ":toggle"
                        ? <Loader2 size={16} className="animate-spin" />
                        : plan.active
                          ? <ToggleRight size={16} className="text-[#B7EE7A]" />
                          : <ToggleLeft size={16} />
                      }
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      disabled={actionLoading === plan.id + ":delete"}
                      className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30"
                      title="Delete plan"
                    >
                      {actionLoading === plan.id + ":delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "subscriptions" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {subsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin text-[#B7EE7A]" size={22} />
            </div>
          ) : !subsPage || subsPage.content.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Repeat size={32} className="text-foreground/15" />
              <p className="text-foreground/40 text-sm">No active subscriptions</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Customer</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">Plan</th>
                      <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Status</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">Next Billing</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {subsPage.content.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-foreground">{sub.customerName ?? "—"}</p>
                          {sub.customerEmail && <p className="text-xs text-foreground/40">{sub.customerEmail}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-foreground/60 hidden md:table-cell">
                          {plans?.find((p) => p.id === sub.planId)?.name ?? sub.planId.slice(0, 8)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${SUB_STATUS_STYLE[sub.status] ?? "bg-muted/50 text-foreground/50"}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs text-foreground/40 hidden md:table-cell">
                          {fmtDate(sub.nextBillingAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {sub.status === "ACTIVE" && (
                            <button
                              onClick={() => handleCancelSub(sub.id)}
                              disabled={actionLoading === sub.id + ":cancel"}
                              className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30"
                              title="Cancel subscription"
                            >
                              {actionLoading === sub.id + ":cancel" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {subsPage.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <p className="text-xs text-foreground/30">
                    {subsPage.totalElements} subscriptions · page {subsPage.number + 1} of {subsPage.totalPages}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setSubsCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={subsCurrentPage === 0}
                      className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setSubsCurrentPage((p) => p + 1)}
                      disabled={subsCurrentPage >= subsPage.totalPages - 1}
                      className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
