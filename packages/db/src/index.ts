export * as schema from "./schema.js";
export {
  matches,
  players,
  goals,
  type Match,
  type Player,
  type Goal,
} from "./schema.js";
export {
  createDb,
  getDatabaseUrl,
  DATABASE_URL_ENV,
  type Database,
} from "./client.js";
