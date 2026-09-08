// Seeds rooms, examiners, groups and students from data/allocation.json.
// Idempotent: re-running updates the roster and never touches recorded scores.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL ?? "postgres://defense:defense@localhost:5433/defense";

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const data = JSON.parse(await readFile(path.join(here, "..", "data", "allocation.json"), "utf8"));
const client = new pg.Client({ connectionString: url });
await client.connect();

const schema = await readFile(path.join(here, "schema.sql"), "utf8");
await client.query(schema);

try {
  await client.query("begin");

  const roomId = new Map();
  for (const [i, r] of data.rooms.entries()) {
    const id = slug(r.id);
    roomId.set(r.id, id);
    await client.query(
      `insert into rooms (id, code, label, venue, day, sort) values ($1,$2,$3,$4,$5,$6)
       on conflict (id) do update set code=excluded.code, label=excluded.label,
         venue=excluded.venue, day=excluded.day, sort=excluded.sort`,
      [id, r.id, r.label, r.venue, r.day, i]
    );
    for (const [j, name] of r.examiners.entries()) {
      await client.query(
        `insert into examiners (id, room_id, name, sort) values ($1,$2,$3,$4)
         on conflict (id) do update set room_id=excluded.room_id, name=excluded.name, sort=excluded.sort`,
        [`${id}-${slug(name)}`, id, name, j]
      );
    }
  }

  let students = 0;
  for (const g of data.groups) {
    await client.query(
      `insert into groups (number, room_id) values ($1,$2)
       on conflict (number) do update set room_id=excluded.room_id`,
      [g.group, roomId.get(g.room)]
    );
    for (const [k, s] of g.students.entries()) {
      await client.query(
        `insert into students (id, group_number, name, index_no, student_id, supervisor, sort)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do update set group_number=excluded.group_number, name=excluded.name,
           index_no=excluded.index_no, student_id=excluded.student_id,
           supervisor=excluded.supervisor, sort=excluded.sort`,
        [s.id, g.group, s.name, s.index, s.studentId || null, s.supervisor || null, k]
      );
      students++;
    }
  }

  await client.query("commit");
  console.log(`seeded ${data.rooms.length} rooms, ${data.groups.length} groups, ${students} students`);
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  await client.end();
}
