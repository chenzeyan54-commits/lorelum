import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

import type { SqliteConnection } from "./connection";

export interface SqliteReadSession<Schema extends Record<string, unknown>> {
  readonly orm: BunSQLiteDatabase<Schema>;
}

export interface SqliteWriteSession<
  Schema extends Record<string, unknown>,
> extends SqliteReadSession<Schema> {
  transaction<T>(run: () => T): T;
}

export function createReadSession<Schema extends Record<string, unknown>>(
  connection: SqliteConnection<Schema>,
): SqliteReadSession<Schema> {
  return Object.freeze({ orm: connection.orm });
}

export function createWriteSession<Schema extends Record<string, unknown>>(
  connection: SqliteConnection<Schema>,
): SqliteWriteSession<Schema> {
  return Object.freeze({
    orm: connection.orm,
    transaction<T>(run: () => T): T {
      return connection.orm.transaction(run);
    },
  });
}
