"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getBulkTransfers, getBulkTransfer, createBulkTransfer,
  BulkTransfer, BulkTransferDetail, Page,
} from "@/lib/merchant-api";
import {
  Loader2, SendHorizonal, Plus, X, ArrowUpRight,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock,
} from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(n);
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-[#B7EE7A]/10 text-[#B7EE7A]",
  PARTIALLY_COMPLETED: "bg-amber-400/10 text-amber-400",
  FAILED: "bg-red-400/10 text-red-400",
  PROCESSING: "bg-blue-400/10 text-blue-400",
  PENDING: "bg-white/10 text-white/40",
};

const ITEM_STATUS_ICON: Record<string, React.ElementType> = {
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
  PENDING: Clock,
};

interface RecipientRow { id: number; identifier: string; amount: string; note: string; }

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<BulkTransferDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBulkTransfer(id).then(setDetail).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
          <div>
            <p className="text-xs text-white/30 font-mono">{id}</p>
            <p className="text-sm font-semibold text-white mt-0.5">Bulk Transfer Detail</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#B7EE7A]" size={22} /></div>
        ) : !detail ? (
          <div className="flex items-center justify-center h-48"><p className="text-white/40 text-sm">Failed to load</p></div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="px-6 py-5 grid grid-cols-3 gap-4 border-b border-white/5">
              <div><p className="text-xs text-white/30 mb-1">Total</p><p className="text-base font-bold text-white">{fmt(detail.totalAmount)}</p></div>
              <div><p className="text-xs text-white/30 mb-1">Succeeded</p><p className="text-base font-bold text-[#B7EE7A]">{detail.successCount}</p></div>
              <div><p className="text-xs text-white/30 mb-1">Failed</p><p className="text-base font-bold text-red-400">{detail.failureCount}</p></div>
            </div>
            <div className="px-6 py-4 space-y-2 text-sm border-b border-white/5">
              {detail.note && <div className="flex justify-between"><span className="text-white/35">Note</span><span className="text-white/70">{detail.note}</span></div>}
              <div className="flex justify-between"><span className="text-white/35">Status</span><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[detail.status] ?? ""}`}>{detail.status.replace(/_/g, " ")}</span></div>
              <div className="flex justify-between"><span className="text-white/35">Processed</span><span className="text-white/70">{fmtDate(detail.processedAt)}</span></div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {detail.items.map((item) => {
                const Icon = ITEM_STATUS_ICON[item.status] ?? Clock;
                return (
                  <div key={item.id} className="px-6 py-3 flex items-center gap-3">
                    <Icon size={14} className={item.status === "COMPLETED" ? "text-[#B7EE7A]" : item.status === "FAILED" ? "text-red-400" : "text-white/30"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.recipientIdentifier}</p>
                      {item.failureReason && <p className="text-xs text-red-400/70 mt-0.5">{item.failureReason}</p>}
                      {item.note && <p className="text-xs text-white/30 mt-0.5">{item.note}</p>}
                    </div>
                    <span className="text-sm font-medium text-white flex-shrink-0">{fmt(item.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (bt: BulkTransfer) => void }) {
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<RecipientRow[]>([{ id: 1, identifier: "", amount: "", note: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let nextId = rows.length + 1;

  function addRow() { setRows((r) => [...r, { id: nextId++, identifier: "", amount: "", note: "" }]); }
  function removeRow(id: number) { setRows((r) => r.filter((row) => row.id !== id)); }
  function updateRow(id: number, field: keyof RecipientRow, value: string) {
    setRows((r) => r.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = rows.map((r) => ({ recipientIdentifier: r.identifier.trim(), amount: parseFloat(r.amount), note: r.note.trim() || undefined }));
    if (items.some((i) => !i.recipientIdentifier)) { setError("All rows need a recipient"); return; }
    if (items.some((i) => isNaN(i.amount) || i.amount <= 0)) { setError("All amounts must be positive"); return; }
    setLoading(true);
    setError(null);
    try {
      const bt = await createBulkTransfer({ note: note.trim() || undefined, items });
      onCreate(bt);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create transfer");
    } finally {
      setLoading(false);
    }
  }

  const total = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
          <h2 className="text-base font-bold text-white">New Bulk Transfer</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
            <label className="block text-xs text-white/40 mb-1.5">Batch note <span className="text-white/20">(optional)</span></label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#B7EE7A]/50"
              placeholder="May payroll, vendor payments…"
            />
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4">
            <div className="grid grid-cols-[1fr_120px_1fr_32px] gap-2 mb-2">
              <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider">Recipient (email/username)</p>
              <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider">Amount (GHS)</p>
              <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider">Note</p>
              <div />
            </div>
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_120px_1fr_32px] gap-2 items-center">
                  <input
                    required
                    value={row.identifier}
                    onChange={(e) => updateRow(row.id, "identifier", e.target.value)}
                    className="bg-black/30 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#B7EE7A]/50"
                    placeholder="user@email.com"
                  />
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                    className="bg-black/30 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#B7EE7A]/50"
                    placeholder="0.00"
                  />
                  <input
                    value={row.note}
                    onChange={(e) => updateRow(row.id, "note", e.target.value)}
                    className="bg-black/30 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#B7EE7A]/50"
                    placeholder="Optional"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    className="p-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-20 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              disabled={rows.length >= 100}
              className="mt-3 flex items-center gap-2 text-xs text-[#B7EE7A]/70 hover:text-[#B7EE7A] transition-colors disabled:opacity-30"
            >
              <Plus size={13} />
              Add recipient ({rows.length}/100)
            </button>
          </div>

          <div className="px-6 py-4 border-t border-white/5 flex-shrink-0">
            {error && <p className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-xl px-3 py-2 mb-3">{error}</p>}
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/50">
                Total: <span className="font-semibold text-white">{fmt(total)}</span>
                <span className="text-white/30"> ({rows.length} recipients)</span>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-white transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <SendHorizonal size={14} />}
                  Send transfers
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BulkTransfersPage() {
  const [page, setPage] = useState<Page<BulkTransfer> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try { setPage(await getBulkTransfers(p, 20)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(currentPage); }, [load, currentPage]);

  return (
    <div className="space-y-6">
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(bt) => { setPage((p) => p ? { ...p, content: [bt, ...p.content], totalElements: p.totalElements + 1 } : p); setShowCreate(false); }}
        />
      )}
      {selectedId && <DetailModal id={selectedId} onClose={() => setSelectedId(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Bulk Transfers</h1>
          <p className="text-white/40 text-sm mt-0.5">Pay multiple recipients in one action</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-white rounded-xl transition-colors"
        >
          <Plus size={15} />
          New Bulk Transfer
        </button>
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#B7EE7A]" size={22} /></div>
        ) : error ? (
          <div className="flex items-center justify-center h-48"><p className="text-red-400 text-sm">{error}</p></div>
        ) : !page || page.content.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <SendHorizonal size={32} className="text-white/15" />
            <p className="text-white/40 text-sm">No bulk transfers yet</p>
            <button onClick={() => setShowCreate(true)} className="text-sm text-[#B7EE7A] hover:underline">Send your first batch</button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-white/30">Transfer</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30">Total</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden md:table-cell">Recipients</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-white/30">Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-white/30 hidden md:table-cell">Date</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {page.content.map((bt) => (
                    <tr key={bt.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-mono text-white/50">{bt.id.slice(0, 8).toUpperCase()}</p>
                        {bt.note && <p className="text-xs text-white/40 mt-0.5 truncate max-w-xs">{bt.note}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-white">{fmt(bt.totalAmount)}</td>
                      <td className="px-5 py-3.5 text-center text-xs text-white/50 hidden md:table-cell">
                        <span className="text-[#B7EE7A]">{bt.successCount}</span>
                        {bt.failureCount > 0 && <span className="text-red-400"> / {bt.failureCount} failed</span>}
                        <span className="text-white/30"> of {bt.recipientCount}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[bt.status] ?? "bg-white/10 text-white/40"}`}>
                          {bt.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-white/40 hidden md:table-cell">{fmtDate(bt.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => setSelectedId(bt.id)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors" title="View detail">
                          <ArrowUpRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {page.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <p className="text-xs text-white/30">{page.totalElements} batches · page {page.number + 1} of {page.totalPages}</p>
                <div className="flex gap-1">
                  <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                  <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= page.totalPages - 1} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
