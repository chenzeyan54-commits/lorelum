import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

export interface SqliteConnection<Schema extends Record<string, unknown>> {
  readonly client: Database;
  readonly orm: BunSQLiteDatabase<Schema>;
  close(): void;
}

export interface OpenSqliteConnectionOptions {
  readonly readonly?: boolean;
}

/** The only Engine persistence entrypoint that creates a bun:sqlite handle. */
export function openSqliteConnection<Schema extends Record<string, unknown>>(
  path: string,
  schema: Schema,
  options: OpenSqliteConnectionOptions = {},
): SqliteConnection<Schema> {
  let client: Database | undefined;
  try {
    const opened =
      options.readonly === true ? new Database(path, { readonly: true }) : new Database(path);
    client = opened;
    const orm = drizzle({ client: opened, schema });
    return Object.freeze({
      client: opened,
      orm,
      close() {
        opened.close();
      },
    });
  } catch (error) {
    client?.close();
    throw error;
  }
}
