import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { SUPERVISOR_SHARE } from "@/lib/rubric";

export const dynamic = "force-dynamic";

/** 0 to 60, to at most one decimal place — the column is numeric(4,1). */
function readMark(raw: unknown): number | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  if (raw < 0 || raw > SUPERVISOR_SHARE) return undefined;
  // 48.25 would silently round on the way into the column, so reject it here.
  if (Math.abs(raw * 10 - Math.round(raw * 10)) > 1e-9) return undefined;
  return Math.round(raw * 10) / 10;
}

export async function POST(req: Request) {
  let body: { studentId?: string; supervisorId?: string; patch?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { studentId, supervisorId, patch } = body;
  if (!studentId || !supervisorId || !patch || typeof patch !== "object") {
    return NextResponse.json(
      { error: "studentId, supervisorId and patch are all required" },
      { status: 400 }
    );
  }

  const cols: string[] = [];
  const values: unknown[] = [];

  if ("mark" in patch) {
    const mark = readMark(patch.mark);
    if (mark === undefined) {
      return NextResponse.json(
        { error: `The mark must be a number from 0 to ${SUPERVISOR_SHARE}, to one decimal place, or empty` },
        { status: 400 }
      );
    }
    cols.push("mark"); values.push(mark);
  }
  if ("notes" in patch) {
    if (typeof patch.notes !== "string") {
      return NextResponse.json({ error: "notes must be text" }, { status: 400 });
    }
    cols.push("notes"); values.push(patch.notes.slice(0, 2000));
  }
  if (!cols.length) {
    return NextResponse.json({ error: "Nothing in the patch to save" }, { status: 400 });
  }

  // A supervisor may only mark their own supervisees. This is the only check on
  // the write — the app has no authentication, so it stops a mistake, not an
  // attacker (see proxy.ts).
  const [owns] = await query<{ ok: boolean }>(
    `select true as ok from students where id = $1 and supervisor_id = $2`,
    [studentId, supervisorId]
  );
  if (!owns) {
    return NextResponse.json(
      { error: "That student is not supervised by you" },
      { status: 403 }
    );
  }

  const placeholders = cols.map((_, i) => `$${i + 3}`);
  const updates = cols.map((c) => `${c} = excluded.${c}`);
  const [row] = await query(`
    insert into supervisor_scores (student_id, supervisor_id, ${cols.join(", ")}, updated_at)
    values ($1, $2, ${placeholders.join(", ")}, now())
    on conflict (student_id) do update
       set ${updates.join(", ")}, supervisor_id = excluded.supervisor_id, updated_at = now()
    returning student_id as "studentId", supervisor_id as "supervisorId",
              mark::float8 as mark, notes, updated_at as "updatedAt"
  `, [studentId, supervisorId, ...values]);

  return NextResponse.json({ score: row });
}
