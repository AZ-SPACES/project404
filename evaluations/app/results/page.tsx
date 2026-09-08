import { query } from "@/lib/db";
import { CRITERIA, aggregate, type Ballot } from "@/lib/rubric";

export const dynamic = "force-dynamic";

type Row = {
  roomCode: string; venue: string; groupNumber: number;
  studentId: string; name: string; indexNo: string;
  universityId: string | null; supervisor: string | null;
  ballots: { examinerId: string; examiner: string; ballot: Ballot }[];
};

async function load() {
  return query<Row>(`
    select r.code as "roomCode", r.venue, g.number as "groupNumber",
           s.id as "studentId", s.name, s.index_no as "indexNo",
           s.student_id as "universityId", s.supervisor,
           coalesce((
             select json_agg(json_build_object(
                      'examinerId', e.id, 'examiner', e.name,
                      'ballot', json_build_object(
                        'appearance', sc.appearance, 'usability', sc.usability,
                        'technical', sc.technical, 'innovation', sc.innovation,
                        'presentation', sc.presentation))
                    order by e.sort)
               from scores sc join examiners e on e.id = sc.examiner_id
              where sc.student_id = s.id
           ), '[]'::json) as ballots
      from students s
      join groups g on g.number = s.group_number
      join rooms  r on r.id = g.room_id
     order by r.sort, g.number, s.sort
  `);
}

export default async function ResultsPage() {
  const rows = await load();
  const scored = rows
    .map((r) => ({ ...r, ...aggregate(r.ballots.map((b) => b.ballot)) }))
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
        <a href="/api/results?format=csv" className="btn btn-primary">Download CSV</a>
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
