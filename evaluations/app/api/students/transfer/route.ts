import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Move a student to another supervisor.
 *
 * Three things follow the student, in one transaction so a failure part-way
 * never leaves them split between two supervisors:
 *   - students.supervisor_id, which decides whose board they appear on;
 *   - students.supervisor, the name printed in the results CSV;
 *   - any supervisor_scores row already filed. The mark is kept — it is still
 *     the student's mark — but its supervisor_id moves so the new supervisor
 *     can revise it (the score route refuses writes from anyone else).
 */
export async function POST(req: Request) {
  let body: { studentId?: unknown; toSupervisorId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const { studentId, toSupervisorId } = body;
  if (typeof studentId !== "string" || typeof toSupervisorId !== "string") {
    return NextResponse.json(
      { error: "studentId and toSupervisorId are both required" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const { rows: [to] } = await client.query<{ name: string }>(
      `select name from supervisors where id = $1`, [toSupervisorId]
    );
    if (!to) {
      await client.query("rollback");
      return NextResponse.json({ error: "Unknown supervisor" }, { status: 404 });
    }

    const { rows: [student] } = await client.query<{ fromSupervisorId: string | null }>(
      `select supervisor_id as "fromSupervisorId" from students where id = $1 for update`,
      [studentId]
    );
    if (!student) {
      await client.query("rollback");
      return NextResponse.json({ error: "Unknown student" }, { status: 404 });
    }
    if (student.fromSupervisorId === toSupervisorId) {
      await client.query("rollback");
      return NextResponse.json(
        { error: `Already supervised by ${to.name}` },
        { status: 409 }
      );
    }

    await client.query(
      `update students set supervisor_id = $2, supervisor = $3 where id = $1`,
      [studentId, toSupervisorId, to.name]
    );
    await client.query(
      `update supervisor_scores set supervisor_id = $2, updated_at = now() where student_id = $1`,
      [studentId, toSupervisorId]
    );

    await client.query("commit");
    return NextResponse.json({
      studentId,
      fromSupervisorId: student.fromSupervisorId,
      toSupervisorId,
      toSupervisorName: to.name,
    });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
