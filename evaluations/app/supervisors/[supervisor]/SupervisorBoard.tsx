"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import MarkSheetPanel from "./MarkSheetPanel";
import {
  PANEL_SHARE, SUPERVISOR_SHARE, aggregate, finalMark, type Ballot,
} from "@/lib/rubric";

export type Supervisor = { id: string; name: string };
export type Supervisee = {
  id: string; name: string; indexNo: string; universityId: string | null;
  groupNumber: number | null; roomCode: string | null; roomLabel: string | null;
  ballots: Ballot[];
  mark: number | null; notes: string; updatedAt: string | null;
};

/** What the user typed, before it is known to be a number. */
type Draft = { text: string; error: string | null };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Read one keystroke's worth of input: a mark to save, an error to show, or
 * neither while the number is still being typed.
 *
 * An empty box is a deliberate "no mark yet", not a zero. A bare "48." is the
 * half-typed state of "48.5" and must not flash an error on the way through.
 */
function readMark(text: string):
  | { mark: number | null }
  | { error: string }
  | { pending: true } {
  const t = text.trim();
  if (!t) return { mark: null };
  if (/^\d{1,2}\.$/.test(t)) return { pending: true };
  if (!/^\d{1,2}(\.\d)?$/.test(t)) return { error: "Numbers only, one decimal place" };
  const n = Number(t);
  if (n > SUPERVISOR_SHARE) return { error: `Highest is ${SUPERVISOR_SHARE}` };
  return { mark: n };
}

export default function SupervisorBoard({
  supervisor, initialStudents,
}: {
  supervisor: Supervisor; initialStudents: Supervisee[];
}) {
  const [students, setStudents] = useState(initialStudents);
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const save = useCallback(
    (studentId: string, patch: { mark?: number | null; notes?: string }, delay: number) => {
      const k = `${studentId}|${Object.keys(patch)[0]}`;
      const existing = timers.current.get(k);
      if (existing) { clearTimeout(existing); setSaving((n) => Math.max(0, n - 1)); }
      setSaving((n) => n + 1);

      timers.current.set(k, setTimeout(async () => {
        timers.current.delete(k);
        try {
          const res = await fetch(apiUrl("/api/supervisor-scores"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ studentId, supervisorId: supervisor.id, patch }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? "Could not save that mark");
          }
          const { score } = await res.json();
          setStudents((prev) => prev.map((s) =>
            s.id === studentId
              ? { ...s, mark: score.mark, notes: score.notes, updatedAt: score.updatedAt }
              : s
          ));
          setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save that mark");
        } finally {
          setSaving((n) => Math.max(0, n - 1));
        }
      }, delay));
    },
    [supervisor.id]
  );

  const onMarkInput = (studentId: string, text: string) => {
    const read = readMark(text);
    setDrafts((prev) => new Map(prev).set(studentId, {
      text, error: "error" in read ? read.error : null,
    }));
    // A rejected value is never sent, so the stored mark keeps its last good
    // figure and the box shows why it is being ignored.
    if ("mark" in read) save(studentId, { mark: read.mark }, 500);
  };

  const onNotes = (studentId: string, notes: string) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, notes } : s)));
    save(studentId, { notes }, 800);
  };

  /** After a sheet upload the marks changed underneath us — pull them back in. */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/supervisors/${supervisor.id}`), { cache: "no-store" });
      if (!res.ok) return;
      const { students: fresh } = (await res.json()) as { students: Supervisee[] };
      setStudents(fresh);
      setDrafts(new Map());   // stale keystrokes would mask the marks just applied
    } catch { /* the page still shows the last good state */ }
  }, [supervisor.id]);

  const toggleNotes = (id: string) =>
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.indexNo.includes(q) ||
        String(s.groupNumber ?? "").includes(q)
    );
  }, [students, filter]);

  const marked = students.filter((s) => s.mark !== null).length;
  const didNotDefend = students.filter((s) => s.groupNumber === null).length;

  return (
    <main className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <Link href="/supervisors" className="eyebrow hover:text-ink-2">
            &larr; All supervisors
          </Link>
          <h2 className="font-display text-[22px] font-bold">{supervisor.name}</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            Your {SUPERVISOR_SHARE}% for {students.length} student
            {students.length === 1 ? "" : "s"}
            {didNotDefend > 0 && ` · ${didNotDefend} did not sit the defense`}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto">
          <div className="num order-last flex w-full flex-wrap gap-x-2 text-[11.5px] text-ink-3 sm:order-none sm:w-auto sm:flex-col sm:items-end sm:gap-x-0">
            <span>{marked} of {students.length} marked</span>
            <span className={`before:mr-2 before:content-['·'] sm:before:content-none ${saving ? "text-warn" : "text-ink-3"}`}>
              {saving ? "Saving…" : savedAt ? `Saved ${savedAt}` : "Marks save as you type"}
            </span>
          </div>
          <a href={apiUrl(`/api/results?format=csv&supervisor=${supervisor.id}`)}
             className="btn shrink-0" title="Every one of your students, with both halves of the mark">
            Export<span className="hidden sm:inline">&nbsp;CSV</span>
          </a>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-alert/30 bg-alert/5 px-3 py-2 text-[12.5px] text-alert">
          {error}
        </p>
      )}

      <MarkSheetPanel supervisorId={supervisor.id} onApplied={refresh} />

      <input value={filter} onChange={(e) => setFilter(e.target.value)}
             placeholder="Find a student by name, index no. or group"
             className="mt-4 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-[13px] outline-none placeholder:text-ink-3 focus:border-knust" />

      <ul className="mt-3 grid gap-2">
        {visible.map((s, i) => {
          const panelTotal = aggregate(s.ballots).total;
          const draft = drafts.get(s.id);
          const shown = draft?.text ?? (s.mark === null ? "" : fmt(s.mark));
          // The saved mark is what the total reflects; a half-typed or rejected
          // draft must not make the final figure jump around.
          const { panelPoints, final, complete } = finalMark(panelTotal, s.mark);
          const notesOpen = openNotes.has(s.id);

          return (
            <li key={s.id} className="card px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="flex min-w-0 flex-1 basis-[210px] items-baseline gap-2.5">
                  <span className="num shrink-0 text-[11px] text-ink-3">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold">{s.name}</p>
                    <p className="num mt-0.5 truncate text-[11px] text-ink-3">
                      {s.indexNo}
                      {s.groupNumber !== null
                        ? ` · Group ${s.groupNumber}${s.roomCode ? ` · ${s.roomCode}` : ""}`
                        : " · no defense"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 basis-[280px] items-center justify-end gap-3 sm:gap-4">
                  {/* Panel half — read-only, and explicitly absent rather than 0
                      for a student who never sat. */}
                  <div className="shrink-0 text-right">
                    <div className="eyebrow">Panel {PANEL_SHARE}</div>
                    <div className={`num text-[14px] ${panelPoints === null ? "text-ink-3" : "text-ink-2"}`}>
                      {panelPoints === null ? "—" : panelPoints.toFixed(1)}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <label htmlFor={`mark-${s.id}`} className="eyebrow block">
                      Yours {SUPERVISOR_SHARE}
                    </label>
                    <input
                      id={`mark-${s.id}`} value={shown}
                      onChange={(e) => onMarkInput(s.id, e.target.value)}
                      inputMode="decimal" autoComplete="off" placeholder="—"
                      aria-invalid={!!draft?.error}
                      aria-label={`Supervisor mark out of ${SUPERVISOR_SHARE} for ${s.name}`}
                      className={`num mt-0.5 h-10 w-[72px] rounded-md border bg-surface-2 px-2 text-right text-[15px] outline-none focus:bg-surface ${
                        draft?.error ? "border-alert text-alert" : "border-line focus:border-knust"
                      }`}
                    />
                  </div>

                  <div className="w-[58px] shrink-0 text-right">
                    <div className="eyebrow">Final</div>
                    <div className={`num text-[16px] font-semibold ${complete ? "" : "text-ink-3"}`}>
                      {final === null ? "—" : final.toFixed(1)}
                    </div>
                  </div>

                  <button type="button" onClick={() => toggleNotes(s.id)}
                          aria-expanded={notesOpen}
                          className={`btn shrink-0 self-end px-2.5 ${s.notes ? "border-knust text-knust" : ""}`}
                          title={s.notes ? "Notes on this student" : "Add a note"}>
                    {s.notes ? "Note ✓" : "Note"}
                  </button>
                </div>
              </div>

              {draft?.error && (
                <p className="mt-1.5 text-right text-[11.5px] text-alert">{draft.error}</p>
              )}

              {notesOpen && (
                <textarea
                  value={s.notes}
                  onChange={(e) => onNotes(s.id, e.target.value)}
                  placeholder="Why this mark — attendance, initiative, how the work came together."
                  className="mt-2.5 min-h-[60px] w-full resize-y rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-ink-3 focus:border-knust"
                />
              )}
            </li>
          );
        })}
        {!visible.length && (
          <li className="card p-10 text-center text-[12.5px] text-ink-3">
            Nothing matches that search.
          </li>
        )}
      </ul>
    </main>
  );
}
