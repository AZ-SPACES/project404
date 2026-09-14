import { NextResponse } from "next/server";
import { loadSupervisor, loadSupervisees } from "@/lib/supervisorStudents";
import { buildSheetRows, toCsv, toXlsx } from "@/lib/markSheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The blank marking sheet: a supervisor's own students, ready to fill in offline. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ supervisor: string }> }
) {
  const { supervisor } = await params;
  const meta = await loadSupervisor(supervisor);
  if (!meta) return NextResponse.json({ error: "Unknown supervisor" }, { status: 404 });

  const students = await loadSupervisees(supervisor);
  const rows = buildSheetRows(students);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `marks-${supervisor}-${stamp}`;
  const format = new URL(req.url).searchParams.get("format");

  if (format === "xlsx") {
    const body = await toXlsx(rows, meta.name);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${base}.csv"`,
    },
  });
}
