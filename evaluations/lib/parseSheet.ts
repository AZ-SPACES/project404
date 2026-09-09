import ExcelJS from "exceljs";

export type Grid = string[][];

/** RFC 4180-ish: honours quoted fields, doubled quotes, and newlines inside quotes. */
export function parseCsv(text: string): Grid {
  const rows: Grid = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  // A BOM survives Excel's "Save as CSV" and would corrupt the first header cell.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  return rows.map((r) => r.map((c) => c.trim()));
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    // Excel formulas, hyperlinks and rich text all carry their display text differently.
    if (typeof v.text === "string") return v.text.trim();
    if (typeof v.result === "string" || typeof v.result === "number") return String(v.result).trim();
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((p) => p.text ?? "").join("").trim();
    }
    if (v.hyperlink && typeof v.hyperlink === "string") return String(v.hyperlink).trim();
  }
  return String(value).trim();
}

export type ParsedFile = { grid: Grid; sheetNames: string[]; sheet: string | null };

export async function parseSheet(
  buffer: Buffer,
  filename: string,
  sheetName?: string
): Promise<ParsedFile> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return { grid: parseCsv(buffer.toString("utf8")), sheetNames: [], sheet: null };
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    const wb = new ExcelJS.Workbook();
    // exceljs types want an ArrayBuffer here; a Buffer works at runtime.
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheetNames = wb.worksheets.map((w) => w.name);
    const ws = (sheetName && wb.getWorksheet(sheetName)) || wb.worksheets[0];
    if (!ws) throw new Error("That workbook has no sheets in it.");

    const grid: Grid = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const values = row.values as unknown[]; // exceljs pads index 0
      const cells: string[] = [];
      for (let i = 1; i < values.length; i++) cells.push(cellText(values[i]));
      grid.push(cells);
    });
    return { grid, sheetNames, sheet: ws.name };
  }

  throw new Error("Upload a .csv or .xlsx file — that format isn't supported.");
}
