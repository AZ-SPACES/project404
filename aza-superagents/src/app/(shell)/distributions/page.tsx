"use client";

import { useEffect, useState } from "react";
import { getDistributions, type FloatDistribution } from "@/lib/superagent-api";
import { fmtGhs } from "@/lib/utils";

export default function DistributionsPage() {
  const [items, setItems] = useState<FloatDistribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDistributions(0, 50)
      .then((p) => setItems(p.content))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold">Float distributions</h1>

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !items ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-neutral-500">You haven’t distributed float to any agents yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60 text-left text-neutral-400">
              <tr>
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.transactionId} className="border-t border-neutral-900">
                  <td className="px-4 py-3">{d.targetAgentName ?? "Agent"}</td>
                  <td className="px-4 py-3 text-neutral-400">{d.targetAgentCode ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmtGhs(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
