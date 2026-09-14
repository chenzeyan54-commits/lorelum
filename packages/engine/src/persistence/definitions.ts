import { fileURLToPath } from "node:url";

import * as keywordIndexSchema from "./schemas/keyword-index";
import * as localStoreSchema from "./schemas/local-store";
import * as semanticIndexSchema from "./schemas/semantic-index";

export interface SqliteDatabaseDefinition<Schema extends Record<string, unknown>> {
  readonly id: "local-store" | "keyword-index" | "semantic-index";
  readonly schema: Schema;
  readonly migrationsFolder: string;
}

function migrationFolder(name: string): string {
  return fileURLToPath(new URL(`./migrations/${name}/`, import.meta.url));
}

export const localStoreDatabaseDefinition = {
  id: "local-store",
  schema: localStoreSchema,
  migrationsFolder: migrationFolder("local-store"),
} as const satisfies SqliteDatabaseDefinition<typeof localStoreSchema>;

export const keywordIndexDatabaseDefinition = {
  id: "keyword-index",
  schema: keywordIndexSchema,
  migrationsFolder: migrationFolder("keyword-index"),
} as const satisfies SqliteDatabaseDefinition<typeof keywordIndexSchema>;

export const semanticIndexDatabaseDefinition = {
  id: "semantic-index",
  schema: semanticIndexSchema,
  migrationsFolder: migrationFolder("semantic-index"),
} as const satisfies SqliteDatabaseDefinition<typeof semanticIndexSchema>;
