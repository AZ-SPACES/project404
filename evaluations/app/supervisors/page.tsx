import Link from "next/link";
import { serverApiUrl } from "@/lib/api";
import { PANEL_SHARE, SUPERVISOR_SHARE } from "@/lib/rubric";

export const dynamic = "force-dynamic";

type SupervisorCard = {
  id: string; name: string; students: number; scored: number; defended: number;
};

async function load(): Promise<SupervisorCard[]> {
  const res = await fetch(serverApiUrl("/api/supervisors"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load supervisors (${res.status})`);
  const { supervisors } = (await res.json()) as { supervisors: SupervisorCard[] };
  return supervisors;
}

export default async function SupervisorsPage() {
  const supervisors = await load();
  const students = supervisors.reduce((n, s) => n + s.students, 0);
  const scored = supervisors.reduce((n, s) => n + s.scored, 0);

  return (
    <main className="mt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Supervisor marks · {SUPERVISOR_SHARE}%</span>
          <h2 className="font-display text-[22px] font-bold">Find your name</h2>
          <p className="mt-1 max-w-[62ch] text-[13px] text-ink-2">
            The defense panel scored {PANEL_SHARE}% of each student&rsquo;s final mark.
            The remaining {SUPERVISOR_SHARE}% is yours, given to your own supervisees
            individually.
          </p>
        </div>
        <p className="num text-[12px] text-ink-3">
          {scored} of {students} marks recorded
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {supervisors.map((s) => {
          const pct = s.students ? Math.round((s.scored / s.students) * 100) : 0;
          const done = s.students > 0 && s.scored === s.students;
          return (
            <Link key={s.id} href={`/supervisors/${s.id}`}
                  className="card block p-4 transition hover:border-knust">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-[16px] font-bold leading-snug">{s.name}</h3>
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  done ? "bg-knust-2" : s.scored ? "bg-gold" : "bg-sunken"
                }`} />
              </div>
              <p className="num mt-2 text-[11.5px] text-ink-3">
                {s.students} student{s.students === 1 ? "" : "s"}
                {s.students > s.defended && ` · ${s.students - s.defended} did not defend`}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-knust-2" style={{ width: `${pct}%` }} />
              </div>
              <p className="num mt-1.5 text-[11px] text-ink-3">{s.scored} of {s.students} marked</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
