import type { Grid } from "./parseSheet";

export const FIELDS = [
  "name", "index", "studentId", "group", "room", "day", "supervisor",
] as const;
export type FieldKey = (typeof FIELDS)[number];

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Student name",
  index: "Index no.",
  studentId: "Student ID",
  group: "Group",
  room: "Room",
  day: "Day",
  supervisor: "Supervisor",
};

export const REQUIRED_FIELDS: FieldKey[] = ["name", "index", "room"];

/** Column index per field. -1 means "not in this file". */
export type Mapping = Record<FieldKey, number>;

export const EMPTY_MAPPING: Mapping = {
  name: -1, index: -1, studentId: -1, group: -1, room: -1, day: -1, supervisor: -1,
};

const HINTS: [FieldKey, RegExp][] = [
  // Most specific first — "student id" must beat "student".
  ["studentId",  /^(student\s*id|studentid|university\s*id|reg(istration)?\s*(no|number)?)$/i],
  ["index",      /^(index(\s*(no|number))?|indexno)$/i],
  ["supervisor", /^(supervisor|examiner|lecturer)$/i],
  ["group",      /^(group(\s*(no|number))?|grp)$/i],
  ["room",       /^(room(\s*(no|number))?|rm|venue)$/i],
  ["day",        /^(day|date)$/i],
  ["name",       /^(student(\s*name)?|name|full\s*name|surname|othername)$/i],
];

const GROUP_ROW = /^\s*group\s*[-–]?\s*(\d+)\s*$/i;

export function detectMapping(grid: Grid): { headerRow: number | null; mapping: Mapping } {
  const limit = Math.min(grid.length, 12);
  let best: { row: number; hits: number; mapping: Mapping } | null = null;

  for (let r = 0; r < limit; r++) {
    const mapping: Mapping = { ...EMPTY_MAPPING };
    let hits = 0;
    grid[r].forEach((cell, c) => {
      const text = cell.trim();
      if (!text) return;
      for (const [field, re] of HINTS) {
        if (re.test(text) && mapping[field] === -1) { mapping[field] = c; hits++; return; }
      }
    });
    if (hits >= 2 && (!best || hits > best.hits)) best = { row: r, hits, mapping };
  }

  if (best) return { headerRow: best.row, mapping: best.mapping };

  // No header row — fall back to the department's own column order, which is what
  // the defense allocation table uses: name, index, student id, room, day.
  const widest = grid.reduce((n, r) => Math.max(n, r.length), 0);
  const mapping: Mapping = { ...EMPTY_MAPPING, name: 0, index: 1 };
  if (widest > 2) mapping.studentId = 2;
  if (widest > 3) mapping.room = 3;
  if (widest > 4) mapping.day = 4;
  return { headerRow: null, mapping };
}

export type ImportRoom = { id: string; code: string; label: string; day: string | null };
export type ImportStudent = {
  id: string; groupNumber: number; name: string; indexNo: string;
  studentId: string | null; supervisor: string | null; sort: number;
};
export type ImportResult = {
  rooms: ImportRoom[];
  groups: { number: number; roomId: string }[];
  students: ImportStudent[];
  warnings: string[];
  skipped: number;
};

function normaliseRoom(raw: string): ImportRoom | null {
  const text = raw.trim();
  if (!text) return null;
  const digits = text.match(/(\d+)/);
  if (digits) {
    const n = Number(digits[1]);
    return { id: `rm-${n}`, code: `RM ${n}`, label: `Room ${n}`, day: null };
  }
  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!id) return null;
  return { id, code: text.toUpperCase(), label: text, day: null };
}

export function buildAllocation(
  grid: Grid,
  mapping: Mapping,
  headerRow: number | null
): ImportResult {
  const at = (row: string[], field: FieldKey) => {
    const c = mapping[field];
    return c >= 0 && c < row.length ? row[c].trim() : "";
  };

  const rooms = new Map<string, ImportRoom>();
  const groups = new Map<number, string>();
  const students: ImportStudent[] = [];
  const warnings: string[] = [];
  const idCounts = new Map<string, number>();
  const perGroupSort = new Map<number, number>();

  type Orphan = { name: string; indexNo: string; studentId: string | null; supervisor: string | null };
  const orphans = new Map<string, Orphan[]>();

  let currentRoom: ImportRoom | null = null;
  let currentGroup: number | null = null;
  let skipped = 0;
  let noRoom = 0;

  const start = headerRow === null ? 0 : headerRow + 1;

  for (let r = start; r < grid.length; r++) {
    const row = grid[r];
    if (!row.some((c) => c.trim())) continue;

    // Room carries down: the source leaves it blank on separator rows.
    const roomCell = at(row, "room");
    if (roomCell) {
      const room = normaliseRoom(roomCell);
      if (room) {
        const existing = rooms.get(room.id);
        const resolved = existing ?? room;
        if (!existing) rooms.set(room.id, room);
        // Crossing into a new room ends the previous group. Without this, students
        // under an unlabelled first group would silently join the last group of the
        // room above and drag that group's room with them.
        if (currentRoom && currentRoom.id !== resolved.id) currentGroup = null;
        currentRoom = resolved;
      }
    }
    const dayCell = at(row, "day");
    if (dayCell && currentRoom && !currentRoom.day) currentRoom.day = dayCell;

    // An explicit group column wins; otherwise a "GROUP 6" row acts as a separator.
    const groupCell = at(row, "group");
    const nameCell = at(row, "name");
    const separator = GROUP_ROW.exec(nameCell);

    if (groupCell) {
      const m = groupCell.match(/(\d+)/);
      if (m) currentGroup = Number(m[1]);
    } else if (separator) {
      currentGroup = Number(separator[1]);
      if (currentRoom) groups.set(currentGroup, currentRoom.id);
      continue; // the separator row is a label, not a student
    }

    const indexNo = at(row, "index");
    if (!nameCell || !indexNo) { skipped++; continue; }

    if (!currentRoom) { noRoom++; skipped++; continue; }

    // Rows that arrive before the room's first GROUP label — the department's own
    // table omits the label for the very first group. Hold them and infer it below.
    if (currentGroup === null) {
      const list = orphans.get(currentRoom.id) ?? [];
      list.push({ name: nameCell, indexNo, studentId: at(row, "studentId") || null,
                  supervisor: at(row, "supervisor") || null });
      orphans.set(currentRoom.id, list);
      continue;
    }

    groups.set(currentGroup, currentRoom.id);

    let id = `g${currentGroup}-${indexNo}`;
    const seen = (idCounts.get(id) ?? 0) + 1;
    idCounts.set(id, seen);
    if (seen > 1) id = `${id}-${seen}`;

    const sort = perGroupSort.get(currentGroup) ?? 0;
    perGroupSort.set(currentGroup, sort + 1);

    students.push({
      id,
      groupNumber: currentGroup,
      name: nameCell,
      indexNo,
      studentId: at(row, "studentId") || null,
      supervisor: at(row, "supervisor") || null,
      sort,
    });
  }

  // A room whose labelled groups step evenly (6, 11, 16 ...) implies the one before
  // the first label, which is how the department's table leaves group 1 unwritten.
  for (const [roomId, held] of orphans) {
    const labelled = [...groups.entries()]
      .filter(([, r]) => r === roomId).map(([n]) => n).sort((a, b) => a - b);

    let inferred: number | null = null;
    if (labelled.length >= 2) {
      const step = labelled[1] - labelled[0];
      const even = labelled.every((n, i) => i === 0 || n - labelled[i - 1] === step);
      const candidate = labelled[0] - step;
      if (even && step > 0 && candidate > 0 && !groups.has(candidate)) inferred = candidate;
    }

    const roomCode = rooms.get(roomId)?.code ?? roomId;

    if (inferred === null) {
      skipped += held.length;
      warnings.push(
        `${held.length} row(s) in ${roomCode} came before any group was named and ` +
        `could not be placed. Add a Group column, or a "GROUP n" row above them.`
      );
      continue;
    }

    groups.set(inferred, roomId);
    held.forEach((o, k) => {
      let id = `g${inferred}-${o.indexNo}`;
      const seen = (idCounts.get(id) ?? 0) + 1;
      idCounts.set(id, seen);
      if (seen > 1) id = `${id}-${seen}`;
      students.push({ id, groupNumber: inferred, name: o.name, indexNo: o.indexNo,
                      studentId: o.studentId, supervisor: o.supervisor, sort: k });
    });
    warnings.push(
      `${held.length} row(s) at the top of ${roomCode} had no GROUP label. ` +
      `They were placed in Group ${inferred}, inferred from that room's numbering ` +
      `(${labelled.slice(0, 3).join(", ")} …). Check that is right.`
    );
  }

  if (noRoom) warnings.push(`${noRoom} row(s) had no room and were skipped.`);
  const noNames = skipped - noRoom - [...orphans.values()].reduce((n, h) => n + h.length, 0);
  if (noNames > 0) warnings.push(`${noNames} row(s) had no name or index number and were skipped.`);

  const missingIds = students.filter((s) => !s.studentId).length;
  if (missingIds) warnings.push(`${missingIds} student(s) have no student ID — index numbers will be used on their own.`);

  const byIndex = new Map<string, number>();
  for (const s of students) byIndex.set(s.indexNo, (byIndex.get(s.indexNo) ?? 0) + 1);
  const dupes = [...byIndex.entries()].filter(([, n]) => n > 1).map(([i]) => i);
  if (dupes.length) {
    warnings.push(
      `Index number(s) ${dupes.slice(0, 5).join(", ")}${dupes.length > 5 ? "…" : ""} ` +
      `appear more than once. Each row is kept as its own student.`
    );
  }

  // Inferred groups are resolved after the main pass, so put everything back in
  // reading order before it is previewed or written.
  students.sort((a, b) => a.groupNumber - b.groupNumber || a.sort - b.sort);

  return {
    rooms: [...rooms.values()],
    groups: [...groups.entries()].map(([number, roomId]) => ({ number, roomId })),
    students,
    warnings,
    skipped,
  };
}
