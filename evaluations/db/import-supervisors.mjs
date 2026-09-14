// Adds the supervisor half of the mark to an existing database.
//
//   node db/import-supervisors.mjs --dry-run     # report, write nothing
//   node db/import-supervisors.mjs
//
// This is deliberately NOT part of `db:seed`. data/allocation.json has drifted
// from the live database — names were corrected and students regrouped in the app
// after it was written — so re-seeding would revert that work. This script only
// ever adds: it creates the 13 supervisors, links each student to theirs, and
// inserts the supervisees who never sat the defense. It does not touch `scores`,
// student names, groups or rooms. Re-running it is safe.
//
// Matching runs on the university student ID first and the index number second.
// That order matters: the department's allocation and the app disagree on one
// index number (two students are recorded under 3390922), and the student ID is
// what tells them apart.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL ?? "postgres://defense:defense@localhost:5433/defense";
const dryRun = process.argv.includes("--dry-run");

const { supervisors, assignments } = JSON.parse(
  await readFile(path.join(here, "..", "data", "supervisors.json"), "utf8")
);

const clean = (v) => (v == null ? "" : String(v).trim());

// Panels that changed on the day. Dr. Kornyo sat on the Room 4 panel in place of
// Dr. Gaddafi, so the ballots filed there are his and the name on them is wrong.
// The examiner row is renamed rather than re-keyed: `scores` points at its id, so
// replacing the row would detach every ballot already recorded against it.
const PANEL_SUBSTITUTIONS = [
  { room: "rm-4", was: "gaddafi", now: "Dr. Kornyo" },
];

/**
 * Decide which allocation row belongs to which student already in the database.
 *
 * Three passes, strongest evidence first, and a row can only ever be claimed once.
 * The order is what makes the live data's two mistyped student IDs harmless: two
 * students carry a student ID that belongs to a classmate, so pass 1 gives the ID
 * to whoever's index number agrees with it, and pass 3 places the other by index.
 *
 * Exported so the same logic can be checked against a CSV export without a
 * database in front of it.
 */
export function matchStudents(students, rows) {
  const bySid = new Map();
  const byIndex = new Map();
  for (const r of rows) {
    if (clean(r.studentId)) bySid.set(clean(r.studentId), r);
    const i = clean(r.indexNo);
    if (!i) continue;
    const list = byIndex.get(i);
    if (list) list.push(r); else byIndex.set(i, [r]);
  }

  const linked = [];      // { student, row, via }
  const ambiguous = [];   // index number claimed by more than one allocation row
  const unmatched = [];   // in the database, not in the allocation
  const claimed = new Set();
  const taken = new Set();

  const claim = (student, row, via) => {
    linked.push({ student, row, via });
    claimed.add(row);
    taken.add(student);
  };

  // 1. Student ID and index number both agree — nothing else can beat this.
  for (const s of students) {
    const row = bySid.get(clean(s.studentId));
    if (row && !claimed.has(row) && clean(row.indexNo) === clean(s.indexNo)) {
      claim(s, row, "student ID + index");
    }
  }

  // 2. Student ID alone. The app and the allocation disagree on one index number,
  //    and the ID is what settles it.
  for (const s of students) {
    if (taken.has(s)) continue;
    const row = bySid.get(clean(s.studentId));
    if (row && !claimed.has(row)) claim(s, row, "student ID");
  }

  // 3. Index number alone, for the students who carry no ID — and for the two
  //    whose ID was already, correctly, given to someone else.
  for (const s of students) {
    if (taken.has(s)) continue;
    const candidates = (byIndex.get(clean(s.indexNo)) ?? []).filter((r) => !claimed.has(r));
    if (candidates.length === 1) claim(s, candidates[0], "index no.");
    else if (candidates.length > 1) ambiguous.push({ student: s, candidates });
    else unmatched.push(s);
  }

  // Allocation rows nobody claimed: supervisees who never sat the defense.
  const unscheduled = rows.filter((r) => !claimed.has(r));

  // Worth printing rather than silently absorbing: a student ID that points at a
  // classmate's row is a typo in the roster, and the department will want it back.
  const mistypedIds = linked
    .filter((l) => l.via === "index no." && clean(l.student.studentId))
    .map((l) => ({ student: l.student, belongsTo: bySid.get(clean(l.student.studentId)) }))
    .filter((m) => m.belongsTo);

  return { linked, ambiguous, unmatched, unscheduled, mistypedIds };
}

/* -------------------------------------------------------------------------- */

if (import.meta.url === `file://${process.argv[1]}`) {
  // Imported lazily so `matchStudents` can be exercised without a driver, or a
  // database, in front of it.
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const schema = await readFile(path.join(here, "schema.sql"), "utf8");
  await client.query(schema);

  const { rows: students } = await client.query(
    `select id, name, index_no as "indexNo", student_id as "studentId", group_number as "groupNumber"
       from students order by id`
  );

  const { linked, ambiguous, unmatched, unscheduled, mistypedIds } =
    matchStudents(students, assignments);

  const via = (k) => linked.filter((l) => l.via === k).length;
  console.log(`database students          ${students.length}`);
  console.log(`allocation rows            ${assignments.length}`);
  console.log(`  linked, ID + index       ${via("student ID + index")}`);
  console.log(`  linked, student ID       ${via("student ID")}`);
  console.log(`  linked, index no.        ${via("index no.")}`);
  console.log(`  ambiguous                ${ambiguous.length}`);
  console.log(`  in database only         ${unmatched.length}`);
  console.log(`  supervisor-only adds     ${unscheduled.length}`);

  for (const a of ambiguous) {
    console.log(`\n  AMBIGUOUS  ${a.student.indexNo}  ${a.student.name}`);
    for (const c of a.candidates) console.log(`    could be  ${c.name} (ID ${c.studentId}) — ${c.supervisor}`);
  }
  for (const s of unmatched) {
    console.log(`  NO ALLOCATION ROW  ${s.indexNo}  ${s.name}`);
  }
  for (const m of mistypedIds) {
    console.log(
      `\n  CHECK  ${m.student.name} (index ${m.student.indexNo}) is recorded with student ID ` +
      `${m.student.studentId}, which the allocation gives to ${m.belongsTo.name} ` +
      `(index ${m.belongsTo.indexNo}). Placed by index number instead.`
    );
  }

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    await client.end();
    process.exit(0);
  }

  try {
    await client.query("begin");

    for (const s of supervisors) {
      await client.query(
        `insert into supervisors (id, name, sort) values ($1,$2,$3)
         on conflict (id) do update set name = excluded.name, sort = excluded.sort`,
        [s.id, s.name, s.sort]
      );
    }

    for (const sub of PANEL_SUBSTITUTIONS) {
      const { rows } = await client.query(
        `update examiners set name = $3
          where room_id = $1 and name ilike '%' || $2 || '%' and name <> $3
        returning id, name`,
        [sub.room, sub.was, sub.now]
      );
      if (rows.length) console.log(`  ${sub.room}: examiner ${rows[0].id} renamed to ${sub.now}`);
    }

    for (const { student, row } of linked) {
      await client.query(
        `update students set supervisor_id = $2, supervisor = $3 where id = $1`,
        [student.id, row.supervisorId, row.supervisor]
      );
    }

    // No group and no room: these students exist only for their supervisor's 60%.
    let added = 0;
    for (const row of unscheduled) {
      const id = `sup-${row.indexNo}`;
      const { rowCount } = await client.query(
        `insert into students (id, group_number, name, index_no, student_id, supervisor, supervisor_id, sort)
         values ($1, null, $2, $3, $4, $5, $6, 0)
         on conflict (id) do update set
           name = excluded.name, index_no = excluded.index_no,
           student_id = excluded.student_id,
           supervisor = excluded.supervisor, supervisor_id = excluded.supervisor_id`,
        [id, row.name, row.indexNo, row.studentId, row.supervisor, row.supervisorId]
      );
      added += rowCount;
    }

    await client.query("commit");
    console.log(`\n${supervisors.length} supervisors, ${linked.length} students linked, ${added} supervisor-only students written.`);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    await client.end();
  }
}
