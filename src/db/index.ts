import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __tradeLensPool?: Pool;
  __tradeLensDb?: NodePgDatabase;
};

/**
 * 惰性建连。
 *
 * 之前这里在模块顶层就对缺失的 DATABASE_URL 抛错，导致 `next build` 在
 * 收集页面数据阶段直接失败——构建机上本来就不该需要一个活的数据库。
 * 现在只有真正要查库时才会解析连接串。
 */
export function getDb(): NodePgDatabase {
  if (globalForDb.__tradeLensDb) return globalForDb.__tradeLensDb;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the postgres store");
  }

  const pool = (globalForDb.__tradeLensPool ??= new Pool({ connectionString: databaseUrl }));
  const db = drizzle(pool);

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__tradeLensDb = db;
  }
  return db;
}

export function getPool(): Pool | undefined {
  return globalForDb.__tradeLensPool;
}
