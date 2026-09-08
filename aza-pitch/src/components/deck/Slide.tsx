import { cn } from "@/lib/utils";

/**
 * `data-slide` is the contract with `Deck` — it observes these and adds `is-live`
 * when one becomes active, which is what releases the `.anim` entrances inside.
 */
export function Slide({
  id,
  dense = false,
  className,
  children,
}: {
  id: string;
  /** Content taller than the viewport: scrolls inside itself so snapping survives. */
  dense?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-slide
      aria-labelledby={`${id}-title`}
      className={cn("slide", dense && "slide--dense", className)}
    >
      <div className={cn("slide-body w-full max-w-[1180px] mx-auto", dense && "py-2")}>
        {children}
      </div>
    </section>
  );
}
