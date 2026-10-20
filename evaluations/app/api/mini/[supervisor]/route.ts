import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { loadSupervisor } from "@/lib/supervisorStudents";
import { loadMiniStudents } from "@/lib/miniStudents";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ supervisor: string }> }
) {
  const { supervisor: id } = await params;

  const supervisor = await loadSupervisor(id);
  if (!supervisor) return NextResponse.json({ error: "Unknown supervisor" }, { status: 404 });

  const students = await loadMiniStudents(id);
  // So the page can point a supervisor back at their final years.
  const [{ n: finalYearCount }] = await query<{ n: number }>(
    `select count(*)::int as n from students where supervisor_id = $1`, [id]
  );
  return NextResponse.json({ supervisor, students, finalYearCount });
}
