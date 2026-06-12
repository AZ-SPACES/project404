"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addWatchlistEntry,
  deactivateWatchlistEntry,
  getScreeningMatches,
  getScreeningStats,
  getWatchlist,
  importWatchlist,
  reviewScreeningMatch,
  runScreening,
  type Page,
  type ScreeningMatch,
  type WatchlistEntry,
} from "@/lib/admin-api";
import { Check, Loader2, Play, Plus, ShieldAlert, Upload, X } from "lucide-react";

const SCORE_STYLE = (score: number) =>
  score >= 100
    ? "bg-red-500/10 text-red-400 border-red-500/20"
    : score >= 85
      ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
      : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";

function MatchQueue() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const { data: matches, isLoading } = useQuery<Page<ScreeningMatch>>({
    queryKey: ["screeningMatches"],
    queryFn: () => getScreeningMatches("PENDING_REVIEW", 0, 50),
  });

  const review = useMutation({
    mutationFn: ({ id, confirmed }: { id: string; confirmed: boolean }) =>
      reviewScreeningMatch(id, confirmed),
    onMutate: ({ id, confirmed }) => setActing(`${id}:${confirmed}`),
    onSettled: () => setActing(null),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["screeningMatches"] });
      queryClient.invalidateQueries({ queryKey: ["screeningStats"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-xl border border-border p-5 mb-6">
      <h2 className="font-medium text-foreground mb-1">Pending matches</h2>
      <p className="text-xs text-foreground/40 mb-4">
        Confirming a match raises a CRITICAL risk alert. Most name hits are false positives — check
        date of birth and nationality before confirming.
      </p>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {isLoading ? (
        <div className="h-20 bg-muted/30 rounded-xl animate-pulse" />
      ) : !matches || matches.content.length === 0 ? (
        <p className="text-sm text-foreground/40 py-6 text-center">No matches pending review.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {matches.content.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${SCORE_STYLE(m.matchScore)}`}
              >
                {m.matchScore}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium truncate">
                  {m.userName ?? m.userId}{" "}
                  <span className="text-foreground/40 font-normal">↔</span> {m.listEntryName}
                </p>
                <p className="text-xs text-foreground/40 truncate">
                  {m.listName} · {m.entryType} · {m.userEmail}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => review.mutate({ id: m.id, confirmed: true })}
                  disabled={review.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 disabled:opacity-30 transition-colors"
                >
                  {acting === `${m.id}:true` ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Confirm
                </button>
                <button
                  onClick={() => review.mutate({ id: m.id, confirmed: false })}
                  disabled={review.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/30 text-foreground/60 text-xs hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  {acting === `${m.id}:false` ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                  False positive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WatchlistManager() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"none" | "add" | "import">("none");
  const [listName, setListName] = useState("");
  const [fullName, setFullName] = useState("");
  const [entryType, setEntryType] = useState("SANCTION");
  const [country, setCountry] = useState("");
  const [csv, setCsv] = useState("");
  const [error, setError] = useState("");

  const { data: entries } = useQuery<WatchlistEntry[]>({
    queryKey: ["watchlist"],
    queryFn: getWatchlist,
  });

  function done() {
    setMode("none");
    setListName("");
    setFullName("");
    setCountry("");
    setCsv("");
    setError("");
    queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    queryClient.invalidateQueries({ queryKey: ["screeningStats"] });
  }

  const add = useMutation({
    mutationFn: () => addWatchlistEntry({ listName, fullName, entryType, country: country || undefined }),
    onSuccess: done,
    onError: (e: Error) => setError(e.message),
  });

  const doImport = useMutation({
    mutationFn: () => importWatchlist(csv),
    onSuccess: done,
    onError: (e: Error) => setError(e.message),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateWatchlistEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const active = entries?.filter((e) => e.active) ?? [];

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-medium text-foreground">Watchlist</h2>
          <p className="text-xs text-foreground/40">{active.length} active entries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode(mode === "add" ? "none" : "add")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-xs transition-colors"
          >
            <Plus size={12} /> Add entry
          </button>
          <button
            onClick={() => setMode(mode === "import" ? "none" : "import")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-xs transition-colors"
          >
            <Upload size={12} /> Import CSV
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {mode === "add" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4"
        >
          <input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            required
            placeholder="List (e.g. UN, OFAC, GH-PEP)"
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
          />
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Full name"
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
          />
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value)}
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
          >
            <option value="SANCTION">SANCTION</option>
            <option value="PEP">PEP</option>
          </select>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country (optional)"
            className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
          />
          <button
            type="submit"
            disabled={add.isPending}
            className="sm:col-span-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {add.isPending && <Loader2 size={14} className="animate-spin" />}
            Add to watchlist
          </button>
        </form>
      )}

      {mode === "import" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            doImport.mutate();
          }}
          className="space-y-2 mb-4"
        >
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={4}
            required
            placeholder="listName,fullName,type,country"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono outline-none focus:border-foreground/30"
          />
          <button
            type="submit"
            disabled={doImport.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {doImport.isPending && <Loader2 size={14} className="animate-spin" />}
            Import
          </button>
        </form>
      )}

      {active.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden max-h-72 overflow-y-auto">
          {active.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{entry.fullName}</p>
                <p className="text-xs text-foreground/40">
                  {entry.listName} · {entry.entryType}
                  {entry.country ? ` · ${entry.country}` : ""}
                </p>
              </div>
              <button
                onClick={() => deactivate.mutate(entry.id)}
                title="Deactivate entry"
                className="text-foreground/30 hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScreeningPage() {
  const queryClient = useQueryClient();
  const [runResult, setRunResult] = useState<number | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["screeningStats"],
    queryFn: getScreeningStats,
  });

  const run = useMutation({
    mutationFn: runScreening,
    onSuccess: (res) => {
      setRunResult(res.newMatches);
      queryClient.invalidateQueries({ queryKey: ["screeningMatches"] });
      queryClient.invalidateQueries({ queryKey: ["screeningStats"] });
    },
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Sanctions Screening</h1>
          <p className="text-foreground/50 text-sm">
            Users are screened against the watchlist daily at 02:20; run on demand after list updates.
            {stats && <> {stats.pendingMatches} pending · {stats.activeListEntries} active entries.</>}
          </p>
        </div>
        <button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {run.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Run screening
        </button>
      </div>

      {runResult !== null && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-emerald-400 text-sm mb-6 flex items-center gap-2">
          <ShieldAlert size={15} />
          Screening complete — {runResult} new match{runResult === 1 ? "" : "es"} raised.
        </div>
      )}

      <MatchQueue />
      <WatchlistManager />
    </div>
  );
}
