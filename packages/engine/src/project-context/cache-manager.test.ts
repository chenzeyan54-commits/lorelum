import { expect, test } from "bun:test";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createEmbeddingProfile } from "../query/semantic";
import { projectKeywordIndexPaths, projectSemanticIndexPaths } from "./cache";
import { projectCacheStatus, pruneProjectCache } from "./cache-manager";
import { queryProjectContextKeyword } from "./keyword-query";
import { resolveProjectContext } from "./resolver";
import { ProjectSemanticProgressService } from "./semantic-progress";

const encodingId = "c".repeat(64);

test("reports and explicitly prunes only derived project cache state", async () => {
  const [root, cache] = await Promise.all([
    mkdtemp(join(tmpdir(), "lorelum-project-cache-manager-")),
    mkdtemp(join(tmpdir(), "lorelum-project-cache-manager-root-")),
  ]);
  try {
    const pack = join(root, ".lorelum", "packs", "platform");
    const practicePath = join(pack, "practices", "cache.md");
    const source = `---
id: platform.cache
title: Derived cache hygiene
stage: implementation
tech_stack:
  - typescript
applies_when: When pruning a derived project cache.
---
Keep source data outside the cache.
`;
    await mkdir(join(pack, "practices"), { recursive: true });
    await writeFile(join(pack, "pack.yaml"), "name: platform\nversion: 1.0.0\n");
    await writeFile(practicePath, source);
    const snapshot = await resolveProjectContext({
      startDirectory: root,
      storageRoot: { rootPath: join(root, "store") },
      store: {
        async readEffectivePracticeSnapshot() {
          return { practices: [] };
        },
      },
    });
    if (snapshot === undefined) throw new Error("Expected ProjectContext");
    const profile = createEmbeddingProfile({ encodingId, dimensions: 2 });

    await queryProjectContextKeyword(snapshot, cache, { text: "derived cache" });
    await new ProjectSemanticProgressService(snapshot, cache, profile, {
      maxBatchSize: 8,
      async embed(inputs) {
        return { encodingId, vectors: inputs.map(() => [1, 0]) };
      },
    }).build();

    await expect(projectCacheStatus(cache)).resolves.toMatchObject({
      artifactCount: 2,
      keywordArtifactCount: 1,
      semanticArtifactCount: 1,
      vectorCount: 1,
    });
    await expect(pruneProjectCache(cache)).resolves.toMatchObject({
      removedArtifactCount: 2,
      skippedArtifactCount: 0,
    });
    await expect(access(projectKeywordIndexPaths(cache, snapshot).active)).rejects.toThrow();
    await expect(
      access(projectSemanticIndexPaths(cache, snapshot, profile.profileId).active),
    ).rejects.toThrow();
    expect(await Bun.file(practicePath).text()).toBe(source);
    await expect(projectCacheStatus(cache)).resolves.toMatchObject({
      artifactCount: 0,
      vectorCount: 0,
    });
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(cache, { recursive: true, force: true }),
    ]);
  }
});
