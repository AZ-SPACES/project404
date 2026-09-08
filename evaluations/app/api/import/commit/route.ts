import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { parseSheet } from "@/lib/parseSheet";
import {
  buildAllocation, detectMapping, EMPTY_MAPPING, FIELDS,
  REQUIRED_FIELDS, FIELD_LABELS, type Mapping,
} from "@/lib/importAllocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Upload the file as form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a .csv or .xlsx file to upload." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That file is over the 8 MB limit." }, { status: 413 });
  }

  let grid;
  try {
    ({ grid } = await parseSheet(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      (form.get("sheet") as string) || undefined
    ));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "That file could not be read." },
      { status: 400 }
    );
  }

  const detected = detectMapping(grid);
  let mapping: Mapping = detected.mapping;
  let headerRow = detected.headerRow;

  const rawMapping = form.get("mapping");
  if (typeof rawMapping === "string" && rawMapping) {
    try {
      const parsed = JSON.parse(rawMapping) as Partial<Mapping>;
      mapping = { ...EMPTY_MAPPING };
      for (const f of FIELDS) {
        const v = parsed[f];
        mapping[f] = Number.isInteger(v) ? (v as number) : -1;
      }
    } catch {
      return NextResponse.json({ error: "The column mapping was malformed." }, { status: 400 });
    }
  }
  const rawHeader = form.get("headerRow");
  if (typeof rawHeader === "string" && rawHeader !== "") {
    const n = Number(rawHeader);
    headerRow = Number.isInteger(n) && n >= 0 ? n : null;
  }

  const missing = REQUIRED_FIELDS.filter((f) => mapping[f] < 0);
  if (missing.length) {
    return NextResponse.json(
      { error: `Map a column for ${missing.map((f) => FIELD_LABELS[f]).join(", ")} first.` },
      { status: 400 }
    );
  }

  const result = buildAllocation(grid, mapping, headerRow);
  if (!result.students.length) {
    return NextResponse.json(
      { error: "No student rows were found with that mapping. Check the columns and try again." },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const incomingIds = result.students.map((s) => s.id);
    const { rows: doomed } = await client.query<{ students: number; scores: number }>(
      `select (select count(*)::int from students where id <> all($1::text[])) as students,
              (select count(*)::int from scores   where student_id <> all($1::text[])) as scores`,
      [incomingIds]
    );
    const studentsAtRisk = doomed[0]?.students ?? 0;
    const scoresAtRisk = doomed[0]?.scores ?? 0;

    // Any removal is destructive — students cascade to their ballots — so the caller
    // has to have seen the count and said yes.
    if (studentsAtRisk > 0 && form.get("confirmDeletions") !== "true") {
      await client.query("rollback");
      return NextResponse.json({
        error:
          `This import removes ${studentsAtRisk} student(s) who are not in the file` +
          (scoresAtRisk
            ? `, deleting the ${scoresAtRisk} ballot(s) already recorded against them`
            : "") +
          `. Re-submit with confirmation to proceed.`,
        studentsAtRisk,
        scoresAtRisk,
        needsConfirmation: true,
      }, { status: 409 });
    }

    for (const [i, room] of result.rooms.entries()) {
      // Venue and panel are not in the allocation sheet, so never overwrite them.
      await client.query(
        `insert into rooms (id, code, label, venue, day, sort)
         values ($1,$2,$3,'',coalesce($4,''),$5)
         on conflict (id) do update
           set code = excluded.code,
               label = excluded.label,
               day = coalesce(nullif(excluded.day, ''), rooms.day),
               sort = excluded.sort`,
        [room.id, room.code, room.label, room.day, i]
      );
    }

    for (const g of result.groups) {
      await client.query(
        `insert into groups (number, room_id) values ($1,$2)
         on conflict (number) do update set room_id = excluded.room_id`,
        [g.number, g.roomId]
      );
    }

    for (const s of result.students) {
      await client.query(
        `insert into students (id, group_number, name, index_no, student_id, supervisor, sort)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (id) do update
           set group_number = excluded.group_number, name = excluded.name,
               index_no = excluded.index_no, student_id = excluded.student_id,
               supervisor = coalesce(excluded.supervisor, students.supervisor),
               sort = excluded.sort`,
        [s.id, s.groupNumber, s.name, s.indexNo, s.studentId, s.supervisor, s.sort]
      );
    }

    const { rowCount: removedStudents } = await client.query(
      `delete from students where id <> all($1::text[])`, [incomingIds]
    );
    const { rowCount: removedGroups } = await client.query(
      `delete from groups where number <> all($1::int[])`,
      [result.groups.map((g) => g.number)]
    );

    await client.query("commit");

    return NextResponse.json({
      ok: true,
      rooms: result.rooms.length,
      groups: result.groups.length,
      students: result.students.length,
      removedStudents: removedStudents ?? 0,
      removedGroups: removedGroups ?? 0,
      deletedScores: scoresAtRisk,
      warnings: result.warnings,
    });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "The import failed and nothing was changed." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
