"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  downloadAccountingJournal,
  downloadMonthlyReturns,
  downloadStrExport,
  getFlaggedTransactions,
  getStoredRoles,
  hasRole,
  type FlaggedTransaction,
  type Page,
} from "@/lib/admin-api";
import { Download, FileText, Loader2, ShieldCheck } from "lucide-react";

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
  const roles = getStoredRoles();
  const showCompliance = roles.length === 0 || hasRole(roles, ["COMPLIANCE"]);
  const showFinance = roles.length === 0 || hasRole(roles, ["FINANCE"]);

  const [month, setMonth] = useState(lastMonth());
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

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
    </div>
  );
}
