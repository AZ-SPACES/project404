import { cn } from "@/lib/utils";

/**
 * AZA mark: a lime square with the wordmark alongside. The "Super agents" qualifier is set in
 * muted weight so the brand reads first and the portal name second.
 */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-[0.8rem] font-bold text-primary-foreground"
      >
        A
      </span>
      {compact ? null : (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight">AZA</span>
          <span className="mt-0.5 text-[0.68rem] font-medium uppercase tracking-wider text-muted-foreground">
            Super agents
          </span>
        </span>
      )}
    </div>
  );
}
