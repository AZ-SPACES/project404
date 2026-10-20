"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import {
  CRITERIA, PANEL_SHARE, SUPERVISOR_SHARE, aggregate, ballotTotal, finalMark,
} from "@/lib/rubric";
import { MINI_MAX } from "@/lib/miniProject";
import type { FinalYearHit, MiniHit, SupervisorHit } from "@/app/api/search/route";

type Hit = FinalYearHit | MiniHit;

const fmt = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(digits);

/**
 * Look anyone up — a final year, a third year, or a supervisor — and open a
 * student to see everything recorded against them. Read-only: marks are changed
 * on the supervisor's own page, which each record links to.
 */
export default function SearchBoard() {
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<Hit[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  // /search?q=… opens with that search filled in, so a result can be sent as a link.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setQ(initial);
  }, []);

  // Debounced search. The AbortController drops a slow earlier response that
  // would otherwise land after a faster later one and show the wrong list.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setStudents([]); setSupervisors([]); setSearching(false); return; }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/search?q=${encodeURIComponent(term)}`),
                                { cache: "no-store", signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { students: Hit[]; supervisors: SupervisorHit[] };
        setStudents(body.students);
        setSupervisors(body.supervisors);
        // A single match is almost always the one being looked for.
        setOpen(body.students.length === 1 ? body.students[0].id : null);
      } catch {
        if (!ctrl.signal.aborted) { setStudents([]); setSupervisors([]); }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const term = q.trim();
  const nothing = term.length >= 2 && !searching && !students.length && !supervisors.length;

  return (
    <main className="mt-7">
      <span className="eyebrow">Search</span>
      <h2 className="font-display text-[22px] font-bold">Find a student or supervisor</h2>
      <p className="mt-1 max-w-[62ch] text-[13px] text-ink-2">
        Search final years and third years by name, index number or student ID, or a
        supervisor by name. Open a student to see their scores, marks and notes.
      </p>

      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
             placeholder="Name, index no. or student ID"
             className="mt-4 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-[14px] outline-none placeholder:text-ink-3 focus:border-knust" />
      <p className="num mt-1.5 h-4 text-[11px] text-ink-3">
        {term.length === 1 ? "Keep typing…" : searching ? "Searching…" : ""}
      </p>

      {supervisors.length > 0 && (
        <section className="mt-3">
          <h3 className="eyebrow">Supervisors</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {supervisors.map((s) => (
              <li key={s.id} className="card px-3.5 py-3">
                <p className="text-[13.5px] font-semibold">{s.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  {s.finalYear > 0 && (
                    <Link href={`/supervisors/${s.id}`} className="font-medium text-knust underline-offset-2 hover:underline">
                      {s.finalYear} final year project &rarr;
                    </Link>
                  )}
                  {s.mini > 0 && (
                    <Link href={`/mini/${s.id}`} className="font-medium text-knust underline-offset-2 hover:underline">
                      {s.mini} mini project (3rd year) &rarr;
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {students.length > 0 && (
        <section className="mt-5">
          <h3 className="eyebrow">
            Students · {students.length}{students.length >= 25 ? "+ — keep typing to narrow it down" : ""}
          </h3>
          <ul className="mt-2 grid gap-2">
            {students.map((s) => {
              const isOpen = open === s.id;
              return (
                <li key={s.id} className="card overflow-hidden">
                  <button type="button" onClick={() => setOpen(isOpen ? null : s.id)}
                          aria-expanded={isOpen}
                          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3 text-left">
                    <span className="min-w-0 flex-1 basis-[220px]">
                      <span className="block truncate text-[13.5px] font-semibold">{s.name}</span>
                      <span className="num mt-0.5 block truncate text-[11px] text-ink-3">
                        {s.indexNo} · {s.supervisorName ?? "no supervisor"}
                      </span>
                    </span>
                    <CohortBadge cohort={s.cohort} />
                    <span className="eyebrow shrink-0">{isOpen ? "Close" : "View"}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-line-soft bg-surface-2 px-3.5 py-3.5">
                      {s.cohort === "final" ? <FinalYearDetail s={s} /> : <MiniDetail s={s} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {nothing && (
        <p className="card mt-3 p-10 text-center text-[12.5px] text-ink-3">
          Nobody matches &ldquo;{term}&rdquo;.
        </p>
      )}
    </main>
  );
}

function CohortBadge({ cohort }: { cohort: Hit["cohort"] }) {
  return cohort === "final" ? (
    <span className="shrink-0 rounded-full border border-knust/30 bg-knust-soft px-2 py-0.5 text-[11px] font-medium text-knust">
      Final year
    </span>
  ) : (
    <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-ink-2">
      3rd year · mini project
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-[13px]">{children}</dd>
    </div>
  );
}

function Notes({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="mt-3">
      <p className="eyebrow">Supervisor notes</p>
      <p className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-surface px-3 py-2 text-[12.5px]">
        {text}
      </p>
    </div>
  );
}

function FinalYearDetail({ s }: { s: FinalYearHit }) {
  const agg = aggregate(s.ballots.map((b) => b.ballot));
  const { panelPoints, supervisorPoints, final, complete } = finalMark(agg.total, s.mark);

  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Fact label="Supervisor">
          {s.supervisorId ? (
            <Link href={`/supervisors/${s.supervisorId}`} className="text-knust underline-offset-2 hover:underline">
              {s.supervisorName}
            </Link>
          ) : "—"}
        </Fact>
        <Fact label="Student ID"><span className="num">{s.universityId ?? "—"}</span></Fact>
        <Fact label="Group">
          <span className="num">{s.groupNumber ?? "did not defend"}</span>
        </Fact>
        <Fact label="Room">
          {s.roomCode ? `${s.roomCode}${s.venue ? ` · ${s.venue}` : ""}` : "—"}
        </Fact>
      </dl>

      {s.ballots.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[560px] text-[12px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                <th className="p-2 font-medium">Examiner</th>
                {CRITERIA.map((c) => (
                  <th key={c.key} className="p-2 text-right font-medium" title={`${c.weight}% of the panel score`}>
                    {c.label} <span className="num">({c.weight})</span>
                  </th>
                ))}
                <th className="p-2 text-right font-medium">Total /100</th>
              </tr>
            </thead>
            <tbody>
              {s.ballots.map((b) => {
                const t = ballotTotal(b.ballot);
                return (
                  <tr key={b.examiner} className="border-b border-line-soft">
                    <td className="p-2">{b.examiner}</td>
                    {CRITERIA.map((c) => (
                      <td key={c.key} className="num p-2 text-right">{fmt(b.ballot[c.key] ?? null)}</td>
                    ))}
                    <td className="num p-2 text-right">{t.scored ? t.points.toFixed(1) : "—"}</td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td className="p-2">Panel mean</td>
                {CRITERIA.map((c) => (
                  <td key={c.key} className="num p-2 text-right">{fmt(agg.per[c.key].mean, 2)}</td>
                ))}
                <td className="num p-2 text-right">{agg.total === null ? "—" : agg.total.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-3">
        <Mark label={`Panel /${PANEL_SHARE}`} value={panelPoints} digits={2} />
        <Mark label={`Supervisor /${SUPERVISOR_SHARE}`} value={supervisorPoints} />
        <Mark label="Final /100" value={final} digits={2} strong
              hint={final !== null && !complete ? "incomplete" : undefined} />
      </dl>

      <Notes text={s.notes} />
    </>
  );
}

function MiniDetail({ s }: { s: MiniHit }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Fact label="Supervisor">
          <Link href={`/mini/${s.supervisorId}`} className="text-knust underline-offset-2 hover:underline">
            {s.supervisorName}
          </Link>
        </Fact>
        <Mark label={`Mini project /${MINI_MAX}`} value={s.mark} strong />
      </dl>
      <Notes text={s.notes} />
    </>
  );
}

function Mark({ label, value, digits = 1, strong, hint }: {
  label: string; value: number | null; digits?: number; strong?: boolean; hint?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2">
      <dt className="eyebrow">{label}</dt>
      <dd className={`num mt-0.5 ${strong ? "text-[18px] font-semibold" : "text-[15px]"} ${value === null ? "text-ink-3" : ""}`}>
        {value === null ? "—" : value.toFixed(digits)}
        {hint && <span className="block text-[10.5px] font-normal text-warn">{hint}</span>}
      </dd>
    </div>
  );
}
