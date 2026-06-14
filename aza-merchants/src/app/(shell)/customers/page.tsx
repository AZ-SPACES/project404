"use client";

import { useEffect, useState, useCallback } from "react";
import { getCustomers, getCustomerSessions, Customer, Page, CheckoutSession } from "@/lib/merchant-api";
import { Loader2, Users, ChevronLeft, ChevronRight, Search, Download, X, ArrowUpDown, CheckCircle2, Clock, XCircle, Ban, RotateCcw } from "lucide-react";

function fmtGHS(n: number) {
  return `GH₵ ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

type SortKey = "totalSpend" | "totalPayments" | "lastPaymentAt" | "firstPaymentAt";

const STATUS_ICON: Record<string, React.ElementType> = {
  COMPLETED: CheckCircle2,
  PENDING: Clock,
  CANCELLED: XCircle,
  EXPIRED: Ban,
  REFUNDED: RotateCcw,
};

const STATUS_CLS: Record<string, string> = {
  COMPLETED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  PENDING: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  CANCELLED: "text-red-400 bg-red-500/10 border-red-500/20",
  EXPIRED: "text-foreground/30 bg-muted/30 border-border",
  REFUNDED: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

function exportCsv(customers: Customer[]) {
  const header = ["Name", "Email", "Phone", "Payments", "Total Spend (GHS)", "First Payment", "Last Payment"];
  const rows = customers.map((c) => [
    c.name,
    c.email ?? "",
    c.phone ?? "",
    c.totalPayments,
    c.totalSpend,
    c.firstPaymentAt ?? "",
    c.lastPaymentAt ?? "",
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Customer detail drawer ────────────────────────────────────────────────────

function CustomerDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [sessions, setSessions] = useState<Page<CheckoutSession> | null>(null);
  const [sessPage, setSessPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await getCustomerSessions(customer.id, p, 10);
      setSessions(data);
      setSessPage(p);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [customer.id]);

  useEffect(() => { load(0); }, [load]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-md bg-card border-l border-border flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#B7EE7A]/15 border border-[#B7EE7A]/25 flex items-center justify-center">
              <span className="text-xs font-bold text-[#B7EE7A]">{initials(customer.name)}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{customer.name}</p>
              <p className="text-xs text-foreground/40">{customer.email || customer.phone || "No contact info"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border flex-shrink-0">
          {[
            { label: "Payments", value: customer.totalPayments.toString() },
            { label: "Total spend", value: fmtGHS(customer.totalSpend) },
            { label: "Since", value: fmtDate(customer.firstPaymentAt) },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3 text-center">
              <p className="text-[10px] text-foreground/35 uppercase tracking-wider">{label}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5 font-mono">{value}</p>
            </div>
          ))}
        </div>

        {/* Transaction history */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Transaction history</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin text-[#B7EE7A]" size={20} />
            </div>
          ) : !sessions || sessions.content.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-foreground/30">No transactions found</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {sessions.content.map((s) => {
                const StatusIcon = STATUS_ICON[s.status] ?? Clock;
                const cls = STATUS_CLS[s.status] ?? STATUS_CLS.PENDING;
                return (
                  <div key={s.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-muted/10 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{s.description || "Payment"}</p>
                      <p className="text-[10px] text-foreground/35 mt-0.5">{fmtDateTime(s.completedAt ?? s.createdAt)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground font-mono">{fmtGHS(s.amount)}</p>
                      <span className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
                        <StatusIcon size={9} />
                        {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {sessions && sessions.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <p className="text-xs text-foreground/30">{sessPage + 1} / {sessions.totalPages}</p>
              <div className="flex gap-1">
                <button onClick={() => load(sessPage - 1)} disabled={sessPage === 0} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => load(sessPage + 1)} disabled={sessPage >= sessions.totalPages - 1} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [page, setPage] = useState<Page<Customer> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalSpend");
  const [selected, setSelected] = useState<Customer | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCustomers(p, 50);
      setPage(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(currentPage); }, [load, currentPage]);

  const filtered = (page?.content ?? [])
    .filter((c) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.name.toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s) || (c.phone ?? "").includes(s);
    })
    .sort((a, b) => {
      if (sortKey === "totalSpend") return b.totalSpend - a.totalSpend;
      if (sortKey === "totalPayments") return b.totalPayments - a.totalPayments;
      if (sortKey === "lastPaymentAt") return (b.lastPaymentAt ?? "").localeCompare(a.lastPaymentAt ?? "");
      if (sortKey === "firstPaymentAt") return (b.firstPaymentAt ?? "").localeCompare(a.firstPaymentAt ?? "");
      return 0;
    });

  return (
    <>
      {selected && <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />}

      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Customers</h1>
            <p className="text-foreground/40 text-sm mt-0.5">
              {page ? `${page.totalElements.toLocaleString()} unique customers` : "Customers who have paid you at least once"}
            </p>
          </div>
          {page && page.content.length > 0 && (
            <button
              onClick={() => exportCsv(page.content)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/30 border border-border text-sm text-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors flex-shrink-0"
            >
              <Download size={14} />
              Export CSV
            </button>
          )}
        </div>

        {/* Search + Sort */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
              className="w-full pl-8 pr-3 py-2 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[#B7EE7A]/60 transition-all"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={13} className="text-foreground/30" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="px-2.5 py-2 bg-muted/30 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-[#B7EE7A]/60 transition-all"
            >
              <option value="totalSpend">Sort: Top spend</option>
              <option value="totalPayments">Sort: Most payments</option>
              <option value="lastPaymentAt">Sort: Recent</option>
              <option value="firstPaymentAt">Sort: Oldest</option>
            </select>
          </div>
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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Users size={32} className="text-foreground/15" />
              <p className="text-foreground/40 text-sm">{search ? "No customers match your search" : "No customers yet"}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Customer</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Payments</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Total Spend</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">First Payment</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">Last Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className="hover:bg-muted/10 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#B7EE7A]/15 border border-[#B7EE7A]/25 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-[#B7EE7A]">{initials(c.name)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{c.name}</p>
                              {c.email && <p className="text-xs text-foreground/40">{c.email}</p>}
                              {c.phone && !c.email && <p className="text-xs text-foreground/40">{c.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm text-foreground/70">{c.totalPayments}</td>
                        <td className="px-5 py-3.5 text-right text-sm font-medium text-foreground">{fmtGHS(c.totalSpend)}</td>
                        <td className="px-5 py-3.5 text-right text-xs text-foreground/40 hidden md:table-cell">{fmtDate(c.firstPaymentAt)}</td>
                        <td className="px-5 py-3.5 text-right text-xs text-foreground/40 hidden md:table-cell">{fmtDate(c.lastPaymentAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {page && page.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <p className="text-xs text-foreground/30">
                    {page.totalElements} customers · page {page.number + 1} of {page.totalPages}
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= page.totalPages - 1} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
