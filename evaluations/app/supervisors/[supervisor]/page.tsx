import Link from "next/link";
import { notFound } from "next/navigation";
import { MINI_MAX } from "@/lib/miniProject";
import { PANEL_SHARE, SUPERVISOR_SHARE } from "@/lib/rubric";
import { loadOverview } from "@/lib/supervisorOverview";

export const dynamic = "force-dynamic";

type Choice = {
  href: string; title: string; blurb: string; students: number; scored: number;
};

export default async function SupervisorChoicePage({
  params,
}: {
  params: Promise<{ supervisor: string }>;
}) {
  const { supervisor: id } = await params;
  const s = (await loadOverview()).find((row) => row.id === id);
  if (!s) notFound();

  const choices: Choice[] = [
    {
      href: `/supervisors/${s.id}/final`, title: "Final year project",
      blurb: `4th year · your ${SUPERVISOR_SHARE}%, alongside the panel's ${PANEL_SHARE}%`,
      students: s.students, scored: s.scored,
    },
    {
      href: `/supervisors/${s.id}/mini`, title: "Mini project (3rd year)",
      blurb: `3rd year · one mark out of ${MINI_MAX}, the whole grade`,
      students: s.miniStudents, scored: s.miniScored,
    },
  ];

  return (
    <main className="mt-6">
      <Link href="/supervisors" className="eyebrow hover:text-ink-2">
        &larr; All supervisors
      </Link>
      <h2 className="font-display text-[22px] font-bold">{s.name}</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-2">What are you marking?</p>

      <div className="mt-5 grid max-w-[760px] gap-3 sm:grid-cols-2">
        {choices.map((c) => {
          // A supervisor with nobody in a cohort still sees it, greyed, so the
          // choice reads the same for everyone and the absence is explicit.
          if (!c.students) {
            return (
              <div key={c.href} className="card p-5 opacity-60">
                <h3 className="font-display text-[18px] font-bold">{c.title}</h3>
                <p className="mt-1 text-[12.5px] text-ink-3">{c.blurb}</p>
                <p className="mt-4 text-[12px] text-ink-3">No students assigned to you</p>
              </div>
            );
          }
          const pct = Math.round((c.scored / c.students) * 100);
          return (
            <Link key={c.href} href={c.href}
                  className="card block p-5 transition hover:border-knust">
              <h3 className="font-display text-[18px] font-bold">{c.title}</h3>
              <p className="mt-1 text-[12.5px] text-ink-2">{c.blurb}</p>
              <p className="num mt-4 text-[11.5px] text-ink-3">
                {c.students} student{c.students === 1 ? "" : "s"}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-knust-2" style={{ width: `${pct}%` }} />
              </div>
              <p className="num mt-1.5 text-[11px] text-ink-3">{c.scored} of {c.students} marked</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
