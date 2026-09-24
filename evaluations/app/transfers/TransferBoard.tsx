"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";
import type { StudentMatch } from "@/app/api/students/search/route";

export type SupervisorOption = { id: string; name: string };

type Status = { kind: "ok" | "error"; text: string };

export default function TransferBoard({ supervisors }: { supervisors: SupervisorOption[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [targets, setTargets] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Map<string, Status>>(new Map());

  // Debounced search. The AbortController drops a slow earlier response that
  // would otherwise land after a faster later one and show the wrong list.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/students/search?q=${encodeURIComponent(term)}`),
                                { cache: "no-store", signal: ctrl.signal });
        if (!res.ok) throw new Error();
        const { students } = (await res.json()) as { students: StudentMatch[] };
        setResults(students);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const setFor = <V,>(set: React.Dispatch<React.SetStateAction<Map<string, V>>>, id: string, v: V) =>
    set((prev) => new Map(prev).set(id, v));

  const transfer = async (s: StudentMatch) => {
    const to = targets.get(s.id);
    if (!to) return;
    setBusy(s.id);
    try {
      const res = await fetch(apiUrl("/api/students/transfer"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId: s.id, toSupervisorId: to }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not transfer that student");
      setResults((prev) => prev.map((r) =>
        r.id === s.id ? { ...r, supervisorId: to, supervisorName: body.toSupervisorName } : r
      ));
      setTargets((prev) => { const next = new Map(prev); next.delete(s.id); return next; });
      setFor(setStatus, s.id, {
        kind: "ok",
        text: `Moved from ${s.supervisorName ?? "no supervisor"} to ${body.toSupervisorName}`,
      });
    } catch (e) {
      setFor(setStatus, s.id, {
        kind: "error", text: e instanceof Error ? e.message : "Could not transfer that student",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mt-7">
      <span className="eyebrow">Supervisors</span>
      <h2 className="font-display text-[22px] font-bold">Transfer a student</h2>
      <p className="mt-1 max-w-[62ch] text-[13px] text-ink-2">
        Look a student up by name, index number or student ID, then pick their new
        supervisor. A mark already filed moves with them and the new supervisor can
        revise it.
      </p>

      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
             placeholder="Name, index no. or student ID"
             className="mt-5 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-[13px] outline-none placeholder:text-ink-3 focus:border-knust" />

      <ul className="mt-3 grid gap-2">
        {results.map((s) => {
          const to = targets.get(s.id) ?? "";
          const st = status.get(s.id);
          return (
            <li key={s.id} className="card px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1 basis-[240px]">
                  <p className="truncate text-[13.5px] font-semibold">{s.name}</p>
                  <p className="num mt-0.5 truncate text-[11px] text-ink-3">
                    {s.indexNo}
                    {s.universityId && ` · ${s.universityId}`}
                    {s.groupNumber !== null ? ` · Group ${s.groupNumber}` : " · no defense"}
                    {s.mark !== null && ` · marked ${s.mark}`}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-2">
                    Supervisor:{" "}
                    {s.supervisorId ? (
                      <Link href={`/supervisors/${s.supervisorId}`}
                            className="text-knust underline underline-offset-2">
                        {s.supervisorName}
                      </Link>
                    ) : <span className="text-ink-3">none</span>}
                  </p>
                </div>

                <div className="flex flex-1 basis-[300px] items-center justify-end gap-2">
                  <select value={to} onChange={(e) => setFor(setTargets, s.id, e.target.value)}
                          aria-label={`New supervisor for ${s.name}`}
                          className="h-[38px] min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 text-[12.5px] outline-none focus:border-knust sm:max-w-[260px]">
                    <option value="">Move to…</option>
                    {supervisors.filter((sv) => sv.id !== s.supervisorId).map((sv) => (
                      <option key={sv.id} value={sv.id}>{sv.name}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-primary shrink-0"
                          disabled={!to || busy !== null} onClick={() => transfer(s)}>
                    {busy === s.id ? "Moving…" : "Transfer"}
                  </button>
                </div>
              </div>
              {st && (
                <p className={`mt-2 text-[12px] ${st.kind === "ok" ? "text-knust" : "text-alert"}`}>
                  {st.text}
                </p>
              )}
            </li>
          );
        })}
        {q.trim().length >= 2 && !searching && !results.length && (
          <li className="card p-10 text-center text-[12.5px] text-ink-3">
            No student matches that search.
          </li>
        )}
      </ul>
    </main>
  );
}
