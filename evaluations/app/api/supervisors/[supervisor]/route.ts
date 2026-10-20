import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { loadSupervisor, loadSupervisees } from "@/lib/supervisorStudents";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ supervisor: string }> }
) {
  const { supervisor: id } = await params;

  const supervisor = await loadSupervisor(id);
  if (!supervisor) return NextResponse.json({ error: "Unknown supervisor" }, { status: 404 });

  const students = await loadSupervisees(id);
  // So the page can point a supervisor at their third years too.
  const [{ n: miniCount }] = await query<{ n: number }>(
    `select count(*)::int as n from mini_students where supervisor_id = $1`, [id]
  );
  return NextResponse.json({ supervisor, students, miniCount });
}
