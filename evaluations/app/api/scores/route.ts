import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { CRITERIA } from "@/lib/rubric";

export const dynamic = "force-dynamic";

const COLUMNS = new Set<string>(CRITERIA.map((c) => c.key));

export async function POST(req: Request) {
  let body: { studentId?: string; examinerId?: string; patch?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { studentId, examinerId, patch } = body;
  if (!studentId || !examinerId || !patch || typeof patch !== "object") {
    return NextResponse.json(
      { error: "studentId, examinerId and patch are all required" },
      { status: 400 }
    );
  }

  // Column names come only from the rubric whitelist, never from the request.
  const cols: string[] = [];
  const values: unknown[] = [];
  for (const [key, raw] of Object.entries(patch)) {
    if (COLUMNS.has(key)) {
      if (raw !== null && !(Number.isInteger(raw) && (raw as number) >= 0 && (raw as number) <= 10)) {
        return NextResponse.json(
          { error: `${key} must be a whole number from 0 to 10, or null` },
          { status: 400 }
        );
      }
      cols.push(key); values.push(raw);
    } else if (key === "notes") {
      if (typeof raw !== "string") {
        return NextResponse.json({ error: "notes must be text" }, { status: 400 });
      }
      cols.push("notes"); values.push(raw.slice(0, 2000));
    }
  }
  if (!cols.length) {
    return NextResponse.json({ error: "Nothing in the patch to save" }, { status: 400 });
  }

  // An examiner may only score students sitting in their own room.
  const [ok] = await query<{ ok: boolean }>(`
    select true as ok
      from students s
      join groups g    on g.number = s.group_number
      join examiners e on e.room_id = g.room_id
     where s.id = $1 and e.id = $2
  `, [studentId, examinerId]);
  if (!ok) {
    return NextResponse.json(
      { error: "That examiner is not on the panel for this student's room" },
      { status: 403 }
    );
  }

  const placeholders = cols.map((_, i) => `$${i + 3}`);
  const updates = cols.map((c) => `${c} = excluded.${c}`);
  const [row] = await query(`
    insert into scores (student_id, examiner_id, ${cols.join(", ")}, updated_at)
    values ($1, $2, ${placeholders.join(", ")}, now())
    on conflict (student_id, examiner_id) do update
       set ${updates.join(", ")}, updated_at = now()
    returning student_id as "studentId", examiner_id as "examinerId",
              appearance, usability, technical, innovation, presentation,
              notes, updated_at as "updatedAt"
  `, [studentId, examinerId, ...values]);

  return NextResponse.json({ score: row });
}
