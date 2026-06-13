"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getReconBreaks,
  getSafeguardingHistory,
  getLedgerCheck,
  importStatement,
  resolveReconBreak,
  takeSafeguardingSnapshot,
  type Page,
  type ReconBreak,
  type SafeguardingSnapshot,
  type LedgerCheck,
} from "@/lib/admin-api";
import { AlertTriangle, CheckCircle2, Landmark, Loader2, Scale, Upload, BookOpen, RefreshCw } from "lucide-react";

function ghs(value: number) {
  return `GHS ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SafeguardingCard() {
  const queryClient = useQueryClient();
  const [bankBalance, setBankBalance] = useState("");
  const [error, setError] = useState("");

  const { data: history, isLoading } = useQuery<Page<SafeguardingSnapshot>>({
    queryKey: ["safeguarding"],
    queryFn: () => getSafeguardingHistory(0, 10),
  });

  const snapshot = useMutation({
    mutationFn: () => takeSafeguardingSnapshot(Number(bankBalance)),
    onSuccess: () => {
      setBankBalance("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["safeguarding"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const latest = history?.content[0];

  return (
    <div className="rounded-xl border border-border p-5 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Landmark size={16} className="text-foreground/40" />
        <h2 className="font-medium text-foreground">Safeguarding check</h2>
      </div>

      {latest && (
        <div
          className={`rounded-lg border px-4 py-3 mb-4 text-sm flex items-center gap-2 ${
            latest.breach
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {latest.breach ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          {latest.breach
            ? `BREACH: float exceeds the safeguarded balance by ${ghs(Math.abs(latest.variance))}`
            : `Fully safeguarded — headroom of ${ghs(latest.variance)}`}
          <span className="text-xs opacity-70 ml-auto">{fmt(latest.createdAt)}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm">
        <div className="rounded-lg bg-muted/20 px-4 py-3">
          <p className="text-xs text-foreground/40 mb-1">Customer float</p>
          <p className="font-medium text-foreground">{latest ? ghs(latest.customerFloat) : "—"}</p>
        </div>
        <div className="rounded-lg bg-muted/20 px-4 py-3">
          <p className="text-xs text-foreground/40 mb-1">Merchant float</p>
          <p className="font-medium text-foreground">{latest ? ghs(latest.merchantFloat) : "—"}</p>
        </div>
        <div className="rounded-lg bg-muted/20 px-4 py-3">
          <p className="text-xs text-foreground/40 mb-1">Safeguarded (bank)</p>
          <p className="font-medium text-foreground">{latest ? ghs(latest.safeguardingBalance) : "—"}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          snapshot.mutate();
        }}
        className="flex gap-2"
      >
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={bankBalance}
          onChange={(e) => setBankBalance(e.target.value)}
          placeholder="Current safeguarding account balance (GHS)"
          className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
        />
        <button
          type="submit"
          disabled={snapshot.isPending || bankBalance === ""}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {snapshot.isPending && <Loader2 size={14} className="animate-spin" />}
          Run check
        </button>
      </form>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      {isLoading && <p className="text-sm text-foreground/40 mt-2">Loading history…</p>}
    </div>
  );
}

function LedgerCheckCard() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<LedgerCheck>({
    queryKey: ["ledgerCheck"],
    queryFn: getLedgerCheck,
  });

  const refresh = useMutation({
    mutationFn: getLedgerCheck,
    onSuccess: (fresh) => {
      queryClient.setQueryData(["ledgerCheck"], fresh);
    },
  });

  return (
    <div className="rounded-xl border border-border p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-foreground/40" />
          <h2 className="font-medium text-foreground">Ledger Check</h2>
        </div>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-xs transition-colors disabled:opacity-50"
        >
          {refresh.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="h-20 bg-muted/20 rounded-lg animate-pulse" />
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-sm">
            <div className="rounded-lg bg-muted/20 px-4 py-3">
              <p className="text-xs text-foreground/40 mb-1">Total Wallet Balance</p>
              <p className="font-medium text-foreground">{ghs(data.totalWalletBalance)}</p>
            </div>
            <div className="rounded-lg bg-muted/20 px-4 py-3">
              <p className="text-xs text-foreground/40 mb-1">Frozen Wallet Balance</p>
              <p className="font-medium text-foreground">{ghs(data.frozenWalletBalance)}</p>
            </div>
            <div className="rounded-lg bg-muted/20 px-4 py-3">
              <p className="text-xs text-foreground/40 mb-1">Completed Transfer Volume</p>
              <p className="font-medium text-foreground">{ghs(data.completedTransferVolume)}</p>
            </div>
          </div>
          <p className="text-xs text-foreground/30">
            Recorded at {fmt(data.recordedAt)}
          </p>
        </>
      ) : (
        <p className="text-sm text-foreground/40">Click Refresh to load ledger data</p>
      )}
    </div>
  );
}

function ImportCard() {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<{ matched: number; breaks: number } | null>(null);
  const [error, setError] = useState("");

  const doImport = useMutation({
    mutationFn: () => importStatement(label, csv),
    onSuccess: (res) => {
      setResult(res);
      setError("");
      setCsv("");
      queryClient.invalidateQueries({ queryKey: ["reconBreaks"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-xl border border-border p-5 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Upload size={16} className="text-foreground/40" />
        <h2 className="font-medium text-foreground">Import rail statement</h2>
      </div>
      <p className="text-xs text-foreground/40 mb-4">
        CSV lines: <code className="text-foreground/60">reference,amount,direction</code> (direction CREDIT or
        DEBIT). Lines that don&apos;t match an internal transaction become breaks below.
      </p>
      <div className="space-y-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='Statement label, e.g. "MTN MoMo 2026-06-10"'
          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
        />
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={4}
          placeholder="reference,amount,direction"
          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono outline-none focus:border-foreground/30 transition-colors"
        />
        <button
          onClick={() => doImport.mutate()}
          disabled={doImport.isPending || !label || !csv}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted text-sm disabled:opacity-30 transition-colors"
        >
          {doImport.isPending && <Loader2 size={14} className="animate-spin" />}
          Reconcile
        </button>
        {result && (
          <p className="text-sm text-emerald-400">
            {result.matched} matched · {result.breaks} break{result.breaks === 1 ? "" : "s"} queued
          </p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}

export default function ReconciliationPage() {
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const { data: breaks, isLoading } = useQuery<Page<ReconBreak>>({
    queryKey: ["reconBreaks"],
    queryFn: () => getReconBreaks("OPEN", 0, 50),
  });

  const resolve = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => resolveReconBreak(id, note),
    onSuccess: () => {
      setResolving(null);
      setNotes("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["reconBreaks"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Reconciliation</h1>
        <p className="text-foreground/50 text-sm">
          Daily float-vs-safeguarding check and external statement matching.
        </p>
      </div>

      <SafeguardingCard />
      <LedgerCheckCard />
      <ImportCard />

      <div className="flex items-center gap-2 mb-4">
        <Scale size={16} className="text-foreground/40" />
        <h2 className="font-medium text-foreground">Open breaks</h2>
        {breaks && <span className="text-xs text-foreground/40">({breaks.totalElements})</span>}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="h-24 bg-muted/30 rounded-xl animate-pulse" />
      ) : !breaks || breaks.content.length === 0 ? (
        <div className="text-center py-16 text-foreground/30 rounded-xl border border-border">
          <CheckCircle2 size={32} className="mx-auto mb-3 opacity-40" />
          <p>No open breaks — fully reconciled</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {breaks.content.map((b) => (
            <div key={b.id} className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {b.statementReference}{" "}
                    <span className="text-xs font-normal text-foreground/40">({b.importLabel})</span>
                  </p>
                  <p className="text-xs text-foreground/50 mt-0.5">
                    {b.direction} {ghs(b.statementAmount)} ·{" "}
                    {b.reason === "NO_MATCH"
                      ? "no matching internal transaction"
                      : `internal amount ${b.internalAmount != null ? ghs(b.internalAmount) : "—"} differs`}
                  </p>
                </div>
                <button
                  onClick={() => setResolving(resolving === b.id ? null : b.id)}
                  className="px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-xs transition-colors flex-shrink-0"
                >
                  Resolve
                </button>
              </div>
              {resolving === b.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    resolve.mutate({ id: b.id, note: notes });
                  }}
                  className="flex gap-2 mt-3"
                >
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    required
                    autoFocus
                    placeholder="Resolution notes (required)"
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={resolve.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    {resolve.isPending && <Loader2 size={14} className="animate-spin" />}
                    Save
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
