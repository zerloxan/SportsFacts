import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export const DATABASE_URL_ENV = "DATABASE_URL" as const;

export function getDatabaseUrl(): string {
  const url = process.env[DATABASE_URL_ENV];
  if (!url) {
    throw new Error(
      `${DATABASE_URL_ENV} is not set. Copy .env.example to .env and start Postgres (docker compose up -d).`,
    );
  }
  return url;
}

/** Create a postgres-js client + Drizzle db. Caller is responsible for closing `sql`. */
export function createDb(url: string = getDatabaseUrl()) {
  const sql = postgres(url, { max: 5 });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

export type Database = ReturnType<typeof createDb>["db"];
