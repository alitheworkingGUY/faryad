import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { seedDatabase, type Store } from "./seed";

// One connection per Node process, kept on globalThis so dev hot-reloads and
// separately bundled route handlers all share it.
const g = globalThis as unknown as { __faryadDb?: Store };

export function dbFile(): string {
  return path.join(process.cwd(), "data", "faryad.db");
}

export function getStore(): Store {
  if (!g.__faryadDb) {
    fs.mkdirSync(path.dirname(dbFile()), { recursive: true });
    const sqlite = new Database(dbFile());
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.exec(schema.SCHEMA_SQL);
    const store: Store = { sqlite, db: drizzle(sqlite, { schema }) };
    g.__faryadDb = store;
    // First run: load the demo dataset so `npm run dev` works without a manual seed.
    const row = sqlite.prepare("SELECT COUNT(*) AS c FROM areas").get() as { c: number };
    if (row.c === 0) seedDatabase(store);
  }
  return g.__faryadDb;
}

export function db() {
  return getStore().db;
}

export { schema };
