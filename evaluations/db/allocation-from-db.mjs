// Writes data/allocation.json from whatever database DATABASE_URL points at.
//
//   DATABASE_URL=... node db/allocation-from-db.mjs            # to data/allocation.json
//   DATABASE_URL=... node db/allocation-from-db.mjs --stdout   # to stdout, to diff first
//
// The seed file is meant to be a snapshot of the roster, and it stopped being one:
// names were corrected and students regrouped inside the app, so the checked-in
// copy would have reverted that work if anyone had re-seeded. Regenerating it from
// a live database is what keeps `db:seed` honest — run this against production
// after any run of corrections, and commit the result.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "data", "allocation.json");
const toStdout = process.argv.includes("--stdout");
const url = process.env.DATABASE_URL ?? "postgres://defense:defense@localhost:5433/defense";

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const { rows: rooms } = await client.query(`
    select r.code as id, r.label, r.venue, r.day,
           coalesce((
             select json_agg(e.name order by e.sort)
               from examiners e where e.room_id = r.id
           ), '[]'::json) as examiners
      from rooms r order by r.sort
  `);

  const { rows: groups } = await client.query(`
    select g.number as group, r.code as room,
           coalesce((
             select json_agg(json_build_object(
                      'name', s.name, 'index', s.index_no,
                      'studentId', s.student_id, 'supervisor', s.supervisor,
                      'id', s.id) order by s.sort, s.name)
               from students s where s.group_number = g.number
           ), '[]'::json) as students
      from groups g join rooms r on r.id = g.room_id
     order by g.number
  `);

  // Supervisees who never sat the defense sit outside the room allocation
  // entirely. They are still part of the roster, so a seed built from this file
  // has to be able to put them back.
  const { rows: unscheduled } = await client.query(`
    select s.name, s.index_no as "index", s.student_id as "studentId",
           s.supervisor, s.id
      from students s where s.group_number is null
     order by s.name
  `);

  const students = groups.reduce((n, g) => n + g.students.length, 0);
  const payload = {
    title: "DEFENSE ALLOCATION FOR COMPUTER SCIENCE 2026",
    generated: new Date().toISOString().slice(0, 10),
    source: `database ${new URL(url).pathname.slice(1)}`,
    rooms, groups, unscheduled,
  };
  const json = JSON.stringify(payload, null, 1) + "\n";

  if (toStdout) process.stdout.write(json);
  else await writeFile(out, json);

  console.error(
    `${rooms.length} rooms, ${groups.length} groups, ${students} students` +
    `, ${unscheduled.length} unscheduled` +
    (toStdout ? "" : ` -> ${path.relative(process.cwd(), out)}`)
  );
} finally {
  await client.end();
}
