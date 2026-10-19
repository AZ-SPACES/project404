// Puts ballots and supervisor marks back from a results CSV export.
//
//   DATABASE_URL=... node db/restore-scores.mjs path/to/cs-defense-scores.csv --dry-run
//   DATABASE_URL=... node db/restore-scores.mjs path/to/cs-defense-scores.csv
//
// For rebuilding the database somewhere new after the droplet was lost. Run it on
// a database that already has the roster and supervisors:
//
//   node db/seed.mjs && node db/import-supervisors.mjs && node db/restore-scores.mjs <csv>
//
// The export is the only record that survived, so it is read as-is:
//
// - One row per examiner is a ballot. A blank criterion goes back as NULL, not 0 —
//   the same "not scored yet" it was exported from.
// - PANEL MEAN rows are derived and skipped; the app recomputes them. Only their
//   Supervisor (60%) column is read, because that is where the export puts the
//   supervisor's mark. NO PANEL SCORE rows carry the same column for students who
//   never sat the defense.
// - The Supervisor column is newer than data/supervisors.json — assignments were
//   corrected in the app after it was written — so where the two disagree the
//   student is relinked to the supervisor the export names.
// - Examiners' ballot notes were never in the export, so they cannot come back.
//
// Every row must resolve to a student and examiner in the database, or nothing is
// written: a partial restore would look complete on the results page.
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = process.env.DATABASE_URL ?? "postgres://defense:defense@localhost:5433/defense";
const dryRun = process.argv.includes("--dry-run");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: node db/restore-scores.mjs <export.csv> [--dry-run]");
  process.exit(1);
}

// RFC 4180: quoted fields, doubled quotes, CRLF. The export quotes every field.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f !== ""));
}

const [header, ...body] = parseCsv((await readFile(file, "utf8")).replace(/^﻿/, ""));
const col = (prefix) => {
  const i = header.findIndex((h) => h.startsWith(prefix));
  if (i < 0) throw new Error(`column "${prefix}…" not found in ${file}`);
  return i;
};
const C = {
  room: col("Room"), group: col("Group"), student: col("Student"), index: col("Index No"),
  supervisor: header.indexOf("Supervisor"),
  examiner: col("Examiner"), supervisorMark: col("Supervisor (60%)"),
  supervisorNotes: col("Supervisor notes"),
};
// The five criteria, in the order the export writes them.
const CRITERIA = [
  ["appearance", col("Appearance")], ["usability", col("Design & Usability")],
  ["technical", col("Technical Execution")], ["innovation", col("Innovation")],
  ["presentation", col("Presentation")],
];

const clean = (v) => (v ?? "").trim();
const norm = (v) => clean(v).toLowerCase().replace(/\s+/g, " ");
const DERIVED = new Set(["PANEL MEAN", "NO PANEL SCORE"]);

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const students = (await client.query(
    "select id, group_number, index_no, name, supervisor_id from students"
  )).rows;
  const examiners = (await client.query(
    "select e.id, e.name, r.code from examiners e join rooms r on r.id = e.room_id"
  )).rows;

  // Group + index number is unique even for the two students who share 3390922,
  // since they are in different groups. Students with no group are keyed on "".
  const studentKey = (group, index) => `${clean(String(group ?? ""))}|${clean(index)}`;
  const byKey = new Map();
  for (const s of students) {
    const k = studentKey(s.group_number, s.index_no);
    byKey.set(k, [...(byKey.get(k) ?? []), s]);
  }
  const findStudent = (r) => {
    const hits = byKey.get(studentKey(r[C.group], r[C.index])) ?? [];
    return hits.length > 1 ? hits.find((s) => norm(s.name) === norm(r[C.student])) : hits[0];
  };
  const examinerByKey = new Map(examiners.map((e) => [`${e.code}|${norm(e.name)}`, e]));
  const supervisorByName = new Map(
    (await client.query("select id, name from supervisors")).rows.map((s) => [norm(s.name), s])
  );

  const ballots = [];
  const marks = new Map(); // student id -> { supervisorId, mark, notes }
  const relinks = new Map(); // student id -> supervisor row, where the export disagrees
  const problems = [];

  for (const [n, r] of body.entries()) {
    const line = n + 2;
    const who = `line ${line} (${clean(r[C.student])}, group ${clean(r[C.group]) || "—"})`;
    const student = findStudent(r);
    if (!student) { problems.push(`${who}: no such student in the database`); continue; }

    const named = clean(r[C.supervisor]);
    if (named) {
      const sup = supervisorByName.get(norm(named));
      if (!sup) { problems.push(`${who}: no supervisor "${named}" in the database`); continue; }
      if (sup.id !== student.supervisor_id) {
        relinks.set(student.id, sup);
        student.supervisor_id = sup.id;
      }
    }

    const examinerName = clean(r[C.examiner]);
    if (DERIVED.has(examinerName)) {
      const mark = clean(r[C.supervisorMark]);
      if (!mark) continue;
      if (!student.supervisor_id) {
        problems.push(`${who}: has a supervisor mark but no supervisor — run db/import-supervisors.mjs first`);
        continue;
      }
      marks.set(student.id, {
        supervisorId: student.supervisor_id, mark: Number(mark), notes: clean(r[C.supervisorNotes]),
      });
      continue;
    }

    const examiner = examinerByKey.get(`${clean(r[C.room])}|${norm(examinerName)}`);
    if (!examiner) { problems.push(`${who}: no examiner "${examinerName}" in ${clean(r[C.room])}`); continue; }

    const values = CRITERIA.map(([, i]) => (clean(r[i]) === "" ? null : Number(clean(r[i]))));
    if (values.some((v) => v !== null && !(Number.isInteger(v) && v >= 0 && v <= 10))) {
      problems.push(`${who}: criterion outside 0–10`);
      continue;
    }
    ballots.push({ studentId: student.id, examinerId: examiner.id, values });
  }

  for (const [id, m] of marks) {
    if (!(m.mark >= 0 && m.mark <= 60)) problems.push(`student ${id}: supervisor mark ${m.mark} outside 0–60`);
  }

  console.log(`${body.length} rows read: ${ballots.length} ballots, ${marks.size} supervisor marks`);
  for (const [id, sup] of relinks) console.log(`  relink ${id} -> ${sup.name}`);
  if (problems.length) {
    console.error(`\n${problems.length} rows could not be placed — nothing written:`);
    for (const p of problems) console.error(`  ${p}`);
    process.exitCode = 1;
  } else if (dryRun) {
    console.log("dry run — nothing written");
  } else {
    await client.query("begin");
    for (const [studentId, sup] of relinks) {
      await client.query(
        "update students set supervisor_id = $2, supervisor = $3 where id = $1",
        [studentId, sup.id, sup.name]
      );
    }
    for (const b of ballots) {
      await client.query(
        `insert into scores (student_id, examiner_id, appearance, usability, technical, innovation, presentation)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (student_id, examiner_id) do update set
           appearance = excluded.appearance, usability = excluded.usability,
           technical = excluded.technical, innovation = excluded.innovation,
           presentation = excluded.presentation, updated_at = now()`,
        [b.studentId, b.examinerId, ...b.values]
      );
    }
    for (const [studentId, m] of marks) {
      await client.query(
        `insert into supervisor_scores (student_id, supervisor_id, mark, notes) values ($1,$2,$3,$4)
         on conflict (student_id) do update set
           supervisor_id = excluded.supervisor_id, mark = excluded.mark,
           notes = excluded.notes, updated_at = now()`,
        [studentId, m.supervisorId, m.mark, m.notes]
      );
    }
    await client.query("commit");
    console.log("restored");
  }
} catch (e) {
  await client.query("rollback").catch(() => {});
  throw e;
} finally {
  await client.end();
}
