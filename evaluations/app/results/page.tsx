import { apiUrl, serverApiUrl } from "@/lib/api";
import ResultsTable, { type Row } from "./ResultsTable";

export const dynamic = "force-dynamic";

// /api/results already merges aggregate() into every row, so the page no longer
// runs the rubric maths itself — it only sorts and renders what the API returns.
async function load(): Promise<Row[]> {
  const res = await fetch(serverApiUrl("/api/results"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load results (${res.status})`);
  const { students } = (await res.json()) as { students: Row[] };
  return students;
}

export default async function ResultsPage() {
  const rows = await load();
  const scored = rows.filter((r) => r.total !== null);
  // How many examiners a full ballot set implies, taken from the fullest row.
  const panelSize = Math.max(2, ...scored.map((r) => r.ballots.length));

  return (
    <main className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] font-bold">Results</h1>
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
        <ResultsTable rows={scored} panelSize={panelSize} />
      )}
    </main>
  );
}
