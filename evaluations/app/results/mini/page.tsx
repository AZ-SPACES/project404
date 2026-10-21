import Link from "next/link";
import { apiUrl, serverApiUrl } from "@/lib/api";
import { MINI_MAX, type MiniStudent } from "@/lib/miniProject";
import ResultsTabs from "../ResultsTabs";

export const dynamic = "force-dynamic";

type Row = MiniStudent & { supervisor: string };

async function load(): Promise<Row[]> {
  const res = await fetch(serverApiUrl("/api/mini/results"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load results (${res.status})`);
  const { students } = (await res.json()) as { students: Row[] };
  return students;
}

export default async function MiniResultsPage() {
  const rows = await load();
  // The supervisor's mark is the whole grade, so a marked row is a final one and
  // ranks straight on it. Ties fall back to name so the order is stable.
  const marked = rows
    .filter((r) => r.mark !== null)
    .sort((a, b) => (b.mark ?? 0) - (a.mark ?? 0) || a.name.localeCompare(b.name));
  const th = "border-b border-line p-3 font-medium text-ink-3";
  const td = "border-b border-line-soft p-3";

  return (
    <main className="mt-7">
      <ResultsTabs active="mini" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Mini project · 3rd year · out of {MINI_MAX}</span>
          <h2 className="font-display text-[22px] font-bold">Results</h2>
          <p className="num mt-1 text-[12.5px] text-ink-3">
            {marked.length} of {rows.length} students marked
          </p>
        </div>
        <a href={apiUrl("/api/mini/results?format=csv")} className="btn btn-primary">Download CSV</a>
      </div>

      {!marked.length ? (
        <p className="card mt-5 p-10 text-center text-[13px] text-ink-3">
          No marks yet. They appear here as supervisors file them under{" "}
          <Link href="/supervisors" className="text-knust underline-offset-2 hover:underline">
            Supervisors
          </Link>.
        </p>
      ) : (
        <div className="card mt-5 overflow-x-auto">
          {/* Same pinned student column as the final-year table, for phones. */}
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-left">
                <th className={`sticky left-0 z-10 min-w-[152px] bg-surface ${th}`}>
                  <span className="num">#</span> Student
                </th>
                <th className={th}>Supervisor</th>
                <th className={th}>Notes</th>
                <th className={`num text-right ${th}`}>Mark</th>
              </tr>
            </thead>
            <tbody>
              {marked.map((r, i) => (
                <tr key={r.id}>
                  <td className={`sticky left-0 z-10 min-w-[152px] border-r border-line-soft bg-surface ${td}`}>
                    <div className="flex gap-2">
                      <span className="num text-ink-3">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{r.name}</span>
                        <span className="num block text-[11px] text-ink-3">{r.indexNo}</span>
                      </span>
                    </div>
                  </td>
                  <td className={`text-ink-2 ${td}`}>{r.supervisor}</td>
                  <td className={`max-w-[36ch] text-ink-3 ${td}`}>{r.notes || "—"}</td>
                  <td className={`num text-right font-semibold ${td}`}>{r.mark?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
