import ExcelJS from "exceljs";
import { SUPERVISOR_SHARE, aggregate, finalMark, type Ballot } from "./rubric";
import { MINI_MAX, type MiniStudent } from "./miniProject";

/**
 * The offline marking sheet: a supervisor downloads their own students, fills the
 * mark column in Excel, and uploads the same file back.
 *
 * `Ref` is the student's primary key and is what the upload matches on. It is in
 * the sheet because index numbers are not unique — two students share 3390922 —
 * and because a supervisor may sort or filter their copy before sending it back.
 * Index number is kept as a fallback for a sheet whose Ref column got mangled.
 *
 * Two sheets share this code: the final-year one, where the supervisor's mark is
 * out of 60 beside the panel's 40, and the third-year mini project one, where it
 * is out of 100 and is the whole grade. Only the columns and the ceiling differ.
 */
export const REF = "Ref";
export const INDEX = "Index No";
export const MARK = `Mark (0-${SUPERVISOR_SHARE})`;
export const NOTES = "Notes";

/** What the upload needs to know about a student, whichever sheet it is. */
export type MarkableStudent = {
  id: string; name: string; indexNo: string; mark: number | null; notes: string;
};

export type SheetStudent = MarkableStudent & {
  groupNumber: number | null; roomCode: string | null; ballots: Ballot[];
};

type Column = { header: string; key: string; width: number; numFmt?: string };

/** Which columns a sheet has and how high its mark goes. */
export type SheetLayout = { columns: Column[]; max: number };

export const FINAL_YEAR_SHEET: SheetLayout = {
  max: SUPERVISOR_SHARE,
  columns: [
    { header: REF,          key: "ref",    width: 16 },
    { header: INDEX,        key: "index",  width: 12 },
    { header: "Student",    key: "name",   width: 34 },
    { header: "Group",      key: "group",  width: 8  },
    { header: "Room",       key: "room",   width: 15 },
    { header: "Panel (40)", key: "panel",  width: 11, numFmt: "0.00" },
    { header: MARK,         key: "mark",   width: 13, numFmt: "0.0" },
    { header: NOTES,        key: "notes",  width: 46 },
  ],
};

export const MINI_MARK = `Mark (0-${MINI_MAX})`;

export const MINI_PROJECT_SHEET: SheetLayout = {
  max: MINI_MAX,
  columns: [
    { header: REF,       key: "ref",   width: 16 },
    { header: INDEX,     key: "index", width: 12 },
    { header: "Student", key: "name",  width: 38 },
    { header: MINI_MARK, key: "mark",  width: 14, numFmt: "0.0" },
    { header: NOTES,     key: "notes", width: 46 },
  ],
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

export function buildMiniSheetRows(students: MiniStudent[]): SheetRow[] {
  return students.map((s) => [s.id, s.indexNo, s.name, s.mark ?? "", s.notes ?? ""]);
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function toCsv(rows: SheetRow[], layout: SheetLayout = FINAL_YEAR_SHEET): string {
  const lines = [layout.columns.map((c) => c.header).map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  // A BOM keeps Excel on Windows from mangling the UTF-8 names.
  return "﻿" + lines.join("\r\n");
}

export async function toXlsx(
  rows: SheetRow[], supervisorName: string, layout: SheetLayout = FINAL_YEAR_SHEET
): Promise<Buffer> {
  const { columns, max } = layout;
  const markHeader = columns.find((c) => c.key === "mark")!.header;
  const letter = (key: string) =>
    String.fromCharCode(65 + columns.findIndex((c) => c.key === key));

  const wb = new ExcelJS.Workbook();
  wb.creator = "CS Defense Scoring";
  const ws = wb.addWorksheet("Marks");

  ws.columns = columns.map(({ header, key, width }) => ({ header, key, width }));
  rows.forEach((r) => ws.addRow(r));

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: `${letter(columns[columns.length - 1].key)}${rows.length + 1}` };

  // Everything except the two columns the supervisor fills in is locked, so a
  // stray paste cannot quietly shift a name away from its Ref. Excel only honours
  // this once the sheet is protected, and protection without a password is a
  // guard rail rather than a lock — which is what is wanted here.
  ws.getColumn("mark").eachCell((c) => { c.protection = { locked: false }; });
  ws.getColumn("notes").eachCell((c) => { c.protection = { locked: false }; });
  for (const c of columns) if (c.numFmt) ws.getColumn(c.key).numFmt = c.numFmt;

  // Reject anything outside the range at the point of typing, with the reason.
  for (let i = 2; i <= rows.length + 1; i++) {
    ws.getCell(`${letter("mark")}${i}`).dataValidation = {
      type: "decimal", operator: "between", formulae: [0, max],
      allowBlank: true, showErrorMessage: true,
      errorTitle: "Out of range",
      error: `The mark must be between 0 and ${max}.`,
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
    `Fill in the "${markHeader}" column on the Marks sheet, then upload this file back.`,
    `Marks run from 0 to ${max}, to at most one decimal place (for example 48 or 48.5).`,
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

/** 0 to `max`, at most one decimal — the same rule the API and the UI apply. */
function parseMark(raw: string, max: number): { mark: number } | { error: string } {
  const t = raw.trim().replace(/,/g, ".");
  if (!/^\d{1,3}(\.\d+)?$/.test(t)) return { error: `"${raw.trim()}" is not a number` };
  const n = Number(t);
  if (n > max) return { error: `${n} is above ${max}` };
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
export function readMarkSheet(
  grid: string[][], students: MarkableStudent[], max: number = SUPERVISOR_SHARE
): SheetReading {
  const changes: MarkChange[] = [];
  const problems: MarkProblem[] = [];
  let unchanged = 0, blank = 0;

  const header = grid.findIndex((r) =>
    r.some((c) => norm(c) === norm(REF)) || r.some((c) => norm(c).startsWith("mark ("))
  );
  if (header < 0) {
    return { changes, unchanged, blank, problems: [{ row: 0, label: "",
      reason: `No header row found. Upload the sheet downloaded from this page, with its "${REF}" and "Mark (0-${max})" columns.` }] };
  }

  const head = grid[header].map(norm);
  const col = (name: string) => head.indexOf(norm(name));
  const iRef = col(REF), iIndex = col(INDEX), iNotes = col(NOTES);
  let iMark = head.findIndex((c) => c.startsWith("mark ("));
  if (iMark < 0) iMark = col(MARK);

  if (iMark < 0) {
    return { changes, unchanged, blank, problems: [{ row: header + 1, label: "",
      reason: `That sheet has no "Mark (0-${max})" column.` }] };
  }
  // A final-year sheet (0-60) and a mini project sheet (0-100) look alike, and the
  // two students on both lists would match by index number on either page. The
  // header says which one it is, so the wrong one is refused outright.
  const range = head[iMark].match(/^mark \(0-(\d+)\)$/);
  if (range && Number(range[1]) !== max) {
    return { changes, unchanged, blank, problems: [{ row: header + 1, label: "",
      reason: `That sheet is for marks out of ${range[1]}, but this page takes marks out of ${max}. ` +
        (max === SUPERVISOR_SHARE
          ? "It looks like a mini project sheet — upload it on the “Mini project (3rd year)” page."
          : "It looks like a final-year sheet — upload it on the “Final year project” page.") }] };
  }
  if (iRef < 0 && iIndex < 0) {
    return { changes, unchanged, blank, problems: [{ row: header + 1, label: "",
      reason: `That sheet has neither a "${REF}" nor an "${INDEX}" column, so its rows cannot be matched to students.` }] };
  }

  const byRef = new Map(students.map((s) => [s.id, s]));
  const byIndex = new Map<string, MarkableStudent[]>();
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

    const read = parseMark(rawMark, max);
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
