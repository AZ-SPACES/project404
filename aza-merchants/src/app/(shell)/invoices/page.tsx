"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getInvoices, createInvoice, sendInvoice, cancelInvoice,
  Invoice, Page,
} from "@/lib/merchant-api";
import {
  Loader2, FileText, Plus, Send, X, ChevronLeft, ChevronRight,
  ExternalLink, Ban,
} from "lucide-react";

function fmt(n: number, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-white/10 text-white/50",
  SENT: "bg-blue-400/10 text-blue-400",
  PAID: "bg-[#10b981]/10 text-[#10b981]",
  CANCELLED: "bg-red-400/10 text-red-400",
  OVERDUE: "bg-amber-400/10 text-amber-400",
};

interface CreateForm {
  customerName: string;
  customerEmail: string;
  amount: string;
  description: string;
  dueDate: string;
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (inv: Invoice) => void }) {
  const [form, setForm] = useState<CreateForm>({
    customerName: "", customerEmail: "", amount: "", description: "", dueDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { setError("Enter a valid amount"); return; }
    setLoading(true);
    setError(null);
    try {
      const inv = await createInvoice({
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        amount,
        description: form.description.trim() || undefined,
        dueDate: form.dueDate || undefined,
      });
      onCreate(inv);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">New Invoice</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-white/40 mb-1.5">Customer Name</label>
              <input
                required
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#10b981]/50"
                placeholder="John Doe"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-white/40 mb-1.5">Customer Email</label>
              <input
                required
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#10b981]/50"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Amount (GHS)</label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#10b981]/50"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#10b981]/50"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-white/40 mb-1.5">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#10b981]/50"
                placeholder="Services rendered"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#0ea472] text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Create Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const [page, setPage] = useState<Page<Invoice> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoices(p, 20);
      setPage(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(currentPage); }, [load, currentPage]);

  async function handleSend(id: string) {
    setActionLoading(id + ":send");
    try {
      const updated = await sendInvoice(id);
      setPage((p) => p ? { ...p, content: p.content.map((inv) => inv.id === id ? updated : inv) } : p);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to send invoice");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this invoice?")) return;
    setActionLoading(id + ":cancel");
    try {
      const updated = await cancelInvoice(id);
      setPage((p) => p ? { ...p, content: p.content.map((inv) => inv.id === id ? updated : inv) } : p);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to cancel invoice");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(inv) => {
            setPage((p) => p ? { ...p, content: [inv, ...p.content], totalElements: p.totalElements + 1 } : p);
            setShowCreate(false);
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Invoices</h1>
          <p className="text-white/40 text-sm mt-0.5">Create and send payment invoices to customers</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#0ea472] text-sm font-semibold text-white rounded-xl transition-colors"
        >
          <Plus size={15} />
          New Invoice
        </button>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-[#10b981]" size={22} />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : !page || page.content.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <FileText size={32} className="text-white/15" />
            <p className="text-white/40 text-sm">No invoices yet</p>
            <button onClick={() => setShowCreate(true)} className="text-sm text-[#10b981] hover:underline">
              Create your first invoice
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">Invoice</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden md:table-cell">Customer</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30">Amount</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-white/30">Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden md:table-cell">Due</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {page.content.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-white font-mono">
                          {inv.referenceId ?? inv.id.slice(0, 8).toUpperCase()}
                        </p>
                        {inv.description && (
                          <p className="text-xs text-white/40 mt-0.5 truncate max-w-xs">{inv.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <p className="text-sm text-white">{inv.customerName}</p>
                        <p className="text-xs text-white/40">{inv.customerEmail}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-medium text-white">
                        {fmt(inv.amount, inv.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[inv.status] ?? "bg-white/10 text-white/50"}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-white/40 hidden md:table-cell">
                        {fmtDate(inv.dueDate)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {inv.checkoutUrl && (
                            <a
                              href={inv.checkoutUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                              title="Open payment link"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          {inv.status === "DRAFT" && (
                            <button
                              onClick={() => handleSend(inv.id)}
                              disabled={actionLoading === inv.id + ":send"}
                              className="p-1.5 rounded-lg text-[#10b981]/70 hover:text-[#10b981] hover:bg-[#10b981]/10 transition-colors disabled:opacity-50"
                              title="Send invoice"
                            >
                              {actionLoading === inv.id + ":send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            </button>
                          )}
                          {(inv.status === "DRAFT" || inv.status === "SENT") && (
                            <button
                              onClick={() => handleCancel(inv.id)}
                              disabled={actionLoading === inv.id + ":cancel"}
                              className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                              title="Cancel invoice"
                            >
                              {actionLoading === inv.id + ":cancel" ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {page.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <p className="text-xs text-white/30">
                  {page.totalElements} invoices · page {page.number + 1} of {page.totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage >= page.totalPages - 1}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
