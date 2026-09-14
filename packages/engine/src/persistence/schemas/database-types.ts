import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

import * as localStoreSchema from "./local-store";
import * as semanticIndexSchema from "./semantic-index";

/** Typed Drizzle handles for Engine's ordinary relational persistence. */
export type LocalStoreDatabase = BunSQLiteDatabase<typeof localStoreSchema>;
export type SemanticIndexDatabase = BunSQLiteDatabase<typeof semanticIndexSchema>;
