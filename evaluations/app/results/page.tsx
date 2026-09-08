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
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="num p-3 font-medium text-ink-3">#</th>
                <th className="p-3 font-medium text-ink-3">Student</th>
                <th className="p-3 font-medium text-ink-3">Room</th>
                <th className="num p-3 font-medium text-ink-3">Group</th>
                {CRITERIA.map((c) => (
                  <th key={c.key} className="num p-3 text-right font-medium text-ink-3"
                      title={`${c.label} — ${c.weight}%`}>
                    {c.label.split(" ")[0]}
                  </th>
                ))}
                <th className="num p-3 text-right font-medium text-ink-3">Total</th>
                <th className="num p-3 text-right font-medium text-ink-3">Ballots</th>
              </tr>
            </thead>
            <tbody>
              {scored.map((r, i) => (
                <tr key={r.studentId} className="border-b border-line-soft last:border-0">
                  <td className="num p-3 text-ink-3">{i + 1}</td>
                  <td className="p-3">
                    <div className="font-semibold">{r.name}</div>
                    <div className="num text-[11px] text-ink-3">{r.indexNo}</div>
                  </td>
                  <td className="p-3 text-ink-2">{r.roomCode}</td>
                  <td className="num p-3">{r.groupNumber}</td>
                  {CRITERIA.map((c) => (
                    <td key={c.key} className="num p-3 text-right text-ink-2">
                      {r.per[c.key].mean?.toFixed(1) ?? "—"}
                    </td>
                  ))}
                  <td className="num p-3 text-right font-semibold">{r.total?.toFixed(1)}</td>
                  <td className="num p-3 text-right text-ink-3">{r.ballots.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
