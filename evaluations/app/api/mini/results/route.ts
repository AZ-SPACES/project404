import { NextResponse } from "next/server";
import { MINI_MAX } from "@/lib/miniProject";
import { loadMiniStudents } from "@/lib/miniStudents";

export const dynamic = "force-dynamic";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * Every third year, or one supervisor's with ?supervisor=. JSON by default, CSV
 * with ?format=csv — the same contract as /api/results for the final years.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const supervisorId = params.get("supervisor");
  const rows = await loadMiniStudents(supervisorId);

  if (params.get("format") !== "csv") {
    return NextResponse.json({ students: rows });
  }

  const lines = [
    ["Supervisor", "Index No", "Student", `Mark (of ${MINI_MAX})`, "Notes"].map(csvCell).join(","),
    ...rows.map((r) =>
      [r.supervisor, r.indexNo, r.name, r.mark === null ? "" : r.mark.toFixed(1), r.notes]
        .map(csvCell).join(",")
    ),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  const scope = supervisorId ? `-${supervisorId}` : "";
  // A BOM keeps Excel on Windows from mangling the UTF-8 names.
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="cs-mini-project-marks${scope}-${stamp}.csv"`,
    },
  });
}
