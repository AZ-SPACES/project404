import Link from "next/link";
import { query } from "@/lib/db";
import { CRITERIA, TOTAL_WEIGHT } from "@/lib/rubric";

export const dynamic = "force-dynamic";

type RoomCard = {
  id: string; code: string; label: string; venue: string; day: string;
  groups: number; students: number; examiners: string[]; complete: number;
};

async function loadRooms() {
  return query<RoomCard>(`
    select r.id, r.code, r.label, r.venue, r.day,
           (select count(*)::int from groups g where g.room_id = r.id) as groups,
           (select count(*)::int from students s
              join groups g on g.number = s.group_number
             where g.room_id = r.id) as students,
           coalesce((select array_agg(e.name order by e.sort)
                       from examiners e where e.room_id = r.id), '{}') as examiners,
           (select count(*)::int from scores sc
              join students s on s.id = sc.student_id
              join groups g   on g.number = s.group_number
             where g.room_id = r.id
               and sc.appearance is not null and sc.usability is not null
               and sc.technical is not null and sc.innovation is not null
               and sc.presentation is not null) as complete
      from rooms r order by r.sort
  `);
}

export default async function Home() {
  const rooms = await loadRooms();
  const students = rooms.reduce((n, r) => n + r.students, 0);
  const groups = rooms.reduce((n, r) => n + r.groups, 0);

  return (
    <main className="mt-7">
      {/* The rubric's own proportions, shown at the weights they carry. */}
      <section>
        <div className="flex h-[38px] gap-[3px] overflow-hidden rounded-md">
          {CRITERIA.map((c) => (
            <div key={c.key}
                 className="flex min-w-0 items-center px-2.5 text-[12px] font-semibold"
                 style={{ flex: c.weight, background: c.color, color: c.onColor }}>
              <span className="truncate">{c.label}</span>
              <span className="num ml-auto shrink-0 pl-2 text-[11px] opacity-80">{c.weight}%</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-3 text-[11.5px] text-ink-3">
          <p>Each student is scored 0–10 per criterion, weighted to {TOTAL_WEIGHT} points.</p>
          <p className="num">{groups} groups · {students} students · {rooms.length} rooms</p>
        </div>
      </section>

      <h2 className="mt-8 font-display text-[15px] font-semibold">Choose your room</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.map((r) => {
          const expected = r.students * Math.max(r.examiners.length, 1);
          const pct = expected ? Math.round((r.complete / expected) * 100) : 0;
          return (
            <Link key={r.id} href={`/rooms/${r.id}`}
                  className="card block p-4 transition hover:border-knust">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-[19px] font-bold">{r.label}</h3>
                <span className="eyebrow">{r.venue}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-2">
                {r.examiners.join(" · ") || "No panel assigned"}
              </p>
              <p className="num mt-3 text-[11.5px] text-ink-3">
                {r.groups} groups · {r.students} students · {r.day}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-knust-2" style={{ width: `${pct}%` }} />
              </div>
              <p className="num mt-1.5 text-[11px] text-ink-3">
                {r.complete} of {expected} ballots complete
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
