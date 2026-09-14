import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const localStoreMetadata = sqliteTable(
  "local_store_metadata",
  {
    singleton: integer("singleton").primaryKey(),
    schemaVersion: integer("schema_version").notNull(),
    installedPacksGeneration: integer("installed_packs_generation").notNull(),
    effectiveRevision: integer("effective_revision").notNull(),
  },
  (table) => [check("local_store_metadata_singleton", sql`${table.singleton} = 1`)],
);

export const activePacks = sqliteTable("active_packs", {
  packName: text("pack_name").primaryKey(),
  packVersion: text("pack_version").notNull(),
  artifactDigest: text("artifact_digest").notNull(),
  storageKey: text("storage_key").notNull(),
  installedAt: text("installed_at").notNull(),
});

export const effectivePractices = sqliteTable("effective_practices", {
  practiceId: text("practice_id").primaryKey(),
  contentDigest: text("content_digest").notNull(),
  canonicalContent: text("canonical_content").notNull(),
  title: text("title").notNull(),
  stage: text("stage").notNull(),
  techStackJson: text("tech_stack_json").notNull(),
  appliesWhen: text("applies_when").notNull(),
  severity: text("severity").notNull(),
  effectiveRevision: integer("effective_revision").notNull(),
});

export const practiceSources = sqliteTable(
  "practice_sources",
  {
    packName: text("pack_name")
      .notNull()
      .references(() => activePacks.packName, { onDelete: "cascade" }),
    practiceId: text("practice_id")
      .notNull()
      .references(() => effectivePractices.practiceId, { onDelete: "cascade" }),
    contentDigest: text("content_digest").notNull(),
    sourcePath: text("source_path").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.packName, table.practiceId] }),
    index("practice_sources_by_practice").on(table.practiceId, table.packName, table.sourcePath),
  ],
);

export const effectiveRevisionOutbox = sqliteTable("effective_revision_outbox", {
  revision: integer("revision").primaryKey(),
  deltaJson: text("delta_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const effectiveRevisionLog = sqliteTable("effective_revision_log", {
  revision: integer("revision").primaryKey(),
  deltaJson: text("delta_json").notNull(),
  createdAt: text("created_at").notNull(),
});
