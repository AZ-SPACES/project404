import { NextResponse } from "next/server";
import { loadSupervisor } from "@/lib/supervisorStudents";
import { loadMiniStudents } from "@/lib/miniStudents";
import { MINI_PROJECT_SHEET, buildMiniSheetRows, toCsv, toXlsx } from "@/lib/markSheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The blank mini project sheet: a supervisor's own third years, to fill in offline. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ supervisor: string }> }
) {
  const { supervisor } = await params;
  const meta = await loadSupervisor(supervisor);
  if (!meta) return NextResponse.json({ error: "Unknown supervisor" }, { status: 404 });

  const rows = buildMiniSheetRows(await loadMiniStudents(supervisor));
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `mini-project-marks-${supervisor}-${stamp}`;
  const format = new URL(req.url).searchParams.get("format");

  if (format === "xlsx") {
    const body = await toXlsx(rows, `${meta.name} — mini project`, MINI_PROJECT_SHEET);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }

  return new NextResponse(toCsv(rows, MINI_PROJECT_SHEET), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${base}.csv"`,
    },
  });
}
