"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitFundTransfer } from "@/lib/admin-api";
import { Send, ShieldCheck } from "lucide-react";

export default function FundTransfersPage() {
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = useMutation({
    mutationFn: () => {
      const value = Number(amount);
      if (!recipient.trim()) throw new Error("Enter the recipient's email, phone, or @handle.");
      if (!value || value <= 0) throw new Error("Enter an amount greater than zero.");
      if (!reference.trim()) throw new Error("A reason is required — it's shown to the approver and kept on the record.");
      return submitFundTransfer(recipient.trim(), value, reference.trim());
    },
    onMutate: () => {
      setError("");
      setNotice("");
    },
    onSuccess: () => {
      setNotice(
        "Transfer submitted for approval. A different finance/admin officer must confirm it in Approvals before any funds move.",
      );
      setRecipient("");
      setAmount("");
      setReference("");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Fund Transfers</h1>
        <p className="text-foreground/50 text-sm">
          Send funds from your own AZA wallet to another user. Every transfer goes through
          maker-checker — it only moves once a different finance/admin officer approves it.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-green-400 text-sm mb-6">
          {notice}
        </div>
      )}

      <div className="rounded-xl border border-border p-5">
        <label className="block text-xs text-foreground/60 mb-1">Recipient</label>
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Email, phone, or @handle"
          className="w-full mb-3 rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30"
        />

        <label className="block text-xs text-foreground/60 mb-1">Amount (GHS)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="w-full mb-3 rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30"
        />

        <label className="block text-xs text-foreground/60 mb-1">Reason</label>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Why this transfer is being made"
          className="w-full mb-4 rounded-lg bg-muted/30 border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30"
        />

        <button
          onClick={() => submit.mutate()}
          disabled={submit.isPending}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-foreground/10 text-foreground border border-border text-sm font-medium hover:bg-foreground/20 disabled:opacity-30 transition-colors"
        >
          <Send size={14} />
          Submit for approval
        </button>

        <div className="flex items-start gap-2 mt-4 pt-4 border-t border-border text-xs text-foreground/40">
          <ShieldCheck size={14} className="shrink-0 mt-0.5" />
          <p>
            The funds come out of your own wallet balance, checked again at approval time. You
            cannot approve your own request.
          </p>
        </div>
      </div>
    </div>
  );
}
