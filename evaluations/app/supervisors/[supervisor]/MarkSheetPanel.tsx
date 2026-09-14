"use client";

import { useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { SUPERVISOR_SHARE } from "@/lib/rubric";

type Change = {
  studentId: string; name: string; indexNo: string;
  from: number | null; to: number | null;
  notesFrom: string; notesTo: string;
};
type Problem = { row: number; label: string; reason: string };
type Reading = {
  filename?: string; changes: Change[];
  unchanged: number; blank: number; problems: Problem[];
};

const fmt = (n: number | null) => (n === null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Download a sheet, fill it in offline, upload it back.
 *
 * The upload is always previewed before it is written: the supervisor sees every
 * mark that would change, and from what to what, and only then agrees. Applying
 * without that step would make a mis-sorted spreadsheet unrecoverable.
 */
export default function MarkSheetPanel({
  supervisorId, onApplied,
}: {
  supervisorId: string;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "preview" | "commit">(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<File | null>(null);

  const send = async (file: File, commit: boolean) => {
    setBusy(commit ? "commit" : "preview");
    setError(null);
    if (!commit) setDone(null);
    try {
      const body = new FormData();
      body.set("file", file);
      if (commit) body.set("commit", "1");
      const res = await fetch(apiUrl(`/api/supervisors/${supervisorId}/marks`), {
        method: "POST", body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That sheet could not be read");
      if (commit) {
        setDone(`${data.applied} mark${data.applied === 1 ? "" : "s"} saved from ${file.name}.`);
        setReading(null);
        pending.current = null;
        if (fileRef.current) fileRef.current.value = "";
        onApplied();
      } else {
        setReading({ ...data, filename: file.name });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That sheet could not be read");
    } finally {
      setBusy(null);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pending.current = file;
    send(file, false);
  };

  const reset = () => {
    setReading(null); setError(null); setDone(null);
    pending.current = null;
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section className="card mt-4 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold">Mark offline in Excel</span>
          <span className="block text-[11.5px] text-ink-3">
            Download your students, fill in the mark column, upload it back.
          </span>
        </span>
        <span className="eyebrow shrink-0">{open ? "Close" : "Open"}</span>
      </button>

      {open && (
        <div className="border-t border-line-soft p-4">
          <div className="flex flex-wrap items-center gap-2">
            <a href={apiUrl(`/api/supervisors/${supervisorId}/sheet?format=xlsx`)} className="btn">
              Download Excel
            </a>
            <a href={apiUrl(`/api/supervisors/${supervisorId}/sheet?format=csv`)} className="btn">
              Download CSV
            </a>
            <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
            <button type="button" onClick={() => fileRef.current?.click()}
                    disabled={busy !== null} className="btn btn-primary">
              {busy === "preview" ? "Reading…" : "Upload filled sheet"}
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xlsm" onChange={onPick}
                   className="sr-only" />
          </div>
          <p className="mt-2.5 max-w-[70ch] text-[11.5px] text-ink-3">
            Marks are 0–{SUPERVISOR_SHARE}, to one decimal place. A row left blank is
            left alone, so you can send the sheet back in batches. Keep the{" "}
            <span className="num">Ref</span> column — it is what matches each row to
            the right student.
          </p>

          {error && (
            <p className="mt-3 rounded-md border border-alert/30 bg-alert/5 px-3 py-2 text-[12.5px] text-alert">
              {error}
            </p>
          )}
          {done && (
            <p className="mt-3 rounded-md border border-knust/30 bg-knust-soft px-3 py-2 text-[12.5px] text-knust">
              {done}
            </p>
          )}

          {reading && (
            <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-display text-[13.5px] font-semibold">
                  {reading.filename}
                </h4>
                <p className="num text-[11.5px] text-ink-3">
                  {reading.changes.length} to change · {reading.unchanged} already the same
                  {reading.blank ? ` · ${reading.blank} blank` : ""}
                  {reading.problems.length ? ` · ${reading.problems.length} skipped` : ""}
                </p>
              </div>

              {reading.problems.length > 0 && (
                <ul className="mt-2.5 grid gap-1 rounded-md border border-alert/30 bg-alert/5 p-2.5 text-[11.5px] text-alert">
                  {reading.problems.slice(0, 8).map((p, i) => (
                    <li key={i}>
                      <span className="num">Row {p.row}</span>
                      {p.label ? ` (${p.label})` : ""} — {p.reason}
                    </li>
                  ))}
                  {reading.problems.length > 8 && (
                    <li className="text-ink-3">…and {reading.problems.length - 8} more.</li>
                  )}
                </ul>
              )}

              {reading.changes.length > 0 ? (
                <div className="mt-2.5 max-h-[260px] overflow-y-auto rounded-md border border-line bg-surface">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {reading.changes.map((c) => (
                        <tr key={c.studentId} className="border-b border-line-soft last:border-0">
                          <td className="p-2">
                            <span className="block font-medium">{c.name}</span>
                            <span className="num block text-[10.5px] text-ink-3">{c.indexNo}</span>
                          </td>
                          <td className="num p-2 text-right text-ink-3">{fmt(c.from)}</td>
                          <td className="p-2 text-center text-ink-3">→</td>
                          <td className="num p-2 text-right font-semibold">{fmt(c.to)}</td>
                          <td className="p-2 text-[11px] text-ink-3">
                            {c.notesTo !== c.notesFrom ? "note updated" : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2.5 text-[12.5px] text-ink-3">
                  Nothing in that sheet would change.
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary"
                        disabled={busy !== null || !reading.changes.length}
                        onClick={() => pending.current && send(pending.current, true)}>
                  {busy === "commit"
                    ? "Saving…"
                    : `Apply ${reading.changes.length} mark${reading.changes.length === 1 ? "" : "s"}`}
                </button>
                <button type="button" className="btn" onClick={reset} disabled={busy !== null}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
