import Link from "next/link";
import { apiUrl, serverApiUrl } from "@/lib/api";
import { MINI_MAX, type MiniSupervisorCard } from "@/lib/miniProject";

export const dynamic = "force-dynamic";

async function load(): Promise<MiniSupervisorCard[]> {
  const res = await fetch(serverApiUrl("/api/mini"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load supervisors (${res.status})`);
  const { supervisors } = (await res.json()) as { supervisors: MiniSupervisorCard[] };
  return supervisors;
}

export default async function MiniProjectPage() {
  const supervisors = await load();
  const students = supervisors.reduce((n, s) => n + s.students, 0);
  const scored = supervisors.reduce((n, s) => n + s.scored, 0);

  return (
    <main className="mt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Mini project · 3rd year · out of {MINI_MAX}</span>
          <h2 className="font-display text-[22px] font-bold">Find your name</h2>
          <p className="mt-1 max-w-[62ch] text-[13px] text-ink-2">
            Third years did not defend, so there is no panel. Your mark out of {MINI_MAX} is
            the whole mini project grade. Final-year marks are under{" "}
            <Link href="/supervisors" className="text-knust underline-offset-2 hover:underline">
              Final year project
            </Link>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="num text-[12px] text-ink-3">{scored} of {students} marks recorded</p>
          <Link href="/mini/results" className="btn">View results</Link>
          <a href={apiUrl("/api/mini/results?format=csv")} className="btn" title="Every third year and their mark">
            Export CSV
          </a>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {supervisors.map((s) => {
          const pct = s.students ? Math.round((s.scored / s.students) * 100) : 0;
          const done = s.students > 0 && s.scored === s.students;
          return (
            <Link key={s.id} href={`/mini/${s.id}`}
                  className="card block p-4 transition hover:border-knust">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-[16px] font-bold leading-snug">{s.name}</h3>
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  done ? "bg-knust-2" : s.scored ? "bg-gold" : "bg-sunken"
                }`} />
              </div>
              <p className="num mt-2 text-[11.5px] text-ink-3">
                {s.students} student{s.students === 1 ? "" : "s"}
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
