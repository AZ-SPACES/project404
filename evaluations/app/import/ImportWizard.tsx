"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FIELDS, FIELD_LABELS, REQUIRED_FIELDS, type FieldKey } from "@/lib/importAllocation";
import { apiUrl } from "@/lib/api";

type Column = { index: number; letter: string; header: string; sample: string[] };
type RoomSummary = { id: string; code: string; label: string; groups: number; students: number };
type Preview = {
  sheetNames: string[]; sheet: string | null; headerRow: number | null;
  mapping: Record<FieldKey, number>; columns: Column[];
  error?: string; needsMapping?: boolean;
  warnings?: string[];
  sample?: { id: string; name: string; indexNo: string; groupNumber: number }[];
  summary?: {
    rooms: RoomSummary[]; groups: number; students: number; skipped: number;
    added: number; removed: number; unchanged: number;
    scoresAtRisk: number; scoresTotal: number;
  };
};
type CommitResult = {
  ok?: true; rooms: number; groups: number; students: number;
  removedStudents: number; removedGroups: number; deletedScores: number; warnings: string[];
};

export default function ImportWizard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState<CommitResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const runPreview = useCallback(
    async (f: File, opts: { sheet?: string; headerRow?: number | null; mapping?: Record<FieldKey, number> } = {}) => {
      setBusy(true); setError(null); setDone(null);
      try {
        const body = new FormData();
        body.set("file", f);
        if (opts.sheet) body.set("sheet", opts.sheet);
        if (opts.headerRow !== undefined) body.set("headerRow", opts.headerRow === null ? "" : String(opts.headerRow));
        if (opts.mapping) body.set("mapping", JSON.stringify(opts.mapping));
        const res = await fetch(apiUrl("/api/import/preview"), { method: "POST", body });
        const data: Preview & { error?: string } = await res.json();
        if (!res.ok) { setError(data.error ?? "That file could not be read."); setPreview(null); return; }
        setPreview(data);
        if (data.error) setError(data.error);
      } catch {
        setError("Upload failed. Check that the dev server is still running.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const pick = (f: File | null) => {
    setFile(f); setPreview(null); setConfirmed(false); setDone(null); setError(null);
    if (f) runPreview(f);
  };

  const remap = (field: FieldKey, column: number) => {
    if (!file || !preview) return;
    const mapping = { ...preview.mapping, [field]: column };
    setPreview({ ...preview, mapping });
    runPreview(file, { sheet: preview.sheet ?? undefined, headerRow: preview.headerRow, mapping });
  };

  const commit = async () => {
    if (!file || !preview?.summary) return;
    setBusy(true); setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      if (preview.sheet) body.set("sheet", preview.sheet);
      body.set("headerRow", preview.headerRow === null ? "" : String(preview.headerRow));
      body.set("mapping", JSON.stringify(preview.mapping));
      if (confirmed) body.set("confirmDeletions", "true");
      const res = await fetch(apiUrl("/api/import/commit"), { method: "POST", body });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "The import failed."); return; }
      setDone(data as CommitResult);
      router.refresh();
    } catch {
      setError("The import request failed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const s = preview?.summary;
  const blocked = !!s && s.removed > 0 && !confirmed;

  return (
    <div className="mt-6 grid gap-5">
      {/* Three stages, so it is clear that choosing a file is not the commit. */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        {[["Choose the file", !!file], ["Match the columns", !!preview], ["Confirm the changes", !!s]]
          .map(([label, reached], i, all) => (
            <li key={label as string} className="flex items-center gap-2">
              <span className={`num flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                reached ? "bg-knust text-white" : "bg-sunken text-ink-3"}`}>{i + 1}</span>
              <span className={reached ? "font-semibold" : "text-ink-3"}>{label as string}</span>
              {i < all.length - 1 && <span aria-hidden className="text-ink-3">→</span>}
            </li>
          ))}
      </ol>

      <section className="card p-5">
        <h2 className="font-display text-[16px] font-semibold">Upload the allocation</h2>
        <p className="mt-1 max-w-[70ch] text-[13px] text-ink-2">
          A <code className="num text-[12px]">.csv</code> or <code className="num text-[12px]">.xlsx</code> with
          one row per student. Rooms and groups are read from the sheet — either a Group column,
          or <span className="num">GROUP n</span>{" "}separator rows like the department&rsquo;s own table.
          Examiners and venues are not touched.
        </p>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xlsm,.txt"
               onChange={(e) => pick(e.target.files?.[0] ?? null)} className="hidden" />
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0] ?? null); }}
          className={`mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center transition ${
            dragging ? "border-knust bg-knust-soft" : "border-line bg-surface-2"
          }`}>
          <button className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={busy}>
            Choose file
          </button>
          <p className="text-[12.5px] text-ink-3">
            {file ? file.name : "or drop the spreadsheet here"}
          </p>
          {busy && <p className="num text-[12px] text-warn" aria-live="polite">Reading…</p>}
        </div>

        {preview && preview.sheetNames.length > 1 && (
          <label className="mt-4 flex items-center gap-2 text-[12.5px]">
            <span className="text-ink-2">Sheet</span>
            <select value={preview.sheet ?? ""} disabled={busy}
                    onChange={(e) => file && runPreview(file, { sheet: e.target.value })}
                    className="field w-auto py-1.5 text-[12.5px]">
              {preview.sheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </section>

      {error && (
        <p className="rounded-md border border-alert/30 bg-alert/5 px-4 py-3 text-[13px] text-alert">{error}</p>
      )}

      {preview && (
        <section className="card p-5">
          <h2 className="font-display text-[16px] font-semibold">Match the columns</h2>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {preview.headerRow === null
              ? "No header row was found, so columns were matched by position."
              : `Header taken from row ${preview.headerRow + 1}.`}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <label key={f} className="grid gap-1.5">
                <span className="text-[12.5px] font-medium">
                  {FIELD_LABELS[f]}
                  {REQUIRED_FIELDS.includes(f) && <span className="text-alert"> *</span>}
                </span>
                <select value={preview.mapping[f]} disabled={busy}
                        onChange={(e) => remap(f, Number(e.target.value))}
                        className="field text-[12.5px]">
                  <option value={-1}>— not in this file —</option>
                  {preview.columns.map((c) => (
                    <option key={c.index} value={c.index}>
                      {c.letter}
                      {c.header ? ` · ${c.header}` : ""}
                      {c.sample.length ? ` — ${c.sample[0].slice(0, 24)}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      {s && (
        <section className="card p-5">
          <h2 className="font-display text-[16px] font-semibold">What will change</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Students in file", s.students],
              ["New", s.added],
              ["Already there", s.unchanged],
              ["Removed", s.removed],
              ["Rows skipped", s.skipped],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-lg border border-line-soft bg-surface-2 p-3">
                <div className="num text-[22px] font-semibold leading-none">{n as number}</div>
                <div className="mt-1.5 text-[11.5px] text-ink-3">{label as string}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="py-2 pr-3 font-medium">Room</th>
                  <th className="num py-2 pr-3 text-right font-medium">Groups</th>
                  <th className="num py-2 text-right font-medium">Students</th>
                </tr>
              </thead>
              <tbody>
                {s.rooms.map((r) => (
                  <tr key={r.id} className="border-b border-line-soft last:border-0">
                    <td className="py-2 pr-3">{r.label} <span className="num text-ink-3">({r.code})</span></td>
                    <td className="num py-2 pr-3 text-right">{r.groups}</td>
                    <td className="num py-2 text-right">{r.students}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview?.sample?.length ? (
            <div className="mt-4">
              <h3 className="text-[12.5px] font-semibold">First rows as they will be saved</h3>
              <ul className="mt-1.5 grid gap-1 text-[12.5px] text-ink-2">
                {preview.sample.map((r) => (
                  <li key={r.id} className="num">
                    Group {r.groupNumber} · {r.name} · {r.indexNo}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview?.warnings?.length ? (
            <ul className="mt-4 grid gap-1.5">
              {preview.warnings.map((w) => (
                <li key={w} className="rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-[12.5px] text-warn">
                  {w}
                </li>
              ))}
            </ul>
          ) : null}

          {s.removed > 0 && (
            <label className="mt-4 flex items-start gap-2.5 rounded-md border border-alert/30 bg-alert/5 p-3 text-[12.5px] text-alert">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
                     className="mt-0.5" />
              <span>
                <b>{s.removed} student(s)</b> in the database are not in this file and will be
                deleted
                {s.scoresAtRisk > 0 ? (
                  <>, along with the <b>{s.scoresAtRisk} ballot(s)</b> already recorded
                    against them (of {s.scoresTotal} in total)</>
                ) : (
                  <> — none of them have ballots recorded</>
                )}. Tick to confirm.
              </span>
            </label>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button className="btn btn-primary" onClick={commit} disabled={busy || blocked}>
              {busy ? "Importing…" : "Import allocation"}
            </button>
            {blocked && <span className="text-[12px] text-ink-3">Confirm the deletions above first.</span>}
          </div>
        </section>
      )}

      {done && (
        <section className="card border-t-4 border-t-knust p-5">
          <h2 className="font-display text-[16px] font-semibold">Import complete</h2>
          <p className="num mt-1.5 text-[13px] text-ink-2">
            {done.students} students · {done.groups} groups · {done.rooms} rooms.
            {done.removedStudents ? ` Removed ${done.removedStudents} student(s)` : ""}
            {done.deletedScores ? ` and ${done.deletedScores} ballot(s).` : done.removedStudents ? "." : ""}
          </p>
          <a href="/" className="btn mt-4 inline-block">Back to rooms</a>
        </section>
      )}
    </div>
  );
}
