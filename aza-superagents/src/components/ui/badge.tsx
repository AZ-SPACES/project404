import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  active: "border-primary/30 bg-primary/12 text-primary",
  pending: "border-warning/30 bg-warning/12 text-warning",
  suspended: "border-destructive/30 bg-destructive/12 text-destructive",
  rejected: "border-border bg-muted/60 text-muted-foreground",
  neutral: "border-border bg-muted/60 text-muted-foreground",
};

/** Status pill. Agent statuses map to a fixed tone so a colour always means the same thing. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = TONE[status.toLowerCase()] ?? TONE.neutral;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide",
        tone,
        className
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

/** Direction of a float movement — down the network, or back up it. */
export function DirectionBadge({ direction }: { direction: "DISTRIBUTE" | "RECALL" }) {
  const down = direction === "DISTRIBUTE";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-wide",
        down
          ? "border-primary/30 bg-primary/12 text-primary"
          : "border-border bg-muted/60 text-muted-foreground"
      )}
    >
      {down ? "Sent down" : "Recalled"}
    </span>
  );
}
