// Loads the third-year mini project roster from data/mini-project.json.
//
//   node db/import-mini-project.mjs --dry-run     # report, write nothing
//   node db/import-mini-project.mjs
//
// Creates the mini project tables if they are missing, adds any supervisor the
// app does not have yet (Dr. Panford supervises third years only), and upserts
// every student. It never touches marks, and never touches the final-year tables
// beyond adding a supervisor. Re-running it is safe.
//
// A student who has been dropped from the JSON is reported, not deleted: their
// mark may already be in, and removing it should be a deliberate decision.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL ?? "postgres://defense:defense@localhost:5433/defense";
const dryRun = process.argv.includes("--dry-run");

const { supervisors, students } = JSON.parse(
  await readFile(path.join(here, "..", "data", "mini-project.json"), "utf8")
);

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query(await readFile(path.join(here, "schema.sql"), "utf8"));

  const known = new Set((await client.query("select id from supervisors")).rows.map((r) => r.id));
  const newSupervisors = supervisors.filter((s) => !known.has(s.id));
  const existing = new Set((await client.query("select id from mini_students")).rows.map((r) => r.id));
  const incoming = new Set(students.map((s) => s.id));
  const added = students.filter((s) => !existing.has(s.id)).length;
  const dropped = [...existing].filter((id) => !incoming.has(id));

  console.log(`${students.length} students, ${supervisors.length} supervisors`);
  console.log(`  new students             ${added}`);
  console.log(`  already present          ${students.length - added}`);
  console.log(`  new supervisors          ${newSupervisors.map((s) => s.name).join(", ") || "none"}`);
  if (dropped.length) {
    console.log(`  in database only         ${dropped.length} (left in place): ${dropped.join(", ")}`);
  }

  if (dryRun) {
    console.log("dry run — nothing written");
  } else {
    await client.query("begin");
    // New supervisors sort after everyone already listed, so the supervisor
    // picker the final years use keeps its order.
    const [{ next }] = (await client.query(
      "select coalesce(max(sort), -1) + 1 as next from supervisors"
    )).rows;
    for (const [i, s] of newSupervisors.entries()) {
      await client.query(
        `insert into supervisors (id, name, sort) values ($1, $2, $3)
         on conflict (id) do nothing`,
        [s.id, s.name, next + i]
      );
    }
    // One statement rather than 663 round trips: the database may be a long way off.
    await client.query(
      `insert into mini_students (id, index_no, name, supervisor_id, sort)
       select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[])
       on conflict (id) do update set
         index_no = excluded.index_no, name = excluded.name,
         supervisor_id = excluded.supervisor_id, sort = excluded.sort`,
      [
        students.map((s) => s.id), students.map((s) => s.indexNo),
        students.map((s) => s.name), students.map((s) => s.supervisorId),
        students.map((_, i) => i),
      ]
    );
    await client.query("commit");
    console.log("imported");
  }
} catch (e) {
  await client.query("rollback").catch(() => {});
  throw e;
} finally {
  await client.end();
}
