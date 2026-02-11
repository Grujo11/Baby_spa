import { Pool } from "pg";

const globalForPool = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForPool.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPool.pool = pool;
}

export function query<T = unknown>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params);
}
