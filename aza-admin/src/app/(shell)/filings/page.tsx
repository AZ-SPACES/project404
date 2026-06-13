"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  downloadAccountingJournal,
  downloadMonthlyReturns,
  downloadStrExport,
  getFlaggedTransactions,
  getRegulatoryFilings,
  markFiled,
  getStoredRoles,
  hasRole,
  type FlaggedTransaction,
  type Page,
  type RegulatoryFilingRecord,
} from "@/lib/admin-api";
import { Download, FileText, Loader2, ShieldCheck, CalendarCheck, Plus } from "lucide-react";

function lastMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FilingsPage() {
  const queryClient = useQueryClient();
  const roles = getStoredRoles();
  const showCompliance = roles.length === 0 || hasRole(roles, ["COMPLIANCE"]);
  const showFinance = roles.length === 0 || hasRole(roles, ["FINANCE"]);

  const [month, setMonth] = useState(lastMonth());
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Filing calendar state
  const [calendarType, setCalendarType] = useState("");
  const [showMarkForm, setShowMarkForm] = useState(false);
  const [markType, setMarkType] = useState("BOG_MONTHLY_RETURNS");
  const [markPeriod, setMarkPeriod] = useState(lastMonth());
  const [markNotes, setMarkNotes] = useState("");
  const [markError, setMarkError] = useState("");

  const { data: filings } = useQuery<RegulatoryFilingRecord[]>({
    queryKey: ["regulatoryFilings", calendarType],
    queryFn: () => getRegulatoryFilings(calendarType || undefined),
  });

  const markFiledMutation = useMutation({
    mutationFn: () => markFiled({ type: markType, period: markPeriod, notes: markNotes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regulatoryFilings"] });
      setShowMarkForm(false);
      setMarkNotes("");
      setMarkError("");
    },
    onError: (e: Error) => setMarkError(e.message),
  });

  const { data: flagged } = useQuery<Page<FlaggedTransaction>>({
    queryKey: ["flaggedForStr"],
    queryFn: () => getFlaggedTransactions(0, 20, "PENDING_REVIEW"),
    enabled: showCompliance,
  });

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Filings &amp; Exports</h1>
        <p className="text-foreground/50 text-sm">
          Regulatory returns, STR exports, and accounting journals. Every export is audit-logged.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {showCompliance && (
        <div className="rounded-xl border border-border p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={16} className="text-foreground/40" />
            <h2 className="font-medium text-foreground">BoG monthly returns</h2>
          </div>
          <p className="text-xs text-foreground/40 mb-4">
            Accounts, volumes, float, complaints, and STR counts for the period, as CSV.
          </p>
          <div className="flex gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
            />
            <button
              onClick={() => run("returns", () => downloadMonthlyReturns(month))}
              disabled={busy !== null || !month}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {busy === "returns" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download returns
            </button>
          </div>
        </div>
      )}

      {showFinance && (
        <div className="rounded-xl border border-border p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Download size={16} className="text-foreground/40" />
            <h2 className="font-medium text-foreground">Accounting journal</h2>
          </div>
          <p className="text-xs text-foreground/40 mb-4">
            Double-entry CSV of fee revenue, merchant credits, and payouts for the accountants.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
            />
            <span className="text-foreground/40 text-sm">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
            />
            <button
              onClick={() => run("journal", () => downloadAccountingJournal(from, to))}
              disabled={busy !== null || !from || !to}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {busy === "journal" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Download journal
            </button>
          </div>
        </div>
      )}

      {showCompliance && (
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-foreground/40" />
            <h2 className="font-medium text-foreground">STR exports</h2>
          </div>
          <p className="text-xs text-foreground/40 mb-4">
            goAML-style XML per flagged transaction, for filing with the FIC. Flags pending review are listed;
            mark them REPORTED in Compliance after filing.
          </p>
          {!flagged || flagged.content.length === 0 ? (
            <p className="text-sm text-foreground/40">No flagged transactions pending review.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {flagged.content.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">
                      {f.userName} — GHS {Number(f.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-foreground/40 truncate">
                      {f.flagReason} · risk {f.riskScore}
                    </p>
                  </div>
                  <button
                    onClick={() => run(`str-${f.id}`, () => downloadStrExport(f.id))}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-xs disabled:opacity-30 transition-colors flex-shrink-0"
                  >
                    {busy === `str-${f.id}` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                    STR XML
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Filing Calendar ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <CalendarCheck size={16} className="text-foreground/40" />
            <h2 className="font-medium text-foreground">Filing Calendar</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={calendarType}
              onChange={(e) => setCalendarType(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs outline-none"
            >
              <option value="">All types</option>
              <option value="BOG_MONTHLY_RETURNS">BoG Monthly Returns</option>
              <option value="STR_BATCH">STR Batch</option>
              <option value="ACCOUNTING_JOURNAL">Accounting Journal</option>
            </select>
            <button
              onClick={() => setShowMarkForm(f => !f)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-xs transition-colors"
            >
              <Plus size={12} />
              Mark as filed
            </button>
          </div>
        </div>

        {showMarkForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); markFiledMutation.mutate(); }}
            className="bg-muted/20 border border-border rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <div>
              <label className="text-xs text-foreground/40 block mb-1">Filing type</label>
              <select
                value={markType}
                onChange={(e) => setMarkType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
              >
                <option value="BOG_MONTHLY_RETURNS">BoG Monthly Returns</option>
                <option value="STR_BATCH">STR Batch</option>
                <option value="ACCOUNTING_JOURNAL">Accounting Journal</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-foreground/40 block mb-1">Period (e.g. 2026-05)</label>
              <input
                value={markPeriod}
                onChange={(e) => setMarkPeriod(e.target.value)}
                placeholder="2026-05"
                required
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
              />
            </div>
            <div>
              <label className="text-xs text-foreground/40 block mb-1">Notes (optional)</label>
              <input
                value={markNotes}
                onChange={(e) => setMarkNotes(e.target.value)}
                placeholder="Reference number, etc."
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
              />
            </div>
            {markError && <p className="text-xs text-red-400 sm:col-span-3">{markError}</p>}
            <div className="sm:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={markFiledMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {markFiledMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Save filing record
              </button>
              <button type="button" onClick={() => setShowMarkForm(false)} className="px-4 py-2 rounded-lg bg-muted/30 text-sm text-foreground/50 hover:text-foreground">
                Cancel
              </button>
            </div>
          </form>
        )}

        {!filings || filings.length === 0 ? (
          <p className="text-sm text-foreground/40 py-4 text-center">No filing records yet. Use &quot;Mark as filed&quot; after each submission.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {filings.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <CalendarCheck size={14} className="text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium">
                    {f.type === "BOG_MONTHLY_RETURNS" ? "BoG Monthly Returns" : f.type === "STR_BATCH" ? "STR Batch" : "Accounting Journal"}{" "}
                    — {f.period}
                  </p>
                  <p className="text-xs text-foreground/40">
                    Filed by {f.filedByEmail} · {new Date(f.filedAt).toLocaleDateString()}
                    {f.notes && ` · ${f.notes}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
