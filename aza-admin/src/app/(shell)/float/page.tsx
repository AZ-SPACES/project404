"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  burnFloat,
  getAgents,
  getCommissionSettlements,
  getFloatMovements,
  mintFloat,
  settleCommission,
  type AgentRecord,
  type CommissionSettlement,
  type FloatMovement,
  type Page,
} from "@/lib/admin-api";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Coins,
  HandCoins,
  Loader2,
} from "lucide-react";

const GHS = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FloatPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AgentRecord | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [movePage, setMovePage] = useState(0);
  const [commAmount, setCommAmount] = useState("");
  const [commReference, setCommReference] = useState("");
  const [settlePage, setSettlePage] = useState(0);

  // Float can only be minted/burned against an ACTIVE agent.
  const { data: agents, isLoading: agentsLoading } = useQuery<Page<AgentRecord>>({
    queryKey: ["agents", "ACTIVE", 0, "float"],
    queryFn: () => getAgents("ACTIVE", 0, 100),
  });

  const { data: movements, isLoading: movesLoading } = useQuery<Page<FloatMovement>>({
    queryKey: ["float-movements", movePage],
    queryFn: () => getFloatMovements(movePage, 20),
  });

  const { data: settlements, isLoading: settlementsLoading } = useQuery<Page<CommissionSettlement>>({
    queryKey: ["commission-settlements", settlePage],
    queryFn: () => getCommissionSettlements(settlePage, 20),
  });

  // Resolve agent ids in the ledger to names where we can (only ACTIVE agents are loaded).
  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    agents?.content.forEach((a) => map.set(a.id, a.userName ?? a.businessName ?? a.code ?? a.id));
    return map;
  }, [agents]);

  const move = useMutation({
    mutationFn: ({ kind }: { kind: "mint" | "burn" }) => {
      const value = Number(amount);
      if (!selected) throw new Error("Select an agent first.");
      if (!value || value <= 0) throw new Error("Enter an amount greater than zero.");
      if (!reference.trim()) throw new Error("A bank reference is required to tie this to the safeguarded account.");
      return kind === "mint"
        ? mintFloat(selected.id, value, reference.trim())
        : burnFloat(selected.id, value, reference.trim());
    },
    onMutate: () => {
      setError("");
      setNotice("");
    },
    onSuccess: (_res, { kind }) => {
      setNotice(
        `${kind === "mint" ? "Mint" : "Burn"} submitted for approval. A second finance/admin officer must confirm it in Approvals before float ${
          kind === "mint" ? "is created" : "is destroyed"
        }.`,
      );
      setAmount("");
      setReference("");
      queryClient.invalidateQueries({ queryKey: ["float-movements"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const settle = useMutation({
    mutationFn: () => {
      const value = Number(commAmount);
      if (!selected) throw new Error("Select an agent first.");
      if (!value || value <= 0) throw new Error("Enter a commission amount greater than zero.");
      if (value > (selected.commissionAccruedGhs ?? 0)) throw new Error("Amount exceeds the agent's accrued commission.");
      if (!commReference.trim()) throw new Error("A bank reference is required for the payout.");
      return settleCommission(selected.id, value, commReference.trim());
    },
    onMutate: () => {
      setError("");
      setNotice("");
    },
    onSuccess: () => {
      setNotice(
        "Commission settlement submitted for approval. A second finance/admin officer must confirm it in Approvals before the accrual is reduced.",
      );
      setCommAmount("");
      setCommReference("");
      queryClient.invalidateQueries({ queryKey: ["commission-settlements"] });
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Agent Float</h1>
        <p className="text-foreground/50 text-sm">
          Mint float into an active agent&apos;s wallet against a verified bank deposit, or burn it when bank money is
          wired out. Both need a second pair of eyes — they only take effect once approved.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-green-400 text-sm mb-6">
          {notice}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {/* Agent picker */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-medium text-foreground/70">Active agents</div>
          {agentsLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !agents || agents.content.length === 0 ? (
            <div className="text-center py-16 text-foreground/30 text-sm">No active agents</div>
          ) : (
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {agents.content.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                    selected?.id === a.id ? "bg-foreground/5" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.userName ?? a.businessName ?? "—"}</p>
                    <p className="text-xs text-foreground/40 truncate">
                      {a.code ?? "—"}
                      {a.userEmail ? ` · ${a.userEmail}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-foreground/70 shrink-0">{GHS.format(a.floatBalance ?? 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mint / burn form */}
        <div className="rounded-xl border border-border p-5">
          {selected ? (
            <>
              <div className="mb-4">
                <p className="text-xs text-foreground/40 uppercase tracking-wide mb-1">Selected agent</p>
                <p className="text-sm font-medium text-foreground">{selected.userName ?? selected.businessName ?? "—"}</p>
                <p className="text-xs text-foreground/50">
                  {selected.code ?? "—"} · current float {GHS.format(selected.floatBalance ?? 0)}
                </p>
              </div>

              <label className="block text-xs text-foreground/60 mb-1">Amount (GHS)</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="w-full mb-3 rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30"
              />

              <label className="block text-xs text-foreground/60 mb-1">Bank reference</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Safeguarded-account statement reference"
                className="w-full mb-4 rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => move.mutate({ kind: "mint" })}
                  disabled={move.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-medium hover:bg-green-500/20 disabled:opacity-30 transition-colors"
                >
                  {move.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
                  Mint float
                </button>
                <button
                  onClick={() => move.mutate({ kind: "burn" })}
                  disabled={move.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-sm font-medium hover:bg-orange-500/20 disabled:opacity-30 transition-colors"
                >
                  {move.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
                  Burn float
                </button>
              </div>

              {/* Commission settlement — pays the agent's accrued commission out of band. */}
              <div className="mt-5 pt-5 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-foreground/60">Commission owed</span>
                  <span className="text-sm font-medium text-foreground">
                    {GHS.format(selected.commissionAccruedGhs ?? 0)}
                  </span>
                </div>
                {(selected.commissionAccruedGhs ?? 0) > 0 ? (
                  <>
                    <input
                      value={commAmount}
                      onChange={(e) => setCommAmount(e.target.value)}
                      inputMode="decimal"
                      placeholder="Amount to settle (GHS)"
                      className="w-full mb-2 rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30"
                    />
                    <input
                      value={commReference}
                      onChange={(e) => setCommReference(e.target.value)}
                      placeholder="Bank disbursement reference"
                      className="w-full mb-3 rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30"
                    />
                    <button
                      onClick={() => settle.mutate()}
                      disabled={settle.isPending}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 text-sm font-medium hover:bg-sky-500/20 disabled:opacity-30 transition-colors"
                    >
                      {settle.isPending ? <Loader2 size={14} className="animate-spin" /> : <HandCoins size={14} />}
                      Settle commission
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-foreground/30">No commission to settle.</p>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-foreground/30">
              <Coins size={32} className="mb-3 opacity-40" />
              <p className="text-sm">Select an agent to mint or burn float</p>
            </div>
          )}
        </div>
      </div>

      {/* Movements ledger */}
      <h2 className="text-sm font-medium text-foreground/70 mb-3">Recent movements</h2>
      {movesLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !movements || movements.content.length === 0 ? (
        <div className="text-center py-16 text-foreground/30 text-sm">No float movements yet</div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {movements.content.map((m) => (
            <div key={m.id} className="px-4 py-3 flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                  m.type === "MINT"
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                }`}
              >
                {m.type === "MINT" ? <ArrowUpCircle size={11} /> : <ArrowDownCircle size={11} />}
                {m.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">
                  {agentNameById.get(m.agentId) ?? `Agent ${m.agentId.slice(0, 8)}`}
                </p>
                {m.bankReference && (
                  <p className="text-xs text-foreground/40 truncate">Ref {m.bankReference}</p>
                )}
              </div>
              <span className="text-sm font-medium text-foreground shrink-0">{GHS.format(m.amount)}</span>
              <span className="text-xs text-foreground/40 shrink-0 w-28 text-right">{fmt(m.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {movements && movements.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-foreground/50 mt-6">
          <button
            onClick={() => setMovePage((p) => Math.max(0, p - 1))}
            disabled={movePage === 0 || movesLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>
            Page {movePage + 1} of {movements.totalPages}
          </span>
          <button
            onClick={() => setMovePage((p) => Math.min(movements.totalPages - 1, p + 1))}
            disabled={movePage >= movements.totalPages - 1 || movesLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Commission settlements ledger */}
      <h2 className="text-sm font-medium text-foreground/70 mb-3 mt-10">Commission settlements</h2>
      {settlementsLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !settlements || settlements.content.length === 0 ? (
        <div className="text-center py-12 text-foreground/30 text-sm">No commission settlements yet</div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {settlements.content.map((s) => (
            <div key={s.id} className="px-4 py-3 flex items-center gap-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-sky-500/10 text-sky-400 border-sky-500/20">
                <HandCoins size={11} />
                PAYOUT
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">
                  {agentNameById.get(s.agentId) ?? `Agent ${s.agentId.slice(0, 8)}`}
                </p>
                {s.bankReference && <p className="text-xs text-foreground/40 truncate">Ref {s.bankReference}</p>}
              </div>
              <span className="text-sm font-medium text-foreground shrink-0">{GHS.format(s.amount)}</span>
              <span className="text-xs text-foreground/40 shrink-0 w-28 text-right">{fmt(s.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {settlements && settlements.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-foreground/50 mt-6">
          <button
            onClick={() => setSettlePage((p) => Math.max(0, p - 1))}
            disabled={settlePage === 0 || settlementsLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>
            Page {settlePage + 1} of {settlements.totalPages}
          </span>
          <button
            onClick={() => setSettlePage((p) => Math.min(settlements.totalPages - 1, p + 1))}
            disabled={settlePage >= settlements.totalPages - 1 || settlementsLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
