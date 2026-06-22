"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMe, type AgentMe } from "@/lib/superagent-api";
import { fmtGhs } from "@/lib/utils";

export default function DashboardPage() {
  const [me, setMe] = useState<AgentMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe().then(setMe).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!me) return <p className="text-sm text-neutral-500">Loading…</p>;

  const isSuper = me.tier === "SUPER" && me.status === "ACTIVE";

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>

      {!isSuper ? (
        <div className="rounded-xl border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-200">
          This account isn’t an active superagent. Float distribution is only available to
          ACTIVE agents on the SUPER tier. Contact AZA back office to be upgraded.
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <p className="text-sm text-neutral-400">Float balance</p>
          <p className="mt-1 text-2xl font-semibold">{fmtGhs(me.floatBalance)}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <p className="text-sm text-neutral-400">Float limit</p>
          <p className="mt-1 text-2xl font-semibold">{me.floatLimit != null ? fmtGhs(me.floatLimit) : "—"}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <p className="text-sm text-neutral-400">Agent code</p>
          <p className="mt-1 text-2xl font-semibold">{me.code ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <p className="text-sm text-neutral-400">Tier · Status</p>
          <p className="mt-1 text-2xl font-semibold">
            {me.tier ?? "—"} · {me.status}
          </p>
        </div>
      </div>

      {isSuper ? (
        <Link
          href="/distribute"
          className="mt-6 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Distribute float to an agent
        </Link>
      ) : null}
    </div>
  );
}
