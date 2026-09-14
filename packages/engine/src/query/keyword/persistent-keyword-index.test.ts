import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { KEYWORD_INDEX_VERSION } from "./keyword-index";
import {
  createPersistentKeywordIndex,
  openPersistentKeywordIndex,
} from "./persistent-keyword-index";
import type { KeywordDocument } from "./projection";

function document(practiceId: string, title: string): KeywordDocument {
  return {
    practiceId,
    contentDigest: `${practiceId}-digest`,
    id: practiceId,
    title,
    appliesWhen: "",
    techStack: "",
    stage: "",
    antiPatterns: "",
    body: "",
  };
}

test("persistent keyword indexes use the Drizzle baseline and retain atomic FTS/checkpoint updates", async () => {
  const rootPath = await mkdtemp(join(tmpdir(), "lorelum-keyword-index-"));
  try {
    const index = await createPersistentKeywordIndex(
      rootPath,
      { rootBinding: "root-a", effectiveRevision: 1 },
      [document("platform.api", "API")],
    );
    try {
      expect(index.search("api", 5).map((candidate) => candidate.practiceId)).toEqual([
        "platform.api",
      ]);

      index.applyChanges(
        { rootBinding: "root-a", effectiveRevision: 2 },
        ["platform.api"],
        [document("platform.auth", "Authentication")],
      );

      expect(index.checkpoint).toEqual({ rootBinding: "root-a", effectiveRevision: 2 });
      expect(index.search("api", 5)).toEqual([]);
      expect(index.search("authentication", 5).map((candidate) => candidate.practiceId)).toEqual([
        "platform.auth",
      ]);
    } finally {
      index.close();
    }

    const path = join(
      rootPath,
      "indexes",
      "keyword",
      `v${KEYWORD_INDEX_VERSION}`,
      "active.sqlite",
    );
    const database = new Database(path, { readonly: true });
    try {
      expect(database.query("SELECT COUNT(*) AS count FROM __drizzle_migrations").get()).toEqual({
        count: 1,
      });
      expect(database.query("SELECT COUNT(*) AS count FROM keyword_documents").get()).toEqual({
        count: 1,
      });
    } finally {
      database.close();
    }

    const reopened = await openPersistentKeywordIndex(rootPath);
    expect(reopened?.checkpoint).toEqual({ rootBinding: "root-a", effectiveRevision: 2 });
    try {
      expect(reopened?.search("authentication", 5).map((candidate) => candidate.practiceId)).toEqual([
        "platform.auth",
      ]);
    } finally {
      reopened?.close();
    }
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
