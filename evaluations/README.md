# CS Defense Scoring

Panel scoring for the KNUST Department of Computer Science project defense, 2026.
Five rooms score in parallel; each examiner files their own ballot per student and
the panel mean is what counts.

## Rubric

Scored 0–10 per criterion, weighted to a 100-point total. Weights come from
`DEFENSE ALLOCATION FOR COMPUTER SCIENCE 2026.docx`:

| Criterion            | Weight |
|----------------------|--------|
| Appearance           | 10%    |
| Design & Usability   | 20%    |
| Technical Execution  | 20%    |
| Innovation           | 30%    |
| Presentation         | 20%    |

A criterion left untouched is `NULL`, which is deliberately different from a
scored `0`. The panel mean is taken **per criterion across the examiners who
scored it, then weighted** — so a half-finished ballot still contributes.

## Running it

```bash
npm install
npm run db:up      # postgres 16 on localhost:5433
npm run db:seed    # rooms, examiners, 213 groups, 501 students
npm run dev        # http://localhost:3000
```

`npm run db:reset` drops the volume and starts clean. Re-running `db:seed` updates
the roster and never touches recorded scores.

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

Each student gets one row per examiner plus a `PANEL MEAN` row carrying the
weighted total. The file is UTF-8 with a BOM and CRLF line endings so Excel opens
the names correctly on Windows.

## Data

`data/allocation.json` is the initial seed, generated from two Word documents:

- `DEFENSE ALLOCATION FOR COMPUTER SCIENCE 2026.docx` — rooms, groups, students
- `CS4-PROJECT_ALLOCATION-2025-2026.docx` — supervisors, joined on student ID

Rooms take groups round-robin: RM 1 gets groups 1, 6, 11…, RM 2 gets 2, 7, 12…,
and so on. Group 1's label is absent from the source table and is reconstructed
from that pattern.

Known quirks carried over from the source, not silently fixed:

- 216 of 501 students have no university student ID, only an index number.
- Index `3390922` is shared by two different students (ESSANDOH PRINCE TAKYI in
  group 28 and Nuhu Kofi Essuman in group 73). They are kept as separate records.
- Only 285 of 501 students matched a supervisor in the CS4 document.

Room venues and panels come from the department's room note: RM 1 FF12, RM 2 FF23,
RM 3 Simulation Lab, RM 4 FF12, RM 5 F5. They are not in the allocation sheet, so
an import never overwrites them.

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
  page.tsx                 room picker with per-room progress
  rooms/[room]/            scoring board (server page + client RoomBoard)
  results/                 standings across all rooms
  import/                  upload wizard (preview, column mapping, commit)
  api/rooms/               room list and one room's full state
  api/scores/              ballot upsert (validates range and room membership)
  api/results/             aggregated results, ?format=csv to export
  api/import/              preview and commit endpoints
lib/api.ts                 where the API lives: relative on the droplet, absolute on Vercel
lib/rubric.ts              criteria, weights, and the scoring maths
lib/parseSheet.ts          csv reader and xlsx reader
lib/importAllocation.ts    column detection, group resolution, warnings
lib/db.ts                  pg pool
db/schema.sql              loaded automatically on first container start
db/seed.mjs                idempotent roster seed
proxy.ts                   CORS for the Vercel origin
```
