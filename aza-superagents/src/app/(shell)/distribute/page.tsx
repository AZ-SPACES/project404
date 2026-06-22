"use client";

import { useState } from "react";
import { distributeFloat } from "@/lib/superagent-api";
import { fmtGhs } from "@/lib/utils";

function parseAgentCode(raw: string): string {
  const m = raw.match(/(AZA-[A-Z0-9]{6})/i);
  return (m?.[1] ?? raw).trim().toUpperCase();
}

function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function DistributePage() {
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const value = Number(amount);
    if (!code.trim()) return setError("Enter the agent’s till code (e.g. AZA-7K4PQM).");
    if (!value || value <= 0) return setError("Enter an amount greater than zero.");

    setBusy(true);
    try {
      const res = await distributeFloat({
        targetAgentCode: parseAgentCode(code),
        amount: value,
        idempotencyKey: newIdempotencyKey(),
      });
      setSuccess(
        `${fmtGhs(value)} sent to ${res.targetAgentName ?? res.targetAgentCode ?? "the agent"}. ` +
          `Your float is now ${fmtGhs(res.superAgentFloatBalance)}.`
      );
      setCode("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Distribution failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md">
      <h1 className="mb-2 text-xl font-semibold">Distribute float</h1>
      <p className="mb-6 text-sm text-neutral-400">
        Hand e-float down to an agent against the cash they’ve given you. The amount moves
        from your float to theirs.
      </p>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-400">Agent till code</label>
          <input
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm uppercase outline-none focus:border-neutral-600"
            placeholder="AZA-7K4PQM"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-400">Float to send (GH₵)</label>
          <input
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-600"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-white py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send float"}
        </button>
      </form>
    </div>
  );
}
