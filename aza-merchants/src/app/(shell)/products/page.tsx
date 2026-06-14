"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getProducts, createProduct, updateProduct, deleteProduct,
  MerchantProduct, Page,
} from "@/lib/merchant-api";
import {
  Loader2, Package, Plus, Pencil, Trash2, X, Save, Archive,
  ArchiveRestore, Search, Download,
} from "lucide-react";

function fmtGHS(n: number) {
  return `GH₵ ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const inputCls = "w-full px-3.5 py-2.5 bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#B7EE7A]/60 text-sm transition-all";

// ─── Product form modal ────────────────────────────────────────────────────────

function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product?: MerchantProduct;
  onClose: () => void;
  onSaved: (p: MerchantProduct) => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price ? String(product.price) : "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) { setError("Enter a valid price"); return; }
    setError(null);
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: priceNum,
        sku: sku.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      };
      const saved = isEdit
        ? await updateProduct(product!.id, data)
        : await createProduct(data);
      onSaved(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">{isEdit ? "Edit product" : "New product"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-foreground/30 hover:text-foreground hover:bg-muted/40 transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-1.5">Product name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basic Package" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-1.5">Price (GHS) *</label>
            <input type="number" step="0.01" min="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/50 mb-1.5">Description <span className="text-foreground/25 font-normal">optional</span></label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this product include?" className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground/50 mb-1.5">SKU <span className="text-foreground/25 font-normal">optional</span></label>
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. PKG-001" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground/50 mb-1.5">Image URL <span className="text-foreground/25 font-normal">optional</span></label>
              <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-foreground/50 hover:text-foreground transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] disabled:opacity-50 text-foreground font-semibold text-sm transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function exportCsv(products: MerchantProduct[]) {
  const header = ["ID", "Name", "SKU", "Price (GHS)", "Description", "Active", "Created"];
  const rows = products.map((p) => [
    p.id, p.name, p.sku ?? "", p.price, p.description ?? "", p.active, p.createdAt,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [page, setPage] = useState<Page<MerchantProduct> | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MerchantProduct | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async (p: number, archived: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProducts(p, 30, archived ? undefined : true);
      setPage(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(currentPage, showArchived); }, [load, currentPage, showArchived]);

  function handleSaved(saved: MerchantProduct) {
    if (editing) {
      setPage((prev) => prev ? { ...prev, content: prev.content.map((p) => p.id === saved.id ? saved : p) } : prev);
    } else {
      load(0, showArchived);
    }
    setShowModal(false);
    setEditing(null);
  }

  async function handleToggleActive(product: MerchantProduct) {
    try {
      const updated = await updateProduct(product.id, { active: !product.active });
      setPage((prev) => prev ? { ...prev, content: prev.content.map((p) => p.id === updated.id ? updated : p) } : prev);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function handleDelete(product: MerchantProduct) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct(product.id);
      load(currentPage, showArchived);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const filtered = (page?.content ?? []).filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s) || (p.description ?? "").toLowerCase().includes(s);
  });

  return (
    <>
      {(showModal || editing) && (
        <ProductModal
          product={editing ?? undefined}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Products</h1>
            <p className="text-foreground/40 text-sm mt-0.5">
              {page ? `${page.totalElements} product${page.totalElements !== 1 ? "s" : ""}` : "Reusable product catalog"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {page && page.content.length > 0 && (
              <button
                onClick={() => exportCsv(page.content)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/30 border border-border text-sm text-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <Download size={14} />
                Export
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-foreground font-semibold text-sm transition-colors"
            >
              <Plus size={15} />
              New product
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, SKU…"
              className="w-full pl-8 pr-3 py-2 bg-muted/30 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[#B7EE7A]/60 transition-all"
            />
          </div>
          <button
            onClick={() => { setShowArchived(!showArchived); setCurrentPage(0); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              showArchived
                ? "bg-muted/40 border-border text-foreground"
                : "bg-transparent border-border text-foreground/40 hover:text-foreground"
            }`}
          >
            <Archive size={12} />
            {showArchived ? "All products" : "Show archived"}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="animate-spin text-[#B7EE7A]" size={22} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Package size={32} className="text-foreground/15" />
              <p className="text-foreground/40 text-sm">
                {search ? "No products match your search" : "No products yet — create your first one"}
              </p>
              {!search && (
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-foreground font-semibold text-sm transition-colors"
                >
                  <Plus size={14} />
                  New product
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Product</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Price</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/30 hidden md:table-cell">SKU</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-foreground/30">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map((p) => (
                    <tr key={p.id} className={`hover:bg-muted/10 transition-colors ${!p.active ? "opacity-50" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-border flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted/40 border border-border flex items-center justify-center flex-shrink-0">
                              <Package size={15} className="text-foreground/25" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-foreground">{p.name}</p>
                            {p.description && <p className="text-xs text-foreground/40 truncate max-w-[220px]">{p.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-semibold text-foreground font-mono">{fmtGHS(p.price)}</span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="text-xs text-foreground/40 font-mono">{p.sku ?? "—"}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.active ? "bg-[#B7EE7A]/10 text-[#B7EE7A]" : "bg-muted/50 text-foreground/40"
                        }`}>
                          {p.active ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(p)}
                            className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleActive(p)}
                            className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors"
                            title={p.active ? "Archive" : "Restore"}
                          >
                            {p.active ? <Archive size={13} /> : <ArchiveRestore size={13} />}
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {page && page.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <p className="text-xs text-foreground/30">
                {page.totalElements} products · page {page.number + 1} of {page.totalPages}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage >= page.totalPages - 1} className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
