import { stagger } from "@/lib/utils";

/**
 * Every content slide opens the same way: a mono eyebrow, a headline, and an
 * optional lede. Keeping it in one component is what stops eighteen slides from
 * drifting into eighteen slightly different heading scales.
 */
export function SlideHead({
  id,
  eyebrow,
  title,
  lede,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
}) {
  return (
    <div className="mb-[clamp(1.6rem,3.4vh,2.8rem)]">
      <p className="eyebrow anim anim-fade" style={stagger(0)}>
        {eyebrow}
      </p>
      <h2 id={`${id}-title`} className="headline mt-4 anim" style={stagger(1)}>
        {title}
      </h2>
      {lede ? (
        <p className="lede mt-4 anim" style={stagger(2)}>
          {lede}
        </p>
      ) : null}
    </div>
  );
}
