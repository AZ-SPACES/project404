import Link from "next/link";
import { serverApiUrl } from "@/lib/api";
import { CRITERIA, HEAVIEST, TOTAL_WEIGHT } from "@/lib/rubric";

export const dynamic = "force-dynamic";

// Mirrors the /api/rooms payload rather than the old SQL projection: the route
// names the completed-ballot count `scored` and returns examiners as objects.
type RoomCard = {
  id: string; code: string; label: string; venue: string; day: string;
  groups: number; students: number;
  examiners: { id: string; name: string }[];
  scored: number;
};

async function loadRooms(): Promise<RoomCard[]> {
  const res = await fetch(serverApiUrl("/api/rooms"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load rooms (${res.status})`);
  const { rooms } = (await res.json()) as { rooms: RoomCard[] };
  return rooms;
}

export default async function Home() {
  const rooms = await loadRooms();
  const students = rooms.reduce((n, r) => n + r.students, 0);
  const groups = rooms.reduce((n, r) => n + r.groups, 0);

  return (
    <main className="mt-8">
      {/* The page has one job, so it leads with it. The rubric used to sit up
          here in five saturated bars and outweighed the thing you came to do. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="font-display text-[22px] font-bold">Choose your room</h1>
        <p className="num text-[12px] text-ink-3">
          {groups} groups · {students} students · {rooms.length} rooms
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.map((r) => {
          const expected = r.students * Math.max(r.examiners.length, 1);
          const pct = expected ? Math.round((r.scored / expected) * 100) : 0;
          return (
            <Link key={r.id} href={`/rooms/${r.id}`}
                  className="card block p-4 transition hover:border-knust">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[19px] font-bold">{r.label}</h2>
                <span className="num text-[11px] text-ink-3">{r.venue}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-2">
                {r.examiners.map((e) => e.name).join(" · ") || "No panel assigned"}
              </p>
              <p className="num mt-3 text-[11.5px] text-ink-3">
                {r.groups} groups · {r.students} students · {r.day}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-knust-2"
                     style={{ width: pct ? `${pct}%` : undefined }} />
              </div>
              <p className="num mt-1.5 text-[11.5px] text-ink-3">
                {r.scored ? `${r.scored} of ${expected} ballots complete` : "Not started"}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Reference, below the fold of the decision. Widths carry the weights;
          the only colour marks the criterion that carries the most. */}
      <section className="mt-10 border-t border-line-soft pt-6">
        <h2 className="font-display text-[15px] font-semibold">How the {TOTAL_WEIGHT} points divide</h2>
        <p className="mt-1 text-[12.5px] text-ink-2">
          Each student is scored 0–10 per criterion. {HEAVIEST.label} carries the most weight.
        </p>
        <div className="mt-3 flex h-2.5 gap-[3px] overflow-hidden rounded-md sm:h-9">
          {CRITERIA.map((c) => {
            const lead = c.key === HEAVIEST.key;
            return (
              <div key={c.key}
                   className={`flex min-w-0 items-center text-[12px] font-semibold sm:px-2.5 ${
                     lead ? "bg-knust text-white" : "bg-sunken text-ink-2"
                   }`}
                   style={{ flex: c.weight }}>
                <span className="hidden truncate sm:inline">{c.label}</span>
                <span className="num ml-auto hidden shrink-0 pl-2 text-[11px] sm:inline">
                  {c.weight}%
                </span>
              </div>
            );
          })}
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] sm:hidden">
          {CRITERIA.map((c) => (
            <li key={c.key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${
                c.key === HEAVIEST.key ? "bg-knust" : "bg-sunken"}`} />
              <span>{c.label}</span>
              <span className="num text-ink-3">{c.weight}%</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
