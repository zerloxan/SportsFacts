import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client.js";

/** Apply pending Drizzle migrations from ./drizzle, then exit. */
async function main(): Promise<void> {
  const { sql, db } = createDb();
  await migrate(db, { migrationsFolder: "./drizzle" });
  await sql.end();
  console.log("[db] migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
