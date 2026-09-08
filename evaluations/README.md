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

One machine runs `npm run dev` (or `npm run build && npm start`) and the other
laptops open it over the venue LAN at `http://<that-machine-ip>:3000`. Postgres is
the single source of truth, so a browser can be closed or refreshed without loss.
Each room's board polls every 8 seconds, so co-examiners see each other's ballots
land without reloading.

Examiners pick their room, then their own name. There is no password: anyone who
can reach the URL can file a ballot. That is fine on a closed venue network, and
is the reason not to expose this to the public internet.

## Data

`data/allocation.json` is generated from two Word documents:

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
RM 3 Simulation Lab, RM 4 FF12, RM 5 F5.

## Layout

```
app/
  page.tsx                 room picker with per-room progress
  rooms/[room]/            scoring board (server page + client RoomBoard)
  results/                 standings across all rooms
  api/rooms/               room list and one room's full state
  api/scores/              ballot upsert (validates range and room membership)
  api/results/             aggregated results, ?format=csv to export
lib/rubric.ts              criteria, weights, and the scoring maths
lib/db.ts                  pg pool
db/schema.sql              loaded automatically on first container start
db/seed.mjs                idempotent roster seed
```
