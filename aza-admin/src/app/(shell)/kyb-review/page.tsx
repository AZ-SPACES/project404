"use client";

import { useQuery } from "@tanstack/react-query";
import { getKybQueue, AdminMerchant } from "@/lib/admin-api";
import Link from "next/link";
import { Loader2, ChevronRight, ShieldCheck } from "lucide-react";

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  KYB_SUBMITTED:     { cls: "bg-blue-400/15 text-blue-400",    label: "Submitted" },
  KYB_UNDER_REVIEW:  { cls: "bg-amber-400/15 text-amber-400",  label: "Under Review" },
  MORE_INFO_REQUIRED:{ cls: "bg-orange-400/15 text-orange-400",label: "Info Requested" },
};

function KybBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { cls: "bg-muted/50 text-foreground/50", label: status.replace(/_/g, " ") };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function MerchantAvatar({ merchant }: { merchant: AdminMerchant }) {
  if (merchant.logoUrl) {
    return (
      <img
        src={merchant.logoUrl}
        alt={merchant.businessName}
        className="w-10 h-10 rounded-xl object-cover border border-border flex-shrink-0"
      />
    );
  }
  const initials = merchant.businessName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="w-10 h-10 rounded-xl bg-muted/40 border border-border flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-foreground/50">{initials}</span>
    </div>
  );
}

export default function KybQueuePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["kybQueue"],
    queryFn: () => getKybQueue(),
  });

  const records = data?.content ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-foreground/40" size={28} />
      </div>
    );
  }

  const responded = records.filter((r) => r.status === "MORE_INFO_REQUIRED").length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">KYB Review</h1>
        <p className="text-foreground/40 text-sm mt-1">
          {records.length} submission{records.length !== 1 ? "s" : ""} awaiting review
          {responded > 0 && (
            <span className="ml-2 text-orange-400">· {responded} awaiting merchant response</span>
          )}
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{(error as Error).message}</p>}

      {records.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center h-48 text-foreground/30 gap-3">
          <ShieldCheck size={36} />
          <p className="text-sm">No pending KYB submissions</p>
        </div>
      )}

      {[
        { label: "Awaiting Merchant Response", items: records.filter((r) => r.status === "MORE_INFO_REQUIRED") },
        { label: "Under Review", items: records.filter((r) => r.status === "KYB_UNDER_REVIEW") },
        { label: "Submitted", items: records.filter((r) => r.status === "KYB_SUBMITTED") },
      ]
        .filter(({ items }) => items.length > 0)
        .map(({ label, items }) => (
          <div key={label} className="space-y-2">
            <p className="text-[11px] text-foreground/30 uppercase tracking-widest font-medium px-1">{label}</p>
            {items.map((m) => (
              <Link
                key={m.id}
                href={`/kyb-review/${m.id}`}
                className="flex items-center justify-between bg-card border border-border rounded-2xl p-4 hover:border-foreground/15 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <MerchantAvatar merchant={m} />
                  <div>
                    <p className="text-foreground font-medium text-sm">{m.businessName}</p>
                    <p className="text-foreground/40 text-xs mt-0.5 font-mono">@{m.businessHandle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <KybBadge status={m.status} />
                  <div className="text-right hidden sm:block">
                    <p className="text-foreground/50 text-xs">{m.category?.replace(/_/g, " ").toLowerCase() ?? "—"}</p>
                    <p className="text-foreground/30 text-xs">Joined {fmtDate(m.createdAt)}</p>
                  </div>
                  <ChevronRight size={16} className="text-foreground/20 group-hover:text-foreground/50 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        ))}
    </div>
  );
}
