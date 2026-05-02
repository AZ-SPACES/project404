"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getAdminWallets,
  freezeWallet,
  AdminWallet,
  Page,
} from "@/lib/admin-api";
import { Wallet, Snowflake, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WalletsPage() {
  const [data, setData] = useState<Page<AdminWallet> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freezingIds, setFreezingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminWallets(p, 20);
      setData(res);
      setPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load wallets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0);
  }, [load]);

  async function handleFreeze(wallet: AdminWallet) {
    setFreezingIds((prev) => new Set(prev).add(wallet.userId));
    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        content: prev.content.map((w) =>
          w.userId === wallet.userId ? { ...w, frozen: !w.frozen } : w
        ),
      };
    });
    try {
      const updated = await freezeWallet(wallet.userId, !wallet.frozen);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          content: prev.content.map((w) =>
            w.userId === updated.userId ? updated : w
          ),
        };
      });
    } catch (e: any) {
      // Revert on failure
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          content: prev.content.map((w) =>
            w.userId === wallet.userId ? { ...w, frozen: wallet.frozen } : w
          ),
        };
      });
      setError(e.message ?? "Failed to update wallet status");
    } finally {
      setFreezingIds((prev) => {
        const next = new Set(prev);
        next.delete(wallet.userId);
        return next;
      });
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Wallets</h1>
        <p className="text-white/50 text-sm">
          All user wallets — freeze or unfreeze to restrict transactions
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-24 text-white/30">
          <Wallet size={40} className="mx-auto mb-4 opacity-40" />
          <p>No wallets found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-white/40 font-medium">User</th>
                <th className="text-left px-4 py-3 text-white/40 font-medium">Email / Handle</th>
                <th className="text-right px-4 py-3 text-white/40 font-medium">Balance</th>
                <th className="text-center px-4 py-3 text-white/40 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-white/40 font-medium">Last Updated</th>
                <th className="text-center px-4 py-3 text-white/40 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.content.map((wallet, i) => (
                <tr
                  key={wallet.walletId}
                  className={`border-b border-white/5 transition-colors ${
                    i % 2 === 0 ? "" : "bg-white/[0.02]"
                  } ${wallet.frozen ? "opacity-70" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{wallet.userName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white/70 text-sm">{wallet.userEmail}</div>
                    {wallet.userHandle && (
                      <div className="text-white/30 text-xs">@{wallet.userHandle}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-white font-semibold">
                      {wallet.currency} {Number(wallet.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {wallet.frozen ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <Snowflake size={11} />
                        Frozen
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                        <CheckCircle2 size={11} />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-white/40 text-xs whitespace-nowrap">
                    {fmt(wallet.lastUpdatedAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleFreeze(wallet)}
                      disabled={freezingIds.has(wallet.userId)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                        wallet.frozen
                          ? "bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20"
                          : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                      }`}
                    >
                      {freezingIds.has(wallet.userId)
                        ? "..."
                        : wallet.frozen
                        ? "Unfreeze"
                        : "Freeze"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-white/50 mt-8">
          <button
            onClick={() => load(page - 1)}
            disabled={page === 0 || loading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>
            Page {page + 1} of {data.totalPages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= data.totalPages - 1 || loading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
