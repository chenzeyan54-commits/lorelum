import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import type { SqliteDatabaseDefinition } from "../definitions";

import type { SqliteConnection } from "./connection";

/** Apply only the checked-in Drizzle migrations absent from this SQLite file. */
export function migrateSqlite<Schema extends Record<string, unknown>>(
  connection: SqliteConnection<Schema>,
  definition: SqliteDatabaseDefinition<Schema>,
): void {
  migrate(connection.orm, { migrationsFolder: definition.migrationsFolder });
}
