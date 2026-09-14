// Regenerates data/supervisors.json from the department's CS4 project allocation.
//
// That document is the only complete record of who supervises whom: the defense
// allocation the app was first seeded from names a supervisor for barely half the
// roster, and gets one of them wrong. Run this only when the department reissues
// the allocation; the import script reads the JSON, not the .docx.
//
//   node db/supervisors-from-docx.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const data = path.join(here, "..", "data");
const DOCX = path.join(data, "CS4-PROJECT_ALLOCATION-2025-2026.docx");

// The department writes each name a little differently — "DR KORNYO OLIVER" but
// "DR. KATE TAKYI". Spelling them out once here is safer than a title-case rule,
// and it is the label supervisors will look for when they pick their own name.
const DISPLAY = new Map([
  ["PROFESSOR NAJIM USSIPH",       "Prof. Najim Ussiph"],
  ["PROFESSOR FRIMPONG TWUM",      "Prof. Frimpong Twum"],
  ["PROFESSOR YAW MARFO MISSAH",   "Prof. Yaw Marfo Missah"],
  ["DR KORNYO OLIVER",             "Dr. Kornyo Oliver"],
  ["DR. GADDAFI ABDUL-SALAAM",     "Dr. Gaddafi Abdul-Salaam"],
  ["DR. K. O. PEASAH",             "Dr. K. O. Peasah"],
  ["DR EMMANUEL AHENE",            "Dr. Emmanuel Ahene"],
  ["DR. ROSE-MARY OWUSUAA MENSAH", "Dr. Rose-Mary Owusuaa Mensah"],
  ["DR. ERIC OPOKU OSEI",          "Dr. Eric Opoku Osei"],
  ["DR. KATE TAKYI",               "Dr. Kate Takyi"],
  ["DR. KWABENA OWUSU-AGYEMANG",   "Dr. Kwabena Owusu-Agyemang"],
  ["DR. LINDA AMOAKO BANNING",     "Dr. Linda Amoako Banning"],
  ["DR. BENJAMIN TEI-PARTEY",      "Dr. Benjamin Tei-Partey"],
]);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ---- read the one table in the document ---------------------------------- */

const tmp = await run("mktemp", ["-d"]).then((r) => r.stdout.trim());
await run("unzip", ["-o", "-q", DOCX, "word/document.xml", "-d", tmp]);
const xml = await readFile(path.join(tmp, "word", "document.xml"), "utf8");

const decode = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const table = xml.split("<w:tbl>")[1].split("</w:tbl>")[0];
const grid = table
  .split(/<w:tr[ >]/).slice(1)
  .map((tr) =>
    tr.split("</w:tr>")[0]
      .split(/<w:tc[ >]/).slice(1)
      .map((tc) => {
        // <w:tcW> starts with "<w:t" too, so cell properties have to go first.
        const body = tc.split("</w:tc>")[0].replace(/<w:tcPr>[\s\S]*?<\/w:tcPr>/g, "");
        const runs = [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);
        return decode(runs.join("")).replace(/\s+/g, " ").trim();
      })
  );

// SN. | STUDENTID | INDEX NO. | SURNAME | OTHERNAME | SUPERVISOR
const rows = grid.filter((r) => r.length === 6 && /^\d+$/.test(r[0]));
if (rows.length < 400) throw new Error(`Only ${rows.length} student rows — the table layout changed.`);

/* ---- shape it ------------------------------------------------------------ */

const seen = new Map();
const assignments = rows.map((r) => {
  const raw = r[5];
  const name = DISPLAY.get(raw);
  if (!name) throw new Error(`Supervisor "${raw}" is not in the DISPLAY map — add it.`);
  seen.set(name, (seen.get(name) ?? 0) + 1);
  return {
    supervisor: name,
    supervisorId: slug(name),
    studentId: r[1] || null,     // 20-prefixed university ID; the reliable key
    indexNo: r[2],
    name: `${r[3]} ${r[4]}`.replace(/\s+/g, " ").trim(),
  };
});

const supervisors = [...seen.keys()].sort().map((name, i) => ({
  id: slug(name), name, sort: i, students: seen.get(name),
}));

await writeFile(
  path.join(data, "supervisors.json"),
  JSON.stringify({
    source: path.basename(DOCX),
    generated: new Date().toISOString().slice(0, 10),
    supervisors,
    assignments,
  }, null, 2) + "\n"
);

console.log(`${assignments.length} assignments across ${supervisors.length} supervisors`);
for (const s of supervisors) console.log(`  ${String(s.students).padStart(3)}  ${s.name}`);
