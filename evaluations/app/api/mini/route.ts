import { NextResponse } from "next/server";
import { loadMiniSupervisors } from "@/lib/miniStudents";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ supervisors: await loadMiniSupervisors() });
}
