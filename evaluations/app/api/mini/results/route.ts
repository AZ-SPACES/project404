import { NextResponse } from "next/server";
import { MINI_MAX } from "@/lib/miniProject";
import { loadMiniStudents } from "@/lib/miniStudents";

export const dynamic = "force-dynamic";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Every third year, or one supervisor's with ?supervisor=, as CSV. */
export async function GET(req: Request) {
  const supervisorId = new URL(req.url).searchParams.get("supervisor");
  const rows = await loadMiniStudents(supervisorId);

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
