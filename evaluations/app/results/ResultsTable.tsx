"use client";

import { useMemo, useState } from "react";
import { CRITERIA, type Ballot, type aggregate } from "@/lib/rubric";

export type Row = {
  roomId: string; roomCode: string; venue: string; groupNumber: number;
  studentId: string; name: string; indexNo: string;
  universityId: string | null; supervisor: string | null;
  ballots: { examinerId: string; examiner: string; ballot: Ballot }[];
} & ReturnType<typeof aggregate>;

type SortKey = "total" | "name" | "group";

export default function ResultsTable({ rows, panelSize }: { rows: Row[]; panelSize: number }) {
  const [query, setQuery] = useState("");
  const [room, setRoom] = useState("all");
  const [sort, setSort] = useState<SortKey>("total");

  const rooms = useMemo(
    () => [...new Map(rows.map((r) => [r.roomId, r.roomCode])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1])),
    [rows]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (room === "all" || r.roomId === room) &&
        (!q ||
          r.name.toLowerCase().includes(q) ||
          r.indexNo.includes(q) ||
          String(r.groupNumber) === q)
    );
    out.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "group") return a.groupNumber - b.groupNumber;
      return (b.total ?? 0) - (a.total ?? 0);
    });
    return out;
  }, [rows, query, room, sort]);

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="results-search" className="sr-only">Search students</label>
          <input id="results-search" value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search a name, index no. or group" className="field" />
        </div>
        <label className="sr-only" htmlFor="results-room">Room</label>
        <select id="results-room" value={room} onChange={(e) => setRoom(e.target.value)}
                className="field w-auto">
          <option value="all">All rooms</option>
          {rooms.map(([id, code]) => <option key={id} value={id}>{code}</option>)}
        </select>
        <label className="sr-only" htmlFor="results-sort">Sort by</label>
        <select id="results-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
                className="field w-auto">
          <option value="total">Highest total</option>
          <option value="name">Name</option>
          <option value="group">Group</option>
        </select>
      </div>

      <p className="num mt-2 text-[11.5px] text-ink-3" aria-live="polite">
        Showing {shown.length} of {rows.length} scored students
      </p>

      {!shown.length ? (
        <p className="card mt-3 p-10 text-center text-[13px] text-ink-3">
          Nothing matches that search.
        </p>
      ) : (
        <div className="card mt-3 max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
            <caption className="sr-only">
              Scored students, panel mean per criterion out of 10 and weighted total out of 100
            </caption>
            <thead>
              {/* Sticky in both axes: 501 rows lose their headers, and a phone
                  scrolled out to Total loses whose row it is. */}
              <tr className="text-left">
                <th scope="col"
                    className="sticky left-0 top-0 z-corner min-w-[152px] border-b border-line bg-surface p-3 font-medium text-ink-3">
                  <span className="num">#</span> Student
                </th>
                <th scope="col" className="sticky top-0 z-colhead border-b border-line bg-surface p-3 font-medium text-ink-3">Room</th>
                <th scope="col" className="num sticky top-0 z-colhead border-b border-line bg-surface p-3 font-medium text-ink-3">Group</th>
                {CRITERIA.map((c) => (
                  <th key={c.key} scope="col"
                      className="num sticky top-0 z-colhead border-b border-line bg-surface p-3 text-right font-medium text-ink-3">
                    {c.short}
                    <span className="block text-[10px] font-normal">/10 · {c.weight}%</span>
                  </th>
                ))}
                <th scope="col" className="num sticky top-0 z-colhead border-b border-line bg-surface p-3 text-right font-medium text-ink-3">
                  Total<span className="block text-[10px] font-normal">/100</span>
                </th>
                <th scope="col" className="num sticky top-0 z-colhead border-b border-line bg-surface p-3 text-right font-medium text-ink-3">Ballots</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const provisional = r.ballots.length < panelSize;
                return (
                  <tr key={r.studentId}>
                    <th scope="row"
                        className="sticky left-0 z-rowhead min-w-[152px] border-b border-r border-line-soft bg-surface p-3 text-left font-normal">
                      <div className="flex gap-2">
                        <span className="num text-ink-3">{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{r.name}</span>
                          <span className="num block text-[11px] text-ink-3">{r.indexNo}</span>
                        </span>
                      </div>
                    </th>
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
                    <td className="num border-b border-line-soft p-3 text-right">
                      {/* One ballot of two is provisional. It used to be the
                          faintest thing on the row despite deciding trust. */}
                      <span className={provisional
                        ? "rounded bg-gold/15 px-1.5 py-0.5 font-semibold text-warn"
                        : "text-ink-3"}>
                        {r.ballots.length} of {panelSize}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
