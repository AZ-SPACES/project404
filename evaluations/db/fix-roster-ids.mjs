// Corrects three identifiers the department's own records disagree on.
//
//   node db/fix-roster-ids.mjs --dry-run
//   node db/fix-roster-ids.mjs
//
// Each correction names the value it expects to find and the value it should
// become, and is only ever written when the current value is the expected wrong
// one. A row already carrying the right value is reported and left alone, and a
// row carrying something else entirely is skipped rather than guessed at — so
// this is safe to run twice, and safe to run against a database that has been
// partly corrected by hand.
//
// Nothing here touches students.id. It is the primary key that `scores` and
// `supervisor_scores` point at, and Postgres does not cascade an update, so
// re-keying a student would detach every mark already recorded against them. The
// id keeps whatever index number it was minted from; it is opaque and nothing
// reads meaning out of it.
const url = process.env.DATABASE_URL ?? "postgres://defense:defense@localhost:5433/defense";
const dryRun = process.argv.includes("--dry-run");

const CORRECTIONS = [
  {
    what: "NHYIRA AKUA GODSON's student ID",
    find: { column: "index_no", value: "3392322" },
    fix:  { column: "student_id", expect: "20948238", to: "20901740" },
    why: "20948238 is Kelvin Ankomah's (index 3371222). The CS4 allocation gives " +
         "Godson 20901740, and his index number is not in dispute.",
  },
  {
    what: "MARTIN OBIRI DANSO's student ID",
    find: { column: "index_no", value: "3387522" },
    fix:  { column: "student_id", expect: "20953083", to: "20889448" },
    why: "20953083 is Mahfuz Agbor Seidu's (index 3364722). The CS4 allocation " +
         "gives Danso 20889448.",
  },
  {
    what: "ESSANDOH PRINCE TAKYI's index number",
    find: { column: "student_id", value: "20940308" },
    fix:  { column: "index_no", expect: "3390922", to: "3390822" },
    why: "3390922 is Nuhu Kofi Essuman's. Two students cannot share one index " +
         "number; the CS4 allocation gives Essandoh 3390822 against this same " +
         "student ID.",
  },
];

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: url });
await client.connect();

let toWrite = 0, already = 0, skipped = 0;

try {
  await client.query("begin");

  for (const c of CORRECTIONS) {
    const { rows } = await client.query(
      `select id, name, index_no, student_id from students where ${c.find.column} = $1`,
      [c.find.value]
    );

    if (rows.length !== 1) {
      console.log(`SKIP  ${c.what}`);
      console.log(`      ${rows.length} students have ${c.find.column} = ${c.find.value}; expected exactly 1.`);
      skipped++;
      continue;
    }

    const row = rows[0];
    const current = row[c.fix.column];

    if (current === c.fix.to) {
      console.log(`OK    ${c.what} is already ${c.fix.to} (${row.name}).`);
      already++;
      continue;
    }
    if (current !== c.fix.expect) {
      console.log(`SKIP  ${c.what}`);
      console.log(`      ${row.name} has ${c.fix.column} = ${current ?? "null"}, which is neither the known-wrong ${c.fix.expect} nor the correct ${c.fix.to}.`);
      skipped++;
      continue;
    }

    console.log(`FIX   ${c.what}`);
    console.log(`      ${row.name} (${row.id}): ${c.fix.column} ${current} -> ${c.fix.to}`);
    console.log(`      ${c.why}`);
    toWrite++;

    if (!dryRun) {
      await client.query(
        `update students set ${c.fix.column} = $2 where id = $1`,
        [row.id, c.fix.to]
      );
    }
  }

  // The whole point of the third correction is that this stops being possible.
  const { rows: dupes } = await client.query(`
    select index_no, count(*)::int as n, string_agg(name, ' / ') as who
      from students group by index_no having count(*) > 1 order by index_no
  `);

  if (dryRun) {
    await client.query("rollback");
    console.log(`\n--dry-run: ${toWrite} to change, ${already} already correct, ${skipped} skipped. Nothing written.`);
  } else {
    await client.query("commit");
    console.log(`\n${toWrite} corrected, ${already} already correct, ${skipped} skipped.`);
  }

  if (dupes.length) {
    console.log(`\nIndex numbers still shared by more than one student:`);
    for (const d of dupes) console.log(`  ${d.index_no}  (${d.n})  ${d.who}`);
  } else {
    console.log(`Every index number is now unique.`);
  }
} catch (e) {
  await client.query("rollback").catch(() => {});
  throw e;
} finally {
  await client.end();
}
