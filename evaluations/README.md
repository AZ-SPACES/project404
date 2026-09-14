# CS Defense Scoring

Marking for the KNUST Department of Computer Science project defense, 2026. Five
rooms scored in parallel on the day; each examiner filed their own ballot per
student and the panel mean is what counts. Since then the mark has been split:
the panel is **40%** and each student's own supervisor contributes the other
**60%** separately.

## How the mark is made up

| Half | Share | Filed by | Where |
|------|-------|----------|-------|
| Defense panel | 40% | the two examiners in the student's room | `/rooms/<room>` |
| Supervisor | 60% | the student's own supervisor, as a single mark | `/supervisors/<supervisor>` |

Neither half is a zero when it is missing. A student with only one of them shows a
running total marked *so far*, and `Complete` in the CSV says whether the mark can
be published.

### The panel's 40%

Scored 0–10 per criterion and weighted to 100, which is then taken as 40% of the
final mark. Weights come from `DEFENSE ALLOCATION FOR COMPUTER SCIENCE 2026.docx`:

| Criterion            | Weight of the panel score |
|----------------------|---------------------------|
| Appearance           | 10%                       |
| Design & Usability   | 20%                       |
| Technical Execution  | 20%                       |
| Innovation           | 30%                       |
| Presentation         | 20%                       |

The rubric is deliberately **not** rescaled to 40 — this is the scale printed on
the sheet the panels scored from, and every ballot already recorded is on it. The
conversion happens once, in `finalMark()` in `lib/rubric.ts`.

A criterion left untouched is `NULL`, which is deliberately different from a
scored `0`. The panel mean is taken **per criterion across the examiners who
scored it, then weighted** — so a half-finished ballot still contributes.

### The supervisor's 60%

One mark per student, 0–60 to one decimal place, with an optional note. A student
has exactly one supervisor, so `supervisor_scores` is keyed on the student alone;
`supervisor_id` records who filed it and stops a second supervisor overwriting it.

Supervisors open `/supervisors`, pick their name, and get only their own students
— ordered by project group, so groupmates stay adjacent. Marks save as you type.

#### Marking offline

A supervisor who would rather work in Excel opens **Mark offline in Excel** on
their own page and downloads their students as `.xlsx` or `.csv`, fills the mark
column, and uploads the same file back.

- The `Ref` column is the student's primary key and is what the upload matches on.
  Index numbers are not unique — two students share `3390922` — so a sheet whose
  `Ref` column has been deleted falls back to index and reports anything it cannot
  place. Sorting and filtering the sheet are fine; matching does not use row order.
- **A blank mark leaves that student unchanged**, so a sheet can come back in
  batches. Clearing a mark that is already saved is done in the app, so that an
  accidentally emptied column cannot wipe a morning's work.
- The upload is **always previewed first**: every mark that would change, and from
  what to what, before anything is written. Committing applies them in one
  transaction.
- A sheet is only ever read against the supervisor it is uploaded for, so one
  supervisor's file cannot write to another's students.
- In the `.xlsx`, every column except `Mark` and `Notes` is locked and the mark
  cells reject anything outside 0–60 as it is typed. Guidance lives on a separate
  **Read me** sheet — never as a trailing row on `Marks`, which the upload would
  read back as a row matching no student.

18 students are supervised but never sat the defense. They appear on their
supervisor's list with no group, no room and no panel half.

## Running it

```bash
npm install
npm run db:up      # postgres 16 on localhost:5433
npm run db:seed    # rooms, examiners, 213 groups, 501 students
npm run dev        # http://localhost:3000
```

`npm run db:reset` drops the volume and starts clean.

### Setting up from scratch

```bash
npm run db:seed          # roster from data/allocation.json
npm run db:supervisors   # supervisors, and who supervises whom
npm run db:fix-ids       # the three identifier corrections (already in the seed)
```

`db:seed` is a **fresh-install** command. `data/allocation.json` is a snapshot of a
real database, so re-seeding an existing one reverts anything that changed after
the snapshot was taken. Keep the snapshot current instead:

```bash
DATABASE_URL=<production> npm run db:dump   # rewrites data/allocation.json
```

Run that after any round of corrections and commit the result. It was needed once
already: the file had drifted 11 names and 31 group assignments behind production.

The supervisor half is imported separately, and is additive — it never touches
`scores`, names, groups or rooms, so it is safe against a live database:

```bash
npm run db:supervisors -- --dry-run   # report what it would do, write nothing
npm run db:supervisors
```

It reads `data/supervisors.json`, generated from the department's CS4 project
allocation by `node db/supervisors-from-docx.mjs`. Re-running any of these is safe.

### The three identifier corrections

`npm run db:fix-ids` (add `-- --dry-run` to preview) repairs three identifiers the
department's own records disagreed on. Each correction names the value it expects
to find and only writes when it finds it, so a row already correct is reported and
left alone and a row holding something unexpected is skipped rather than guessed
at — safe to run twice, and safe on a partly-corrected database.

| Student | Was | Now | Why |
|---------|-----|-----|-----|
| Nhyira Akua Godson | ID `20948238` | `20901740` | `20948238` is Kelvin Ankomah's |
| Martin Obiri Danso | ID `20953083` | `20889448` | `20953083` is Mahfuz Agbor Seidu's |
| Essandoh Prince Takyi | index `3390922` | `3390822` | `3390922` is Nuhu Kofi Essuman's |

Nothing here touches `students.id`. It is the key `scores` and `supervisor_scores`
point at, and Postgres does not cascade an update, so re-keying a student would
detach every mark recorded against them. The id keeps whatever index number it was
minted from; it is opaque and nothing reads meaning out of it.

With these applied, every index number in the roster is unique, and the supervisor
import matches 302 students on ID *and* index rather than 281, with no rows left
needing a judgement call.

#### How students are matched to a supervisor

Three passes, strongest evidence first, and an allocation row can only be claimed
once. This matters because the two sources disagree in three places:

- Two students are recorded under index number **3390922** (Essandoh and Essuman).
  The university student ID is what tells them apart.
- Two students carry a student ID that belongs to a classmate (Godson and Danso).
  Their index numbers are right, so pass 1 gives each ID to whoever's index agrees
  with it and pass 3 places the other by index. The script prints both as `CHECK`
  — they are typos in the roster and worth sending back to the department.

The dry run reconciles exactly: 504 students linked, 18 supervisor-only additions,
522 allocation rows, nothing ambiguous and nothing unmatched.

## On defense day

It is deployed at **https://defense.aza.systems**. Examiners open that on any
device and pick their room, then their own name. Postgres is the single source of
truth, so a browser can be closed or refreshed without loss, and each room's board
polls every 8 seconds so co-examiners see each other's ballots land without
reloading.

Running it on the venue LAN instead is still supported and needs no deployment:
one machine runs `npm run build && npm start`, the rest open
`http://<that-machine-ip>:3000`.

### ⚠️ There is no authentication

This was a deliberate choice, made with the trade-off understood — not an
oversight, and not something to "fix" without deciding to. **Anyone who knows the
hostname can file or overwrite a ballot for any of the 501 students, and can
replace the entire roster through `/import`.** Nothing identifies an examiner
beyond the name they pick from a dropdown, so the app cannot tell a panel member
from a passer-by, and an altered score leaves no attributable trace.

What follows from that, while it is public:

- Treat the hostname as the only barrier. Don't post it anywhere public.
- Export results as soon as scoring ends — `/results` → Download CSV. The CSV is
  the record; the database is a live document anyone can still edit.
- Take it down when the defense is over: delete `nginx/conf.d/defense-api.conf`,
  `docker compose exec nginx nginx -s reload`. That closes the exposure without
  touching the data. The Vercel deployment then loads and stays empty, which is
  harmless — but delete the project too if you want it properly gone.
- If it needs to stay up longer, put a gate in front of it — a shared passcode in
  `proxy.ts`, `auth_basic` on the vhost, or an IP allowlist for the venue. Note
  that the gate belongs on the **API** host: gating only the Vercel UI leaves
  `defense-api.aza.systems` answering to anyone who curls it.

## Importing a new allocation

`/import` **updates** by default: it adds and corrects the students in the file
and leaves everyone it does not mention exactly as they are, with their ballots
and supervisor mark intact. Making the roster match the file exactly is a separate
**Replace** choice, and it names the students, ballots and supervisor marks it
would delete and requires a confirmation before doing so.

Students with no group are never removed by either mode. They belong to no room,
so they appear in no allocation sheet — deleting them because a room allocation
does not mention them would take their supervisor's mark with them.


`/import` replaces the roster from a `.csv` or `.xlsx` without touching examiners,
venues, or ballots already recorded for students who stay in the list.

It reads two shapes:

- **The department's own table** — no header row; `GROUP n` rows separating the
  students beneath them. Columns are matched by position (name, index, student ID,
  room, day).
- **A normal spreadsheet** — a header row plus a Group column. Headers are matched
  by name, and anything mismatched can be remapped from the dropdowns.

A room whose group numbers step evenly (6, 11, 16 …) implies the group before the
first label, which is how the source leaves group 1 unwritten; those students are
placed in the inferred group and the import warns you which number it chose.
Crossing into a new room always ends the previous group, so an unlabelled block
can never be absorbed into the room above it.

Nothing is written until you press Import, and the preview shows added / removed /
skipped counts first. Any removal needs an explicit tick, and the commit runs in a
single transaction — if it fails, nothing changes.

## Exporting results

- `/results` → **Download CSV**, or `GET /api/results?format=csv` — every room.
- A room's board → **Export room CSV**, or `?format=csv&room=rm-3` — one room.

- A supervisor's list → **Export CSV**, or `?format=csv&supervisor=dr-kate-takyi`.

Each student gets one row per examiner, then a summary row carrying the panel
mean, the panel's 40, the supervisor's 60, the final mark and whether it is
`Complete`. A student who never sat the defense has no examiner rows and their
summary row reads `NO PANEL SCORE`. The file is UTF-8 with a BOM and CRLF line
endings so Excel opens the names correctly on Windows.

## Data

`data/allocation.json` is the initial seed, generated from the defense allocation:

- `DEFENSE ALLOCATION FOR COMPUTER SCIENCE 2026.docx` — rooms, groups, students

`data/allocation.json` is regenerated from a database by `db/allocation-from-db.mjs`
rather than hand-edited, and carries the roster plus the 18 supervisees who never
sat the defense.

`data/supervisors.json` carries the supervisor half and is generated separately,
by `db/supervisors-from-docx.mjs`, from:

- `data/CS4-PROJECT_ALLOCATION-2025-2026.docx` — 522 students, 13 supervisors

The CS4 document is the only complete record of who supervises whom: the defense
allocation names a supervisor for 285 of 501 students and gets one of them wrong.
Three of its 13 supervisors sat on no panel at all — Dr. Gaddafi Abdul-Salaam,
Dr. Kwabena Owusu-Agyemang and Dr. Linda Amoako Banning.

Rooms take groups round-robin: RM 1 gets groups 1, 6, 11…, RM 2 gets 2, 7, 12…,
and so on. Group 1's label is absent from the source table and is reconstructed
from that pattern.

Known quirks carried over from the source, not silently fixed:

- 216 of 504 students have no university student ID, only an index number.
- Three identifiers were wrong and are now corrected — see **The three identifier
  corrections** above. Before that fix, index `3390922` belonged to two different
  students and the supervisor import had to fall back on judgement for two more.

Room venues and panels come from the department's room note: RM 1 FF12, RM 2 FF23,
RM 3 Simulation Lab, RM 4 FF12, RM 5 F5. They are not in the allocation sheet, so
an import never overwrites them.

On the day **Dr. Kornyo sat on the Room 4 panel in place of Dr. Gaddafi**. The
ballots are his; only the name on them was wrong. `db/import-supervisors.mjs`
renames that examiner row rather than replacing it, because `scores` points at its
id and a new row would detach every ballot already recorded against it.

## Deployment

The app is split across two places, because its data cannot leave the droplet.

| | Where | Serves |
|---|---|---|
| UI | Vercel, `defense.aza.systems` | the pages |
| API + data | the droplet, `defense-api.aza.systems` | `/api/*` and `defense-db` |

`defense-db` publishes no port and lives only on `aza-network`, so Vercel cannot
reach Postgres and no amount of configuration will change that. What Vercel calls
instead is the same `evaluations` container as before, now reached on its own
hostname. One image serves both roles: `lib/api.ts` reads
`NEXT_PUBLIC_DEFENSE_API_URL`, which Vercel sets and the droplet build leaves
empty, so on the droplet every call stays a same-origin relative path.

Deploying the droplet half is a push: merge to `main` on `AZ-SPACES/project404`,
CI runs (`evaluations-ci` builds this app), and on success
`.github/workflows/deploy.yml` SSHes to the droplet, pulls, rebuilds and
health-gates the stack. Vercel deploys its half from the same push.

Moving parts, all in the repo root:

| Where | What |
|---|---|
| `evaluations/Dockerfile` | three-stage build; the runtime image is Next's `standalone` output plus `db/` and `data/` |
| `evaluations/proxy.ts` | CORS for the Vercel origin, including the preflight the ballot POST needs |
| `docker-compose.yml` | the `evaluations` and `defense-db` services |
| `docker-compose.backend.yml` | leaves both **enabled** — only the UI moved to Vercel, the data did not |
| `nginx/conf.d/defense-api.conf` | the `defense-api.aza.systems` vhost |

Neither a DNS record nor a certificate was needed for the API host: `*.aza.systems`
already points at the droplet, and the wildcard certificate issued by
`scripts/init-miniapps-ssl.sh` covers one label deep. Only `defense` itself needed
an explicit Cloudflare `CNAME` to Vercel, to override that wildcard.

### Vercel project settings

| Setting | Value |
|---|---|
| Root Directory | `evaluations` |
| Node.js Version | 22.x (matches CI) |
| `NEXT_PUBLIC_DEFENSE_API_URL` | `https://defense-api.aza.systems` |

`output: "standalone"` in `next.config.ts` is for the Dockerfile; Vercel ignores it.

> Preview deploys read and write the **production** database, and their origins are
> not in the CORS allowlist, so their data calls fail. Add the preview URL to
> `DEFENSE_ALLOWED_ORIGINS` on the droplet if you need one to work.

### The roster on the server

`schema.sql` is mounted into the database's `initdb.d`, so tables exist from the
first boot. The deploy then seeds `data/allocation.json` **only if the database
holds no students**. That is the important detail: seeding unconditionally would
mean any deploy during the defense silently reverted a roster uploaded through
`/import`. To reseed deliberately:

```bash
docker compose exec evaluations node db/seed.mjs   # idempotent; never touches scores
```

### Setting the database password

`DEFENSE_DB_PASSWORD` in the droplet's root `.env` overrides the default. Postgres
reads it on the volume's **first** start only — setting it later without also
dropping `defense_pgdata` leaves the old password in place and the app then fails
to authenticate.

## Layout

```
app/
  page.tsx                 the 40/60 split, then the room picker
  rooms/[room]/            panel scoring board (server page + client RoomBoard)
  supervisors/             supervisor picker with per-supervisor progress
  supervisors/[supervisor]/ the 60% board (server page + client SupervisorBoard)
  results/                 standings, both halves and the final mark
  import/                  upload wizard (preview, column mapping, commit)
  api/rooms/               room list and one room's full state
  api/scores/              ballot upsert (validates range and room membership)
  api/supervisors/         supervisor list, and one supervisor's students
  api/supervisors/[id]/sheet  the offline marking sheet, ?format=csv|xlsx
  api/supervisors/[id]/marks  upload a filled sheet — previews, then commits
  api/supervisor-scores/   mark upsert (validates 0-60 and supervisor ownership)
  api/results/             aggregated results, ?format=csv to export
  api/import/              preview and commit endpoints
lib/api.ts                 where the API lives: relative on the droplet, absolute on Vercel
lib/rubric.ts              criteria, weights, the 40/60 split and the scoring maths
lib/markSheet.ts           builds the offline marking sheet and reads it back
lib/supervisorStudents.ts  one supervisor's students, with both halves of the mark
lib/parseSheet.ts          csv reader and xlsx reader
lib/importAllocation.ts    column detection, group resolution, warnings
lib/db.ts                  pg pool
db/schema.sql              loaded automatically on first container start
db/seed.mjs                idempotent roster seed — fresh installs only, see above
db/allocation-from-db.mjs  rewrites data/allocation.json from a live database
db/supervisors-from-docx.mjs  regenerates data/supervisors.json from the CS4 .docx
db/import-supervisors.mjs  additive supervisor import, safe against production
db/fix-roster-ids.mjs      the three identifier corrections, idempotent
proxy.ts                   CORS for the Vercel origin
```
