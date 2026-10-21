import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Seen within this many seconds counts as on the site now. ~2 missed pings. */
const WINDOW_S = 45;

// The table is in schema.sql, but the live database only gets that file when a
// script runs it. Creating it here, once per process, means a deploy alone is
// enough for the counter to work.
let ready: Promise<unknown> | null = null;
const ensureTable = () =>
  (ready ??= query(`
    create table if not exists presence (
      session_id text primary key,
      last_seen  timestamptz not null default now()
    )
  `).catch((e) => { ready = null; throw e; }));

async function online() {
  const [{ n }] = await query<{ n: number }>(
    `select count(*)::int as n from presence where last_seen > now() - make_interval(secs => $1)`,
    [WINDOW_S]
  );
  return n;
}

export async function GET() {
  await ensureTable();
  return NextResponse.json({ online: await online() });
}

/** A heartbeat: { id } marks that browser as here, and the reply is the count. */
export async function POST(req: Request) {
  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (typeof id !== "string" || !/^[\w-]{8,64}$/.test(id)) {
    return NextResponse.json({ error: "id must be 8–64 letters, digits, - or _" }, { status: 400 });
  }

  await ensureTable();
  await query(
    `insert into presence (session_id) values ($1)
     on conflict (session_id) do update set last_seen = now()`,
    [id]
  );
  // Long-gone browsers are swept as we go so the table stays small.
  await query(`delete from presence where last_seen < now() - interval '1 hour'`);
  return NextResponse.json({ online: await online() });
}
