import { NextResponse } from "next/server";
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
  return NextResponse.json({ supervisor, students });
}
