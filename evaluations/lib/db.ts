import { Pool } from "@/node_modules/@types/pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://defense:defense@localhost:5433/defense";

// Next reloads modules in dev; keep one pool across reloads.
const globalForPg = globalThis as unknown as { defensePool?: Pool };

export const pool =
  globalForPg.defensePool ?? new Pool({ connectionString, max: 10 });

if (process.env.NODE_ENV !== "production") globalForPg.defensePool = pool;

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
