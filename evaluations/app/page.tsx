import Link from "next/link";
import { serverApiUrl } from "@/lib/api";
import { CRITERIA, TOTAL_WEIGHT } from "@/lib/rubric";

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
          const pct = expected ? Math.round((r.scored / expected) * 100) : 0;
          return (
            <Link key={r.id} href={`/rooms/${r.id}`}
                  className="card block p-4 transition hover:border-knust">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-[19px] font-bold">{r.label}</h3>
                <span className="eyebrow">{r.venue}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-2">
                {r.examiners.map((e) => e.name).join(" · ") || "No panel assigned"}
              </p>
              <p className="num mt-3 text-[11.5px] text-ink-3">
                {r.groups} groups · {r.students} students · {r.day}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-knust-2" style={{ width: `${pct}%` }} />
              </div>
              <p className="num mt-1.5 text-[11px] text-ink-3">
                {r.scored} of {expected} ballots complete
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
