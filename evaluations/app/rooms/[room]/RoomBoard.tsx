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

export default function RoomBoard({
  room, examiners, groups, initialScores,
}: {
  room: Room; examiners: Examiner[]; groups: Group[]; initialScores: ScoreRow[];
}) {
  const [examinerId, setExaminerId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(groups[0]?.number ?? 0);
  const [scores, setScores] = useState<Map<string, ScoreRow>>(
    () => new Map(initialScores.map((s) => [key(s.studentId, s.examinerId), s]))
  );
  const [saving, setSaving] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // Keys with a write in flight or queued — a poll must not overwrite them.
  const pending = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const storageKey = `defense-scoring/examiner/${room.id}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && examiners.some((e) => e.id === saved)) setExaminerId(saved);
    } catch { /* private window — the picker just shows every time */ }
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

  const save = useCallback(
    (studentId: string, patch: Partial<ScoreRow>, delay: number) => {
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
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save that score");
        } finally {
          pending.current.delete(k);
          setSaving((n) => Math.max(0, n - 1));
        }
      }, delay));
    },
    [examinerId]
  );

  const setScore = (studentId: string, criterion: CriterionKey, value: number) => {
    if (!examinerId) return;
    const k = key(studentId, examinerId);
    const cur = scores.get(k);
    // Clicking the value already selected clears it, so a mis-tap is undoable.
    const next = cur?.[criterion] === value ? null : value;
    setScores((prev) => {
      const row: ScoreRow = { studentId, examinerId, notes: "", ...cur, [criterion]: next };
      return new Map(prev).set(k, row);
    });
    save(studentId, { [criterion]: next } as Partial<ScoreRow>, 200);
  };

  const setNotes = (studentId: string, notes: string) => {
    if (!examinerId) return;
    const k = key(studentId, examinerId);
    setScores((prev) => {
      const row: ScoreRow = { studentId, examinerId, ...prev.get(k), notes };
      return new Map(prev).set(k, row);
    });
    save(studentId, { notes }, 700);
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

  const myProgress = (g: Group) => {
    if (!examinerId) return 0;
    return g.students.filter(
      (s) => ballotTotal(scores.get(key(s.id, examinerId))).complete
    ).length;
  };

  const totalDone = groups.reduce((n, g) => n + myProgress(g), 0);
  const totalStudents = groups.reduce((n, g) => n + g.students.length, 0);
  const me = examiners.find((e) => e.id === examinerId);

  if (!examinerId) {
    return (
      <div className="mt-10 flex justify-center">
        <div className="card w-full max-w-md border-t-4 border-t-knust p-6">
          <span className="eyebrow">{room.label} · {room.venue}</span>
          <h2 className="mt-1 font-display text-[19px] font-bold">Who is scoring?</h2>
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
      </div>
    );
  }

  return (
    <main className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">{room.venue} · {room.day}</span>
          <h2 className="font-display text-[22px] font-bold">{room.label}</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            Panel: {examiners.map((e) => e.name).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="num text-right text-[11.5px] text-ink-3">
            <div>{totalDone} of {totalStudents} scored by you</div>
            <div className={saving ? "text-warn" : "text-ink-3"}>
              {saving ? "Saving…" : savedAt ? `Saved ${savedAt}` : "Scores save as you tap"}
            </div>
          </div>
          <a href={`/api/results?format=csv&room=${room.id}`} className="btn"
             title={`Export every ballot filed in ${room.label}`}>
            Export room CSV
          </a>
          <button onClick={() => chooseExaminer("")} className="btn"
                  title="Hand the laptop to your co-examiner">
            {me?.name ?? "Choose name"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-alert/30 bg-alert/5 px-3 py-2 text-[12.5px] text-alert">
          {error}
        </p>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Group rail */}
        <section className="card overflow-hidden">
          <div className="border-b border-line-soft p-3">
            <input value={filter} onChange={(e) => setFilter(e.target.value)}
                   placeholder="Find a group, name or index no."
                   className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] outline-none placeholder:text-ink-3 focus:border-knust" />
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {visibleGroups.map((g) => {
              const done = myProgress(g);
              const isOpen = g.number === group?.number;
              return (
                <button key={g.number} onClick={() => setSelected(g.number)}
                        aria-current={isOpen}
                        className={`flex w-full items-start gap-3 border-b border-line-soft border-l-[3px] p-3 text-left transition ${
                          isOpen ? "border-l-knust bg-knust-soft" : "border-l-transparent hover:bg-surface-2"
                        }`}>
                  <span className="num pt-0.5 text-[12px] text-ink-3">
                    {String(g.number).padStart(3, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">
                      {g.students.map((s) => s.name).join(", ")}
                    </span>
                    <span className="num mt-0.5 block text-[11px] text-ink-3">
                      {done}/{g.students.length} scored
                    </span>
                  </span>
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    done === g.students.length ? "bg-knust-2" : done ? "bg-gold" : "bg-sunken"
                  }`} />
                </button>
              );
            })}
            {!visibleGroups.length && (
              <p className="p-6 text-center text-[12.5px] text-ink-3">Nothing matches that search.</p>
            )}
          </div>
        </section>

        {/* Ballots for the open group */}
        <section className="grid gap-5">
          {group?.students.map((s) => {
            const mine = scores.get(key(s.id, examinerId)) ?? null;
            const t = ballotTotal(mine);
            const others = examiners
              .filter((e) => e.id !== examinerId)
              .map((e) => ({ examiner: e, row: scores.get(key(s.id, e.id)) ?? null }));
            const agg = aggregate(
              examiners.map((e) => scores.get(key(s.id, e.id))).filter(Boolean) as Ballot[]
            );

            return (
              <article key={s.id} className="card overflow-hidden">
                <header className="flex flex-wrap items-start gap-4 border-b border-line-soft p-4">
                  <div className="min-w-0">
                    <span className="eyebrow">Group {group.number}</span>
                    <h3 className="font-display text-[18px] font-bold">{s.name}</h3>
                    <p className="num mt-0.5 text-[11.5px] text-ink-3">
                      Index {s.indexNo}
                      {s.studentId ? ` · ID ${s.studentId}` : ""}
                    </p>
                    {s.supervisor && (
                      <p className="mt-0.5 text-[11.5px] text-ink-3">Supervisor: {s.supervisor}</p>
                    )}
                  </div>
                  <div className="ml-auto text-right">
                    <div className="num text-[32px] font-semibold leading-none tracking-tight">
                      {t.points.toFixed(1)}
                      <span className="text-[12px] font-normal text-ink-3">/100</span>
                    </div>
                    <div className="eyebrow mt-1">
                      {t.complete ? "your ballot" : `${t.scored} of ${CRITERIA.length} scored`}
                    </div>
                  </div>
                </header>

                {CRITERIA.map((c) => {
                  const v = mine?.[c.key];
                  const has = typeof v === "number";
                  return (
                    <div key={c.key}
                         className="grid items-center gap-3 border-b border-line-soft p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                         style={{ ["--sc" as string]: c.color, ["--scfg" as string]: c.onColor }}>
                      <div className="flex min-w-0 gap-2.5">
                        <span className="w-1 shrink-0 self-stretch rounded-sm"
                              style={{ background: c.color }} />
                        <div>
                          <h4 className="flex flex-wrap items-center gap-2 font-display text-[14px] font-semibold">
                            {c.label}
                            <span className="num rounded bg-sunken px-1.5 py-px text-[10.5px] text-ink-2">
                              {c.weight}%
                            </span>
                          </h4>
                          <p className="mt-0.5 max-w-[56ch] text-[12px] text-ink-3">{c.blurb}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <div className="flex gap-[3px]">
                          {Array.from({ length: 11 }, (_, i) => (
                            <button key={i} type="button" className="pip"
                                    aria-pressed={has && v === i}
                                    aria-label={`${c.label} score ${i}`}
                                    data-state={has && v === i ? "on" : has && i < (v as number) ? "below" : "off"}
                                    onClick={() => setScore(s.id, c.key, i)}>
                              {i}
                            </button>
                          ))}
                        </div>
                        <span className={`num w-[82px] shrink-0 whitespace-nowrap text-right text-[12.5px] ${has ? "text-ink-2" : "text-ink-3"}`}>
                          {has ? <b className="text-ink">{(((v as number) / 10) * c.weight).toFixed(1)}</b> : "—"}
                          {" / "}{c.weight.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div className="border-b border-line-soft p-4">
                  <span className="eyebrow">Your notes on {s.name.split(" ")[0]}</span>
                  <textarea
                    value={mine?.notes ?? ""}
                    onChange={(e) => setNotes(s.id, e.target.value)}
                    placeholder="What stood out, what you pushed back on, what you asked in questions."
                    className="mt-1.5 min-h-[64px] w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-ink-3 focus:border-knust"
                  />
                </div>

                <div className="p-4">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <h4 className="font-display text-[13px] font-semibold">Panel view</h4>
                    <span className="text-[11.5px] text-ink-3">
                      {agg.total == null
                        ? "no ballots filed yet"
                        : `panel mean ${agg.total.toFixed(1)}/100`}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1.5">
                    {others.map(({ examiner, row }) => {
                      const ot = ballotTotal(row);
                      return (
                        <div key={examiner.id} className="flex items-center gap-3 text-[12px]">
                          <span className="w-40 shrink-0 truncate text-ink-2">{examiner.name}</span>
                          {row ? (
                            <>
                              <span className="num flex gap-2 text-ink-3">
                                {CRITERIA.map((c) => (
                                  <span key={c.key} title={c.label}>
                                    {row[c.key] ?? "–"}
                                  </span>
                                ))}
                              </span>
                              <span className="num ml-auto font-semibold">
                                {ot.scored ? `${ot.points.toFixed(1)}/100` : "—"}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-3">not scored yet</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {CRITERIA.some((c) => agg.per[c.key].spread >= 4) && (
                    <p className="mt-2.5 text-[11.5px] text-alert">
                      Wide disagreement on{" "}
                      {CRITERIA.filter((c) => agg.per[c.key].spread >= 4).map((c) => c.label).join(", ")}
                      {" "}— worth settling before you move on.
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
