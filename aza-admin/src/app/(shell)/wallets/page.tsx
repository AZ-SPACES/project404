"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Page<AdminWallet>>({
    queryKey: ["wallets", page],
    queryFn: () => getAdminWallets(page, 20),
  });

  const freezeMutation = useMutation({
    mutationFn: ({ userId, frozen }: { userId: string; frozen: boolean }) =>
      freezeWallet(userId, frozen),
    onMutate: async ({ userId, frozen }) => {
      // Optimistic update
      queryClient.setQueryData<Page<AdminWallet>>(["wallets", page], (prev) => {
        if (!prev) return prev;
        return { ...prev, content: prev.content.map(w => w.userId === userId ? { ...w, frozen } : w) };
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Page<AdminWallet>>(["wallets", page], (prev) => {
        if (!prev) return prev;
        return { ...prev, content: prev.content.map(w => w.userId === updated.userId ? updated : w) };
      });
    },
    onError: (_err, { userId, frozen }) => {
      // Revert on failure
      queryClient.setQueryData<Page<AdminWallet>>(["wallets", page], (prev) => {
        if (!prev) return prev;
        return { ...prev, content: prev.content.map(w => w.userId === userId ? { ...w, frozen: !frozen } : w) };
      });
    },
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Wallets</h1>
        <p className="text-foreground/50 text-sm">All user wallets — freeze or unfreeze to restrict transactions</p>
      </div>

      {(error || freezeMutation.error) && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {((error || freezeMutation.error) as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-24 text-foreground/30">
          <Wallet size={40} className="mx-auto mb-4 opacity-40" />
          <p>No wallets found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="text-left px-4 py-3 text-foreground/40 font-medium">User</th>
                <th className="text-left px-4 py-3 text-foreground/40 font-medium">Email / Handle</th>
                <th className="text-right px-4 py-3 text-foreground/40 font-medium">Balance</th>
                <th className="text-center px-4 py-3 text-foreground/40 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-foreground/40 font-medium">Last Updated</th>
                <th className="text-center px-4 py-3 text-foreground/40 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.content.map((wallet, i) => (
                <tr
                  key={wallet.walletId}
                  className={`border-b border-border transition-colors ${
                    i % 2 === 0 ? "" : "bg-muted/10"
                  } ${wallet.frozen ? "opacity-70" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="text-foreground font-medium">{wallet.userName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground/70 text-sm">{wallet.userEmail}</div>
                    {wallet.userHandle && <div className="text-foreground/30 text-xs">@{wallet.userHandle}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-foreground font-semibold">
                      {wallet.currency} {Number(wallet.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {wallet.frozen ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <Snowflake size={11} /> Frozen
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                        <CheckCircle2 size={11} /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground/40 text-xs whitespace-nowrap">
                    {fmt(wallet.lastUpdatedAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => freezeMutation.mutate({ userId: wallet.userId, frozen: !wallet.frozen })}
                      disabled={freezeMutation.isPending && freezeMutation.variables?.userId === wallet.userId}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                        wallet.frozen
                          ? "bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20"
                          : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                      }`}
                    >
                      {freezeMutation.isPending && freezeMutation.variables?.userId === wallet.userId
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
        <div className="flex items-center justify-between text-sm text-foreground/50 mt-8">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0 || isLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span>Page {page + 1} of {data.totalPages}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= data.totalPages - 1 || isLoading}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
