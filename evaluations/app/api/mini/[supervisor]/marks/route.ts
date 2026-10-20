import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { parseSheet } from "@/lib/parseSheet";
import { loadSupervisor } from "@/lib/supervisorStudents";
import { loadMiniStudents } from "@/lib/miniStudents";
import { MINI_MAX } from "@/lib/miniProject";
import { readMarkSheet } from "@/lib/markSheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Upload a filled-in mini project sheet. Same contract as the final-year one:
 * without `commit` it only reports what would change; with it, everything is
 * applied in one transaction.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ supervisor: string }> }
) {
  const { supervisor } = await params;
  const meta = await loadSupervisor(supervisor);
  if (!meta) return NextResponse.json({ error: "Unknown supervisor" }, { status: 404 });

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
    return NextResponse.json(
      { error: `That file is ${(file.size / 1e6).toFixed(1)} MB. The limit is 8 MB.` },
      { status: 413 }
    );
  }

  let grid;
  try {
    ({ grid } = await parseSheet(
      Buffer.from(await file.arrayBuffer()), file.name,
      (form.get("sheet") as string) || undefined
    ));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "That file could not be read." },
      { status: 400 }
    );
  }

  const students = await loadMiniStudents(supervisor);
  const reading = readMarkSheet(grid, students, MINI_MAX);
  const commit = form.get("commit") === "1";

  if (!commit) {
    return NextResponse.json({ supervisor: meta, filename: file.name, ...reading });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const c of reading.changes) {
      await client.query(`
        insert into mini_scores (student_id, supervisor_id, mark, notes, updated_at)
        values ($1, $2, $3, $4, now())
        on conflict (student_id) do update
           set mark = excluded.mark, notes = excluded.notes,
               supervisor_id = excluded.supervisor_id, updated_at = now()
      `, [c.studentId, supervisor, c.to, c.notesTo]);
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Those marks could not be saved." },
      { status: 500 }
    );
  } finally {
    client.release();
  }

  return NextResponse.json({ supervisor: meta, applied: reading.changes.length, ...reading });
}
