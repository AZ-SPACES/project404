import { apiUrl, serverApiUrl } from "@/lib/api";
import {
  CRITERIA, PANEL_SHARE, SUPERVISOR_SHARE, type Ballot,
  type aggregate, type finalMark,
} from "@/lib/rubric";

export const dynamic = "force-dynamic";

// /api/results merges both aggregate() and finalMark() into every row, so the
// page no longer runs any of the rubric maths itself — it only sorts and renders.
type Row = {
  roomId: string | null; roomCode: string | null; venue: string | null;
  groupNumber: number | null;
  studentId: string; name: string; indexNo: string;
  universityId: string | null; supervisor: string | null;
  supervisorMark: number | null;
  ballots: { examinerId: string; examiner: string; ballot: Ballot }[];
} & ReturnType<typeof aggregate> & ReturnType<typeof finalMark>;

async function load(): Promise<Row[]> {
  const res = await fetch(serverApiUrl("/api/results"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load results (${res.status})`);
  const { students } = (await res.json()) as { students: Row[] };
  return students;
}

export default async function ResultsPage() {
  const rows = await load();
  // Anything with either half of the mark. Ranking on a part-mark would be
  // misleading, so incomplete rows sort below every complete one.
  const marked = rows
    .filter((r) => r.final !== null)
    .sort((a, b) =>
      Number(b.complete) - Number(a.complete) || (b.final ?? 0) - (a.final ?? 0)
    );
  const complete = marked.filter((r) => r.complete).length;
  const th = "border-b border-line p-3 font-medium text-ink-3";
  const td = "border-b border-line-soft p-3";

  return (
    <main className="mt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[22px] font-bold">Results</h2>
          <p className="num mt-1 text-[12.5px] text-ink-3">
            {complete} of {rows.length} students have both halves · {marked.length} have one
          </p>
        </div>
        <a href={apiUrl("/api/results?format=csv")} className="btn btn-primary">Download CSV</a>
      </div>

      {!marked.length ? (
        <p className="card mt-5 p-10 text-center text-[13px] text-ink-3">
          No marks yet. Panel scores appear here as the rooms work through their
          groups, and supervisor marks as they are filed.
        </p>
      ) : (
        <div className="card mt-5 overflow-x-auto">
          {/* The student column is pinned: the table is wider than a phone, and
              scrolling to Final is useless if you lose whose row it is. Sticky
              cells need separated borders, so every rule is drawn on the cell. */}
          <table className="w-full min-w-[880px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-left">
                <th className={`sticky left-0 z-10 min-w-[152px] bg-surface ${th}`}>
                  <span className="num">#</span> Student
                </th>
                <th className={th}>Room</th>
                <th className={`num ${th}`}>Group</th>
                {CRITERIA.map((c) => (
                  <th key={c.key} className={`num text-right ${th}`}
                      title={`${c.label} — ${c.weight}% of the panel score`}>
                    {c.label.split(" ")[0]}
                  </th>
                ))}
                <th className={`num text-right ${th}`} title="Panel mean, as a share of the final mark">
                  Panel {PANEL_SHARE}
                </th>
                <th className={`num text-right ${th}`} title="The supervisor's own mark">
                  Sup. {SUPERVISOR_SHARE}
                </th>
                <th className={`num text-right ${th}`}>Final</th>
              </tr>
            </thead>
            <tbody>
              {marked.map((r, i) => (
                <tr key={r.studentId}>
                  <td className={`sticky left-0 z-10 min-w-[152px] border-r border-line-soft bg-surface ${td}`}>
                    <div className="flex gap-2">
                      <span className="num text-ink-3">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{r.name}</span>
                        <span className="num block text-[11px] text-ink-3">{r.indexNo}</span>
                      </span>
                    </div>
                  </td>
                  <td className={`text-ink-2 ${td}`}>
                    {r.roomCode ?? <span className="text-ink-3">did not defend</span>}
                  </td>
                  <td className={`num ${td}`}>{r.groupNumber ?? "—"}</td>
                  {CRITERIA.map((c) => (
                    <td key={c.key} className={`num text-right text-ink-2 ${td}`}>
                      {r.per[c.key].mean?.toFixed(1) ?? "—"}
                    </td>
                  ))}
                  <td className={`num text-right text-ink-2 ${td}`}>
                    {r.panelPoints?.toFixed(1) ?? "—"}
                  </td>
                  <td className={`num text-right text-ink-2 ${td}`}>
                    {r.supervisorPoints?.toFixed(1) ?? "—"}
                  </td>
                  <td className={`num text-right font-semibold ${td} ${r.complete ? "" : "text-ink-3"}`}
                      title={r.complete ? undefined : "One half of this mark is still missing"}>
                    {r.final?.toFixed(1)}
                    {!r.complete && <span className="ml-1 text-[10px] font-normal">so far</span>}
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
