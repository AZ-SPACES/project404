// Regenerates data/mini-project.json from the department's third-year mini project
// allocation. Run this only when the department reissues the document; the import
// script reads the JSON, not the .docx.
//
//   node db/mini-project-from-docx.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const data = path.join(here, "..", "data");
const DOCX = path.join(data, "MINI PROJECT 2028.docx");

// This document abbreviates supervisors differently again from the CS4 allocation
// ("Y MISSAH", "LA BANNING"), so each is mapped onto the name the app already shows.
// Dr. Panford supervises third years only and is new to the app.
const DISPLAY = new Map([
  ["NAJIM USSIPH",         "Prof. Najim Ussiph"],
  ["FRIMPONG TWUM",        "Prof. Frimpong Twum"],
  ["Y MISSAH",             "Prof. Yaw Marfo Missah"],
  ["KORNYO OLIVER",        "Dr. Kornyo Oliver"],
  ["GADDAFI ABDUL-SALAAM", "Dr. Gaddafi Abdul-Salaam"],
  ["KO PEASAH",            "Dr. K. O. Peasah"],
  ["EMMANUEL AHENE",       "Dr. Emmanuel Ahene"],
  ["ROSE-MARY MENSAH",     "Dr. Rose-Mary Owusuaa Mensah"],
  ["ERIC OPOKU OSEI",      "Dr. Eric Opoku Osei"],
  ["KATE TAKYI",           "Dr. Kate Takyi"],
  ["K.OWUSU-AGYEMANG",     "Dr. Kwabena Owusu-Agyemang"],
  ["LA BANNING",           "Dr. Linda Amoako Banning"],
  ["BENJAMIN TEI-PARTEY",  "Dr. Benjamin Tei-Partey"],
  ["KJ PANFORD",           "Dr. K. J. Panford"],
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

// SN. | INDEX NO. | SURNAME, Other names | SUPERVISOR — the first row is the title.
const rows = grid.filter((r) => r.length === 4 && /^\d+$/.test(r[0]));
if (rows.length < 500) throw new Error(`Only ${rows.length} student rows — the table layout changed.`);

/* ---- shape it ------------------------------------------------------------ */

const seen = new Map();
const indexes = new Set();
const students = rows.map((r) => {
  const name = DISPLAY.get(r[3]);
  if (!name) throw new Error(`Supervisor "${r[3]}" is not in the DISPLAY map — add it.`);
  if (!/^\d{7}$/.test(r[1])) throw new Error(`Row ${r[0]}: "${r[1]}" is not an index number.`);
  // The index number becomes the student's key, so it has to be unique here even
  // though it is not across the whole department (see the README).
  if (indexes.has(r[1])) throw new Error(`Index ${r[1]} appears twice.`);
  indexes.add(r[1]);
  seen.set(name, (seen.get(name) ?? 0) + 1);
  return {
    id: `mp-${r[1]}`,
    indexNo: r[1],
    name: r[2],
    supervisor: name,
    supervisorId: slug(name),
  };
});

const supervisors = [...seen.keys()].sort().map((name) => ({
  id: slug(name), name, students: seen.get(name),
}));

await writeFile(
  path.join(data, "mini-project.json"),
  JSON.stringify({
    source: path.basename(DOCX),
    generated: new Date().toISOString().slice(0, 10),
    supervisors,
    students,
  }, null, 2) + "\n"
);

console.log(`${students.length} students across ${supervisors.length} supervisors`);
for (const s of supervisors) console.log(`  ${String(s.students).padStart(3)}  ${s.name}`);
