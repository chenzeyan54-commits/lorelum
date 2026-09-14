import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** The FTS5 virtual table is created by the keyword init SQL, not sqliteTable(). */
export const keywordIndexMetadata = sqliteTable(
  "keyword_index_metadata",
  {
    singleton: integer("singleton").primaryKey(),
    rootBinding: text("root_binding").notNull(),
    effectiveRevision: integer("effective_revision").notNull(),
  },
  (table) => [check("keyword_index_metadata_singleton", sql`${table.singleton} = 1`)],
);
