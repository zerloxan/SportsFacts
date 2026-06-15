/**
 * Placeholder for the SportsFacts database layer.
 *
 * The `statsbomb-ingestion` change will add the Drizzle schema (teams,
 * players, matches, events, facts) and migrations here. For now this exports
 * the intended connection-string env var name so other packages can reference
 * a single constant.
 */
export const DATABASE_URL_ENV = "DATABASE_URL" as const;
