import { NextResponse } from "next/server";
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
  return NextResponse.json({ supervisor, students });
}
