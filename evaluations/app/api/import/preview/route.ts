import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { parseSheet } from "@/lib/parseSheet";
import {
  buildAllocation, detectMapping, EMPTY_MAPPING, FIELDS,
  REQUIRED_FIELDS, FIELD_LABELS, type Mapping,
} from "@/lib/importAllocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

function columnName(i: number) {
  let n = i, label = "";
  do { label = String.fromCharCode(65 + (n % 26)) + label; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return label;
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Upload the file as form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a .csv or .xlsx file to upload." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1e6).toFixed(1)} MB. The limit is 8 MB.` },
      { status: 413 }
    );
  }

  const sheet = (form.get("sheet") as string) || undefined;
  let grid, sheetNames, activeSheet;
  try {
    ({ grid, sheetNames, sheet: activeSheet } = await parseSheet(
      Buffer.from(await file.arrayBuffer()), file.name, sheet
    ));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "That file could not be read." },
      { status: 400 }
    );
  }

  if (!grid.length) {
    return NextResponse.json({ error: "That sheet is empty." }, { status: 400 });
  }

  // The client sends a mapping back once the user has adjusted it.
  const detected = detectMapping(grid);
  let headerRow = detected.headerRow;
  let mapping: Mapping = detected.mapping;

  const rawMapping = form.get("mapping");
  if (typeof rawMapping === "string" && rawMapping) {
    try {
      const parsed = JSON.parse(rawMapping) as Partial<Mapping>;
      mapping = { ...EMPTY_MAPPING };
      for (const f of FIELDS) {
        const v = parsed[f];
        mapping[f] = Number.isInteger(v) ? (v as number) : -1;
      }
    } catch {
      return NextResponse.json({ error: "The column mapping was malformed." }, { status: 400 });
    }
  }
  const rawHeader = form.get("headerRow");
  if (typeof rawHeader === "string" && rawHeader !== "") {
    const n = Number(rawHeader);
    headerRow = Number.isInteger(n) && n >= 0 ? n : null;
  }

  const missing = REQUIRED_FIELDS.filter((f) => mapping[f] < 0);
  const width = grid.reduce((n, r) => Math.max(n, r.length), 0);
  const columns = Array.from({ length: width }, (_, i) => ({
    index: i,
    letter: columnName(i),
    header: headerRow !== null ? (grid[headerRow][i] ?? "") : "",
    sample: grid.slice(headerRow === null ? 0 : headerRow + 1)
      .map((r) => r[i] ?? "").filter(Boolean).slice(0, 3),
  }));

  if (missing.length) {
    return NextResponse.json({
      sheetNames, sheet: activeSheet, headerRow, mapping, columns,
      error: `Map a column for ${missing.map((f) => FIELD_LABELS[f]).join(", ")} to continue.`,
      needsMapping: true,
    });
  }

  const result = buildAllocation(grid, mapping, headerRow);

  const existing = await query<{ id: string }>(`select id from students`);
  const existingIds = new Set(existing.map((r) => r.id));
  const incomingIds = new Set(result.students.map((s) => s.id));
  const added = [...incomingIds].filter((id) => !existingIds.has(id));
  const removed = [...existingIds].filter((id) => !incomingIds.has(id));

  let scoresAtRisk = 0;
  if (removed.length) {
    const [row] = await query<{ n: number }>(
      `select count(*)::int as n from scores where student_id = any($1::text[])`,
      [removed]
    );
    scoresAtRisk = row?.n ?? 0;
  }
  const [totals] = await query<{ scores: number }>(`select count(*)::int as scores from scores`);

  return NextResponse.json({
    sheetNames, sheet: activeSheet, headerRow, mapping, columns,
    summary: {
      rooms: result.rooms.map((r) => ({
        ...r,
        groups: result.groups.filter((g) => g.roomId === r.id).length,
        students: result.students.filter((s) =>
          result.groups.some((g) => g.number === s.groupNumber && g.roomId === r.id)
        ).length,
      })),
      groups: result.groups.length,
      students: result.students.length,
      skipped: result.skipped,
      added: added.length,
      removed: removed.length,
      unchanged: result.students.length - added.length,
      scoresAtRisk,
      scoresTotal: totals?.scores ?? 0,
    },
    warnings: result.warnings,
    sample: result.students.slice(0, 8),
  });
}
