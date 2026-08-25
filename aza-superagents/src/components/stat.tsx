import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/states";

/**
 * A single figure. `emphasis` is reserved for the one number a page is actually about — on the
 * dashboard that is available float, because it is what decides whether a distribution can
 * happen at all.
 */
export function Stat({
  label,
  value,
  sub,
  emphasis,
  loading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  emphasis?: boolean;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card px-5 py-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <p
          className={cn(
            "tnum mt-1.5 font-semibold tracking-tight",
            emphasis ? "text-2xl text-primary" : "text-2xl text-foreground"
          )}
        >
          {value}
        </p>
      )}
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
