"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { CRITERIA, aggregate, ballotTotal, type Ballot, type CriterionKey } from "@/lib/rubric";

export type Student = {
  id: string; name: string; indexNo: string;
  studentId: string | null; supervisor: string | null;
};
export type Group = { number: number; students: Student[] };
export type Examiner = { id: string; name: string };
export type Room = { id: string; code: string; label: string; venue: string; day: string };
export type ScoreRow = Ballot & {
  studentId: string; examinerId: string; notes: string; updatedAt?: string;
};

const key = (studentId: string, examinerId: string) => `${studentId}|${examinerId}`;
const pipId = (studentId: string, c: CriterionKey, i: number) => `pip-${studentId}-${c}-${i}`;

/** A write that failed, kept so the examiner can retry the exact same change. */
type Failure = { message: string; patch: Partial<ScoreRow>; rollback: ScoreRow | null };

export default function RoomBoard({
  room, examiners, groups, initialScores,
}: {
  room: Room; examiners: Examiner[]; groups: Group[]; initialScores: ScoreRow[];
}) {
  const [examinerId, setExaminerId] = useState<string | null>(null);
  // localStorage is only readable after mount. Rendering the picker before that
  // meant a returning examiner saw "Who is scoring?" flash on every navigation.
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<number>(groups[0]?.number ?? 0);
  const [scores, setScores] = useState<Map<string, ScoreRow>>(
    () => new Map(initialScores.map((s) => [key(s.studentId, s.examinerId), s]))
  );
  const [saving, setSaving] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [failures, setFailures] = useState<Map<string, Failure>>(new Map());
  const [filter, setFilter] = useState("");
  // Under md the rail stacks above the ballots, so it stays collapsed to one
  // line — otherwise every group change means scrolling a 600px list.
  const [railOpen, setRailOpen] = useState(false);

  // Keys with a write in flight or queued — a poll must not overwrite them.
  const pending = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const storageKey = `defense-scoring/examiner/${room.id}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && examiners.some((e) => e.id === saved)) setExaminerId(saved);
    } catch { /* private window — the picker just shows every time */ }
    setReady(true);
  }, [storageKey, examiners]);

  const chooseExaminer = (id: string) => {
    setExaminerId(id);
    try { localStorage.setItem(storageKey, id); } catch { /* not fatal */ }
  };

  /* Pull the co-examiner's work in while this panel is scoring. */
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(apiUrl(`/api/rooms/${room.id}`), { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data: { scores: ScoreRow[] } = await res.json();
        setScores((prev) => {
          const next = new Map(prev);
          for (const s of data.scores) {
            const k = key(s.studentId, s.examinerId);
            if (!pending.current.has(k)) next.set(k, s);
          }
          return next;
        });
      } catch { /* offline for a moment; the next tick retries */ }
    };
    const id = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(id); };
  }, [room.id]);

  const clearFailure = useCallback((studentId: string) => {
    setFailures((prev) => {
      if (!prev.has(studentId)) return prev;
      const next = new Map(prev); next.delete(studentId); return next;
    });
  }, []);

  const save = useCallback(
    (studentId: string, patch: Partial<ScoreRow>, delay: number, rollback: ScoreRow | null) => {
      if (!examinerId) return;
      const k = key(studentId, examinerId);
      pending.current.add(k);
      setSaving((n) => n + 1);

      const existing = timers.current.get(k);
      if (existing) { clearTimeout(existing); setSaving((n) => Math.max(0, n - 1)); }

      timers.current.set(k, setTimeout(async () => {
        timers.current.delete(k);
        try {
          const res = await fetch(apiUrl("/api/scores"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ studentId, examinerId, patch }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? "Could not save that score");
          }
          const { score } = await res.json();
          setScores((prev) => new Map(prev).set(k, score));
          setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          clearFailure(studentId);
        } catch (e) {
          // The optimistic value goes back. Leaving it on screen meant the
          // ballot showed a score the database had never accepted, and the
          // next poll silently took it away 8 seconds later.
          if (rollback !== null) {
            setScores((prev) => new Map(prev).set(k, rollback));
          } else {
            setScores((prev) => { const n = new Map(prev); n.delete(k); return n; });
          }
          setFailures((prev) => new Map(prev).set(studentId, {
            message: e instanceof Error ? e.message : "Could not save that score",
            patch, rollback,
          }));
        } finally {
          pending.current.delete(k);
          setSaving((n) => Math.max(0, n - 1));
        }
      }, delay));
    },
    [examinerId, clearFailure]
  );

  /** `toggle` is how a tap behaves: tapping the live value clears it. The
      keyboard always sets exactly, since arrowing onto a value must select it. */
  const setScore = (
    studentId: string, criterion: CriterionKey, value: number, toggle = true
  ) => {
    if (!examinerId) return;
    const k = key(studentId, examinerId);
    const cur = scores.get(k) ?? null;
    const next = toggle && cur?.[criterion] === value ? null : value;
    setScores((prev) => {
      const row: ScoreRow = { studentId, examinerId, notes: "", ...cur, [criterion]: next };
      return new Map(prev).set(k, row);
    });
    save(studentId, { [criterion]: next } as Partial<ScoreRow>, 200, cur);
  };

  const setNotes = (studentId: string, notes: string) => {
    if (!examinerId) return;
    const k = key(studentId, examinerId);
    const cur = scores.get(k) ?? null;
    setScores((prev) => {
      const row: ScoreRow = { studentId, examinerId, ...prev.get(k), notes };
      return new Map(prev).set(k, row);
    });
    // Notes are never rolled back — that would delete what the examiner typed.
    save(studentId, { notes }, 700, cur);
  };

  const retry = (studentId: string) => {
    const f = failures.get(studentId);
    if (!f) return;
    clearFailure(studentId);
    save(studentId, f.patch, 0, f.rollback);
  };

  const visibleGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        String(g.number).includes(q) ||
        g.students.some(
          (s) => s.name.toLowerCase().includes(q) || s.indexNo.includes(q)
        )
    );
  }, [groups, filter]);

  const group = groups.find((g) => g.number === selected) ?? groups[0];

  const myProgress = useCallback((g: Group) => {
    if (!examinerId) return 0;
    return g.students.filter(
      (s) => ballotTotal(scores.get(key(s.id, examinerId))).complete
    ).length;
  }, [examinerId, scores]);

  const totalDone = groups.reduce((n, g) => n + myProgress(g), 0);
  const totalStudents = groups.reduce((n, g) => n + g.students.length, 0);
  const me = examiners.find((e) => e.id === examinerId);

  /** The next group, wrapping, that still has a ballot this examiner owes. */
  const goToNextUnscored = () => {
    const start = groups.findIndex((g) => g.number === selected);
    for (let i = 1; i <= groups.length; i++) {
      const g = groups[(start + i) % groups.length];
      if (myProgress(g) < g.students.length) {
        setSelected(g.number);
        setRailOpen(false);
        requestAnimationFrame(() => {
          document.getElementById("ballots")?.scrollIntoView({ block: "start" });
        });
        return;
      }
    }
  };

  const onScaleKey = (
    e: React.KeyboardEvent, studentId: string, c: CriterionKey, i: number
  ) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % 11;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i + 10) % 11;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 10;
    else if (/^[0-9]$/.test(e.key)) next = Number(e.key);
    if (next === null) return;
    e.preventDefault();
    setScore(studentId, c, next, false);
    document.getElementById(pipId(studentId, c, next))?.focus();
  };

  if (!ready) {
    return (
      <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading the room">
        <div className="h-6 w-48 animate-pulse rounded bg-sunken" />
        <div className="h-64 animate-pulse rounded-xl bg-sunken/60" />
      </div>
    );
  }

  if (!examinerId) {
    return (
      <main className="mt-10 flex justify-center">
        <div className="card w-full max-w-md border-t-4 border-t-knust p-6">
          <p className="num text-[12px] text-ink-3">{room.label} · {room.venue}</p>
          <h1 className="mt-1 font-display text-[19px] font-bold">Who is scoring?</h1>
          <p className="mt-1.5 text-[13px] text-ink-2">
            Pick your name. Every ballot you file is recorded against it, and your
            co-examiner scores the same students separately.
          </p>
          <div className="mt-4 grid gap-2">
            {examiners.map((e) => (
              <button key={e.id} onClick={() => chooseExaminer(e.id)}
                      className="btn w-full py-3 text-left text-[14px] font-semibold hover:border-knust">
                {e.name}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="num text-[12px] text-ink-3">{room.venue} · {room.day}</p>
          <h1 className="font-display text-[22px] font-bold">{room.label}</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            Panel: {examiners.map((e) => e.name).join(" · ")}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto">
          {/* Stacked, this drops below the buttons and reads as one line rather
              than wrapping four times inside a narrow right-aligned column. */}
          <div className="num order-last flex w-full flex-wrap gap-x-2 text-[11.5px] text-ink-3 sm:order-none sm:w-auto sm:flex-col sm:items-end sm:gap-x-0">
            <span>{totalDone} of {totalStudents} scored by you</span>
            <span aria-live="polite"
                  className={`before:mr-2 before:content-['·'] sm:before:content-none ${
                    saving ? "text-warn" : "text-ink-3"}`}>
              {saving ? "Saving…" : savedAt ? `Saved ${savedAt}` : "Scores save as you tap"}
            </div>
          </div>
          <button onClick={goToNextUnscored} className="btn shrink-0"
                  disabled={totalDone === totalStudents}
                  title="Jump to the next group with a ballot you still owe">
            Next unscored
          </button>
          <a href={`/api/results?format=csv&room=${room.id}`} className="btn shrink-0"
             title={`Export every ballot filed in ${room.label}`}>
            Export room CSV
          </a>
          <button onClick={() => chooseExaminer("")} className="btn"
                  title="Hand the laptop to your co-examiner">
            {me?.name ?? "Choose name"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Group rail */}
        <section aria-label="Groups" className="card overflow-hidden md:sticky md:top-4">
          {/* Stacked layout only: which group is open, and a way to change it. */}
          <button type="button" onClick={() => setRailOpen((o) => !o)}
                  aria-expanded={railOpen}
                  className="flex w-full items-center gap-3 p-3 text-left md:hidden">
            <span className="num shrink-0 text-[12px] text-ink-3">
              {String(group?.number ?? 0).padStart(3, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
              {group?.students.map((s) => s.name).join(", ")}
            </span>
            <span className="eyebrow shrink-0">{railOpen ? "Close" : "Change"}</span>
          </button>
          <div className={`${railOpen ? "" : "hidden"} border-t border-line-soft md:block md:border-t-0`}>
            <div className="border-b border-line-soft p-3">
              <label htmlFor="group-filter" className="sr-only">Find a group</label>
              <input id="group-filter" value={filter} onChange={(e) => setFilter(e.target.value)}
                     placeholder="Find a group, name or index no."
                     className="field" />
            </div>
            <div className="max-h-[55vh] overflow-y-auto md:max-h-[calc(100vh-9rem)]">
              {visibleGroups.map((g) => {
                const done = myProgress(g);
                const isOpen = g.number === group?.number;
                return (
                  <button key={g.number}
                          onClick={() => { setSelected(g.number); setRailOpen(false); }}
                          aria-current={isOpen ? "true" : undefined}
                          className={`flex w-full items-start gap-3 border-b border-line-soft p-3 text-left transition ${
                            isOpen ? "bg-knust-soft" : "hover:bg-surface-2"
                          }`}>
                    <span className={`num pt-0.5 text-[12px] ${isOpen ? "text-knust" : "text-ink-3"}`}>
                      {String(g.number).padStart(3, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[13px] ${isOpen ? "font-bold" : "font-semibold"}`}>
                        {g.students.map((s) => s.name).join(", ")}
                      </span>
                      <span className="num mt-0.5 block text-[11.5px] text-ink-3">
                        {done}/{g.students.length} scored
                      </span>
                    </span>
                    <span aria-hidden className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      done === g.students.length
                        ? "bg-knust-2"
                        : done ? "bg-gold" : "border border-line bg-surface"
                    }`} />
                  </button>
                );
              })}
              {!visibleGroups.length && (
                <p className="p-6 text-center text-[12.5px] text-ink-3">Nothing matches that search.</p>
              )}
            </div>
          </div>
        </section>

        {/* Ballots for the open group */}
        <section id="ballots" aria-label="Ballots" className="grid gap-5">
          {group?.students.map((s) => {
            const mine = scores.get(key(s.id, examinerId)) ?? null;
            const t = ballotTotal(mine);
            const filed = examiners
              .map((e) => ({ examiner: e, row: scores.get(key(s.id, e.id)) ?? null }))
              .filter((x) => ballotTotal(x.row).scored > 0);
            const agg = aggregate(
              examiners.map((e) => scores.get(key(s.id, e.id))).filter(Boolean) as Ballot[]
            );
            const fail = failures.get(s.id);
            const wide = CRITERIA.filter((c) => agg.per[c.key].spread >= 4);

            return (
              <article key={s.id} className="card @container overflow-hidden">
                <header className="flex items-start gap-4 border-b border-line-soft p-4">
                  <div className="min-w-0 flex-1">
                    <p className="num text-[11.5px] text-ink-3">Group {group.number}</p>
                    <h2 className="font-display text-[18px] font-bold">{s.name}</h2>
                    <p className="num mt-0.5 text-[11.5px] text-ink-3">
                      Index {s.indexNo}
                      {s.studentId ? ` · ID ${s.studentId}` : ""}
                    </p>
                    {s.supervisor && (
                      <p className="mt-0.5 text-[11.5px] text-ink-3">Supervisor: {s.supervisor}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {/* An unscored ballot used to render a confident 0.0, which
                        is the opposite of what a null criterion means here. */}
                    <div className="num text-[26px] font-semibold leading-none tracking-tight sm:text-[32px]">
                      {t.scored ? t.points.toFixed(1) : "—"}
                      <span className="text-[12px] font-normal text-ink-3">/100</span>
                    </div>
                    <div className="num mt-1 text-[11.5px] text-ink-3">
                      {t.complete ? "your ballot" : `${t.scored} of ${CRITERIA.length} scored`}
                    </div>
                  </div>
                </header>

                {fail && (
                  <div role="alert"
                       className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-soft bg-alert/5 px-4 py-2.5">
                    <p className="min-w-0 flex-1 text-[12.5px] text-alert">
                      {fail.message}. {s.name.split(" ")[0]}&rsquo;s score was put back to what is saved.
                    </p>
                    <button onClick={() => retry(s.id)} className="btn shrink-0">Try again</button>
                  </div>
                )}

                {CRITERIA.map((c) => {
                  const v = mine?.[c.key];
                  const has = typeof v === "number";
                  const headingId = `crit-${s.id}-${c.key}`;
                  return (
                    <div key={c.key}
                         className="grid gap-3 border-b border-line-soft p-4 @[620px]:grid-cols-[minmax(0,1fr)_minmax(240px,352px)] @[620px]:items-center">
                      <div className="min-w-0">
                        <h3 id={headingId}
                            className="flex items-center gap-2 font-display text-[14px] font-semibold">
                          <span className="min-w-0 truncate">{c.label}</span>
                          <span className="num shrink-0 rounded bg-sunken px-1.5 py-px text-[10.5px] text-ink-2">
                            {c.weight}%
                          </span>
                          {/* The earned points ride the title line: on a phone
                              that saves a whole row over sitting beside the strip. */}
                          <span className={`num ml-auto shrink-0 whitespace-nowrap text-[12.5px] font-normal ${
                            has ? "text-ink-2" : "text-ink-3"}`}>
                            {has ? <b className="text-ink">{(((v as number) / 10) * c.weight).toFixed(1)}</b> : "—"}
                            {" / "}{c.weight.toFixed(1)}
                          </span>
                        </h3>
                        <p className="mt-0.5 max-w-[56ch] text-[12px] text-ink-3">{c.blurb}</p>
                      </div>
                      {/* A radiogroup, not eleven toggle buttons: one tab stop,
                          arrow keys to move, digits 0-9 to file a score outright. */}
                      <div role="radiogroup" aria-labelledby={headingId}
                           className="grid grid-cols-11 gap-[3px] max-[380px]:gap-[2px]">
                        {Array.from({ length: 11 }, (_, i) => (
                          <button key={i} type="button" className="pip"
                                  id={pipId(s.id, c.key, i)}
                                  role="radio"
                                  aria-checked={has && v === i}
                                  aria-label={`${i}`}
                                  tabIndex={(has ? v === i : i === 0) ? 0 : -1}
                                  data-state={has && v === i ? "on" : has && i < (v as number) ? "below" : "off"}
                                  onKeyDown={(e) => onScaleKey(e, s.id, c.key, i)}
                                  onClick={() => setScore(s.id, c.key, i)}>
                            {i}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="border-b border-line-soft p-4">
                  <label htmlFor={`notes-${s.id}`} className="text-[12.5px] font-semibold">
                    Your notes on {s.name.split(" ")[0]}
                  </label>
                  <textarea
                    id={`notes-${s.id}`}
                    value={mine?.notes ?? ""}
                    onChange={(e) => setNotes(s.id, e.target.value)}
                    placeholder="What stood out, what you pushed back on, what you asked in questions."
                    className="field mt-1.5 min-h-[64px] resize-y leading-relaxed"
                  />
                </div>

                <div className="p-4">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <h3 className="font-display text-[13px] font-semibold">Panel view</h3>
                    <span className="text-[11.5px] text-ink-3">
                      {agg.total == null
                        ? "no ballots filed yet"
                        : filed.length < examiners.length
                          ? `${agg.total.toFixed(1)}/100 from ${filed.length} of ${examiners.length} ballots`
                          : `panel mean ${agg.total.toFixed(1)}/100`}
                    </span>
                  </div>
                  {/* The co-examiner's numbers used to be a bare row of digits
                      whose criterion lived in a title attribute — unreadable on
                      touch, and exactly when you are comparing. */}
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[380px] border-separate border-spacing-0 text-[11.5px]">
                      <thead>
                        <tr className="text-left text-ink-3">
                          <th className="py-1 pr-3 font-medium">Examiner</th>
                          {CRITERIA.map((c) => (
                            <th key={c.key} className="num py-1 px-1.5 text-right font-medium">
                              {c.short}
                            </th>
                          ))}
                          <th className="num py-1 pl-3 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {examiners.map((e) => {
                          const row = scores.get(key(s.id, e.id)) ?? null;
                          const ot = ballotTotal(row);
                          const isMe = e.id === examinerId;
                          return (
                            <tr key={e.id}>
                              <td className={`border-t border-line-soft py-1.5 pr-3 ${
                                isMe ? "font-semibold" : "text-ink-2"}`}>
                                {isMe ? "You" : e.name}
                              </td>
                              {CRITERIA.map((c) => (
                                <td key={c.key}
                                    className="num border-t border-line-soft px-1.5 py-1.5 text-right text-ink-2">
                                  {row?.[c.key] ?? "–"}
                                </td>
                              ))}
                              <td className="num border-t border-line-soft py-1.5 pl-3 text-right font-semibold">
                                {ot.scored ? `${ot.points.toFixed(1)}` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {wide.length > 0 && (
                    <p className="mt-2.5 text-[11.5px] text-alert">
                      Wide disagreement on {wide.map((c) => c.label).join(", ")} — worth
                      settling before you move on.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
