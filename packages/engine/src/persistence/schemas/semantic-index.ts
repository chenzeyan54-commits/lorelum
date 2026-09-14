import { sql } from "drizzle-orm";
import { blob, check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const semanticIndexMetadata = sqliteTable(
  "semantic_index_metadata",
  {
    singleton: integer("singleton").primaryKey(),
    indexVersion: integer("index_version").notNull(),
    rootBinding: text("root_binding").notNull(),
    generation: integer("generation").notNull(),
    effectiveRevision: integer("effective_revision").notNull(),
    manifestDigest: text("manifest_digest").notNull(),
    profileId: text("profile_id").notNull(),
    encodingId: text("encoding_id").notNull(),
    dimensions: integer("dimensions").notNull(),
    documentProjectionVersion: integer("document_projection_version").notNull(),
    normalization: text("normalization").notNull(),
    vectorCount: integer("vector_count").notNull(),
  },
  (table) => [check("semantic_index_metadata_singleton", sql`${table.singleton} = 1`)],
);

export const semanticVectors = sqliteTable("semantic_vectors", {
  practiceId: text("practice_id").primaryKey(),
  contentDigest: text("content_digest").notNull(),
  projectionDigest: text("projection_digest").notNull(),
  vector: blob("vector", { mode: "buffer" }).notNull(),
});
