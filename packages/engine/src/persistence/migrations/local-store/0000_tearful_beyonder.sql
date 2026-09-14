CREATE TABLE `active_packs` (
	`pack_name` text PRIMARY KEY NOT NULL,
	`pack_version` text NOT NULL,
	`artifact_digest` text NOT NULL,
	`storage_key` text NOT NULL,
	`installed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `effective_practices` (
	`practice_id` text PRIMARY KEY NOT NULL,
	`content_digest` text NOT NULL,
	`canonical_content` text NOT NULL,
	`title` text NOT NULL,
	`stage` text NOT NULL,
	`tech_stack_json` text NOT NULL,
	`applies_when` text NOT NULL,
	`severity` text NOT NULL,
	`effective_revision` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `effective_revision_log` (
	`revision` integer PRIMARY KEY NOT NULL,
	`delta_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `effective_revision_outbox` (
	`revision` integer PRIMARY KEY NOT NULL,
	`delta_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `local_store_metadata` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`schema_version` integer NOT NULL,
	`installed_packs_generation` integer NOT NULL,
	`effective_revision` integer NOT NULL,
	CONSTRAINT "local_store_metadata_singleton" CHECK("local_store_metadata"."singleton" = 1)
);
--> statement-breakpoint
CREATE TABLE `practice_sources` (
	`pack_name` text NOT NULL,
	`practice_id` text NOT NULL,
	`content_digest` text NOT NULL,
	`source_path` text NOT NULL,
	PRIMARY KEY(`pack_name`, `practice_id`),
	FOREIGN KEY (`pack_name`) REFERENCES `active_packs`(`pack_name`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`practice_id`) REFERENCES `effective_practices`(`practice_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `practice_sources_by_practice` ON `practice_sources` (`practice_id`,`pack_name`,`source_path`);