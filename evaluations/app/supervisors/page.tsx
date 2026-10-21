import Link from "next/link";
import { loadOverview } from "@/lib/supervisorOverview";

export const dynamic = "force-dynamic";

/** One cohort's line on a card: a progress bar, or nothing if there are none. */
function Progress({ label, scored, students }: { label: string; scored: number; students: number }) {
  if (!students) return null;
  const pct = Math.round((scored / students) * 100);
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
        <span className="text-ink-2">{label}</span>
        <span className="num text-ink-3">{scored} of {students} marked</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full bg-knust-2" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function SupervisorsPage() {
  const supervisors = await loadOverview();

  return (
    <main className="mt-7">
      <div>
        <span className="eyebrow">Supervisors</span>
        <h2 className="font-display text-[22px] font-bold">Find your name</h2>
        <p className="mt-1 max-w-[62ch] text-[13px] text-ink-2">
          Pick your name, then choose what you are marking: your final year project
          students or your mini project (3rd year) students.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {supervisors.map((s) => (
          <Link key={s.id} href={`/supervisors/${s.id}`}
                className="card block p-4 transition hover:border-knust">
            <h3 className="font-display text-[16px] font-bold leading-snug">{s.name}</h3>
            <Progress label="Final year project" scored={s.scored} students={s.students} />
            <Progress label="Mini project (3rd year)" scored={s.miniScored} students={s.miniStudents} />
          </Link>
        ))}
      </div>
    </main>
  );
}
