import ExcelJS from "exceljs";
import { SUPERVISOR_SHARE, aggregate, finalMark, type Ballot } from "./rubric";

/**
 * The offline marking sheet: a supervisor downloads their own students, fills the
 * mark column in Excel, and uploads the same file back.
 *
 * `Ref` is the student's primary key and is what the upload matches on. It is in
 * the sheet because index numbers are not unique — two students share 3390922 —
 * and because a supervisor may sort or filter their copy before sending it back.
 * Index number is kept as a fallback for a sheet whose Ref column got mangled.
 */
export const REF = "Ref";
export const INDEX = "Index No";
export const MARK = `Mark (0-${SUPERVISOR_SHARE})`;
export const NOTES = "Notes";

export const SHEET_COLUMNS = [
  REF, INDEX, "Student", "Group", "Room", "Panel (40)", MARK, NOTES,
] as const;

export type SheetStudent = {
  id: string; name: string; indexNo: string;
  groupNumber: number | null; roomCode: string | null;
  ballots: Ballot[]; mark: number | null; notes: string;
};

export type SheetRow = (string | number)[];

export function buildSheetRows(students: SheetStudent[]): SheetRow[] {
  return students.map((s) => {
    const { panelPoints } = finalMark(aggregate(s.ballots).total, s.mark);
    return [
      s.id,
      s.indexNo,
      s.name,
      s.groupNumber ?? "",
      s.roomCode ?? "did not defend",
      panelPoints === null ? "" : Number(panelPoints.toFixed(2)),
      s.mark ?? "",
      s.notes ?? "",
    ];
  });
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function toCsv(rows: SheetRow[]): string {
  const lines = [SHEET_COLUMNS.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  // A BOM keeps Excel on Windows from mangling the UTF-8 names.
  return "﻿" + lines.join("\r\n");
}

export async function toXlsx(rows: SheetRow[], supervisorName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CS Defense Scoring";
  const ws = wb.addWorksheet("Marks");

  ws.columns = [
    { header: REF,          key: "ref",    width: 16 },
    { header: INDEX,        key: "index",  width: 12 },
    { header: "Student",    key: "name",   width: 34 },
    { header: "Group",      key: "group",  width: 8  },
    { header: "Room",       key: "room",   width: 15 },
    { header: "Panel (40)", key: "panel",  width: 11 },
    { header: MARK,         key: "mark",   width: 13 },
    { header: NOTES,        key: "notes",  width: 46 },
  ];
  rows.forEach((r) => ws.addRow(r));

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: `H${rows.length + 1}` };

  // Everything except the two columns the supervisor fills in is locked, so a
  // stray paste cannot quietly shift a name away from its Ref. Excel only honours
  // this once the sheet is protected, and protection without a password is a
  // guard rail rather than a lock — which is what is wanted here.
  ws.getColumn("mark").eachCell((c) => { c.protection = { locked: false }; });
  ws.getColumn("notes").eachCell((c) => { c.protection = { locked: false }; });
  ws.getColumn("mark").numFmt = "0.0";
  ws.getColumn("panel").numFmt = "0.00";

  // Reject anything outside 0-60 at the point of typing, with the reason.
  for (let i = 2; i <= rows.length + 1; i++) {
    ws.getCell(`G${i}`).dataValidation = {
      type: "decimal", operator: "between", formulae: [0, SUPERVISOR_SHARE],
      allowBlank: true, showErrorMessage: true,
      errorTitle: "Out of range",
      error: `The mark must be between 0 and ${SUPERVISOR_SHARE}.`,
    };
  }
  await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true, autoFilter: true });

  // Guidance goes on its own sheet, never as a trailing row on Marks: the upload
  // reads the first worksheet top to bottom, and a note sitting under the data
  // would come back as a row that matches no student.
  const help = wb.addWorksheet("Read me");
  help.getColumn(1).width = 96;
  [
    `Marking sheet for ${supervisorName}`,
    "",
    `Fill in the "${MARK}" column on the Marks sheet, then upload this file back.`,
    `Marks run from 0 to ${SUPERVISOR_SHARE}, to at most one decimal place (for example 48 or 48.5).`,
    "Leave a mark blank to leave that student unchanged — you can send the sheet back in batches.",
    `Do not edit or delete the "${REF}" column. It is what matches each row to the right student.`,
    "Sorting and filtering are fine; the upload matches on Ref, not on row order.",
    "Clearing a mark that is already saved is done in the app, not by emptying a cell here.",
  ].forEach((line, i) => {
    const row = help.addRow([line]);
    if (i === 0) row.getCell(1).font = { bold: true, size: 12 };
  });

  return Buffer.from(await wb.xlsx.writeBuffer()) as Buffer;
}

/* -------------------------------------------------------------------------- */

export type MarkChange = {
  studentId: string; name: string; indexNo: string;
  from: number | null; to: number | null;
  notesFrom: string; notesTo: string;
  matchedBy: "ref" | "index";
};
export type MarkProblem = { row: number; label: string; reason: string };
export type SheetReading = {
  changes: MarkChange[];
  unchanged: number;
  blank: number;
  problems: MarkProblem[];
};

/** 0 to 60, at most one decimal — the same rule the API and the UI apply. */
function parseMark(raw: string): { mark: number } | { error: string } {
  const t = raw.trim().replace(/,/g, ".");
  if (!/^\d{1,2}(\.\d+)?$/.test(t)) return { error: `"${raw.trim()}" is not a number` };
  const n = Number(t);
  if (n > SUPERVISOR_SHARE) return { error: `${n} is above ${SUPERVISOR_SHARE}` };
  const rounded = Math.round(n * 10) / 10;
  if (rounded !== n) return { error: `${n} has more than one decimal place` };
  return { mark: rounded };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Read an uploaded sheet against the supervisor's own students.
 *
 * Only the supervisor's students are ever passed in, so a row naming somebody
 * else's supervisee cannot match and is reported rather than written. A blank
 * mark means "leave this one alone" — clearing a mark is done in the app, so
 * that an accidentally emptied column cannot wipe a morning's work.
 */
export function readMarkSheet(grid: string[][], students: SheetStudent[]): SheetReading {
  const changes: MarkChange[] = [];
  const problems: MarkProblem[] = [];
  let unchanged = 0, blank = 0;

  const header = grid.findIndex((r) =>
    r.some((c) => norm(c) === norm(REF)) || r.some((c) => norm(c).startsWith("mark ("))
  );
  if (header < 0) {
    return { changes, unchanged, blank, problems: [{ row: 0, label: "",
      reason: `No header row found. Upload the sheet downloaded from this page, with its "${REF}" and "${MARK}" columns.` }] };
  }

  const head = grid[header].map(norm);
  const col = (name: string) => head.indexOf(norm(name));
  const iRef = col(REF), iIndex = col(INDEX), iNotes = col(NOTES);
  let iMark = head.findIndex((c) => c.startsWith("mark ("));
  if (iMark < 0) iMark = col(MARK);

  if (iMark < 0) {
    return { changes, unchanged, blank, problems: [{ row: header + 1, label: "",
      reason: `That sheet has no "${MARK}" column.` }] };
  }
  if (iRef < 0 && iIndex < 0) {
    return { changes, unchanged, blank, problems: [{ row: header + 1, label: "",
      reason: `That sheet has neither a "${REF}" nor an "${INDEX}" column, so its rows cannot be matched to students.` }] };
  }

  const byRef = new Map(students.map((s) => [s.id, s]));
  const byIndex = new Map<string, SheetStudent[]>();
  for (const s of students) {
    const list = byIndex.get(s.indexNo);
    if (list) list.push(s); else byIndex.set(s.indexNo, [s]);
  }

  const seen = new Set<string>();
  const at = (row: string[], i: number) => (i >= 0 && i < row.length ? row[i].trim() : "");

  for (let r = header + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row.some((c) => c.trim())) continue;

    const ref = at(row, iRef);
    const indexNo = at(row, iIndex);
    const label = indexNo || ref || `row ${r + 1}`;

    let student = ref ? byRef.get(ref) : undefined;
    let matchedBy: "ref" | "index" = "ref";
    if (!student && indexNo) {
      const candidates = byIndex.get(indexNo) ?? [];
      if (candidates.length === 1) { student = candidates[0]; matchedBy = "index"; }
      else if (candidates.length > 1) {
        problems.push({ row: r + 1, label,
          reason: `Index ${indexNo} belongs to more than one of your students. Keep the ${REF} column so the rows can be told apart.` });
        continue;
      }
    }
    if (!student) {
      problems.push({ row: r + 1, label, reason: "Not one of your students." });
      continue;
    }
    if (seen.has(student.id)) {
      problems.push({ row: r + 1, label, reason: "This student appears more than once in the sheet." });
      continue;
    }
    seen.add(student.id);

    const rawMark = at(row, iMark);
    const notesTo = iNotes >= 0 ? at(row, iNotes).slice(0, 2000) : student.notes;

    if (!rawMark) {
      // A blank mark still lets a note through, but changes nothing on its own.
      if (notesTo !== student.notes) {
        changes.push({ studentId: student.id, name: student.name, indexNo: student.indexNo,
          from: student.mark, to: student.mark, notesFrom: student.notes, notesTo, matchedBy });
      } else blank++;
      continue;
    }

    const read = parseMark(rawMark);
    if ("error" in read) {
      problems.push({ row: r + 1, label, reason: read.error });
      continue;
    }
    if (read.mark === student.mark && notesTo === student.notes) { unchanged++; continue; }

    changes.push({ studentId: student.id, name: student.name, indexNo: student.indexNo,
      from: student.mark, to: read.mark, notesFrom: student.notes, notesTo, matchedBy });
  }

  return { changes, unchanged, blank, problems };
}
