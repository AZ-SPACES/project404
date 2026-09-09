import { apiUrl, serverApiUrl } from "@/lib/api";
import { CRITERIA, type Ballot, type aggregate } from "@/lib/rubric";

export const dynamic = "force-dynamic";

// /api/results already merges aggregate() into every row, so the page no longer
// runs the rubric maths itself — it only sorts and renders what the API returns.
type Row = {
  roomId: string; roomCode: string; venue: string; groupNumber: number;
  studentId: string; name: string; indexNo: string;
  universityId: string | null; supervisor: string | null;
  ballots: { examinerId: string; examiner: string; ballot: Ballot }[];
} & ReturnType<typeof aggregate>;

async function load(): Promise<Row[]> {
  const res = await fetch(serverApiUrl("/api/results"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load results (${res.status})`);
  const { students } = (await res.json()) as { students: Row[] };
  return students;
}

export default async function ResultsPage() {
  const rows = await load();
  const scored = rows
    .filter((r) => r.total !== null)
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

  return (
    <main className="mt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[22px] font-bold">Results</h2>
          <p className="num mt-1 text-[12.5px] text-ink-3">
            {scored.length} of {rows.length} students have at least one ballot
          </p>
        </div>
        <a href={apiUrl("/api/results?format=csv")} className="btn btn-primary">Download CSV</a>
      </div>

      {!scored.length ? (
        <p className="card mt-5 p-10 text-center text-[13px] text-ink-3">
          No ballots yet. Scores appear here as the panels work through their rooms.
        </p>
      ) : (
        <div className="card mt-5 overflow-x-auto">
          {/* The student column is pinned: the table is wider than a phone, and
              scrolling to Total is useless if you lose whose row it is. Sticky
              cells need separated borders, so every rule is drawn on the cell. */}
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-left">
                <th className="sticky left-0 z-10 min-w-[152px] border-b border-line bg-surface p-3 font-medium text-ink-3">
                  <span className="num">#</span> Student
                </th>
                <th className="border-b border-line p-3 font-medium text-ink-3">Room</th>
                <th className="num border-b border-line p-3 font-medium text-ink-3">Group</th>
                {CRITERIA.map((c) => (
                  <th key={c.key} className="num border-b border-line p-3 text-right font-medium text-ink-3"
                      title={`${c.label} — ${c.weight}%`}>
                    {c.label.split(" ")[0]}
                  </th>
                ))}
                <th className="num border-b border-line p-3 text-right font-medium text-ink-3">Total</th>
                <th className="num border-b border-line p-3 text-right font-medium text-ink-3">Ballots</th>
              </tr>
            </thead>
            <tbody>
              {scored.map((r, i) => (
                <tr key={r.studentId}>
                  <td className="sticky left-0 z-10 min-w-[152px] border-b border-r border-line-soft bg-surface p-3">
                    <div className="flex gap-2">
                      <span className="num text-ink-3">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{r.name}</span>
                        <span className="num block text-[11px] text-ink-3">{r.indexNo}</span>
                      </span>
                    </div>
                  </td>
                  <td className="border-b border-line-soft p-3 text-ink-2">{r.roomCode}</td>
                  <td className="num border-b border-line-soft p-3">{r.groupNumber}</td>
                  {CRITERIA.map((c) => (
                    <td key={c.key} className="num border-b border-line-soft p-3 text-right text-ink-2">
                      {r.per[c.key].mean?.toFixed(1) ?? "—"}
                    </td>
                  ))}
                  <td className="num border-b border-line-soft p-3 text-right font-semibold">
                    {r.total?.toFixed(1)}
                  </td>
                  <td className="num border-b border-line-soft p-3 text-right text-ink-3">
                    {r.ballots.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
