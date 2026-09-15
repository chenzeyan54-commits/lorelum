import { mkdir, rm } from "node:fs/promises";

import { KeywordIndexError } from "../query/errors";
import {
  createPersistentKeywordIndexAt,
  openPersistentKeywordIndexAt,
  withPersistentKeywordIndexWriterAt,
  type PersistentKeywordIndex,
} from "../query/keyword/persistent-keyword-index";
import { projectKeywordPractice } from "../query/keyword/projection";
import { parseQueryRequest } from "../query/request";
import { assembleQueryHits } from "../query/result";
import type { QueryRequest, QueryResult } from "../query/types";
import { withProjectArtifactLease } from "./artifact-lease";
import { projectKeywordArtifactId, projectKeywordIndexPaths } from "./cache";
import { recordProjectCacheArtifact } from "./cache-catalog";
import type { ProjectContextSnapshot } from "./types";

function currentArtifact(index: PersistentKeywordIndex, snapshot: ProjectContextSnapshot): boolean {
  return (
    index.checkpoint.rootBinding === snapshot.indexCorpusDigest &&
    index.checkpoint.effectiveRevision === 0
  );
}

async function openOrBuild(
  snapshot: ProjectContextSnapshot,
  cacheRoot: string,
): Promise<PersistentKeywordIndex> {
  const paths = projectKeywordIndexPaths(cacheRoot, snapshot);
  return withPersistentKeywordIndexWriterAt(paths, async () => {
    let existing: PersistentKeywordIndex | undefined;
    try {
      existing = await openPersistentKeywordIndexAt(paths);
      if (existing !== undefined && currentArtifact(existing, snapshot)) return existing;
      existing?.close();
      existing = undefined;
    } catch (error) {
      existing?.close();
      if (!(error instanceof KeywordIndexError)) throw error;
      await rm(paths.active, { force: true }).catch(() => undefined);
    }
    return createPersistentKeywordIndexAt(
      paths,
      { rootBinding: snapshot.indexCorpusDigest, effectiveRevision: 0 },
      snapshot.practices.map(projectKeywordPractice),
    );
  });
}

/** Query a complete, content-addressed ProjectContext artifact and read summaries from the snapshot. */
export async function queryProjectContextKeyword(
  snapshot: ProjectContextSnapshot,
  cacheRoot: string,
  request: QueryRequest,
): Promise<QueryResult> {
  const input = parseQueryRequest(request);
  const paths = projectKeywordIndexPaths(cacheRoot, snapshot);
  await mkdir(paths.directory, { recursive: true });
  return withProjectArtifactLease(paths.directory, async () => {
    const index = await openOrBuild(snapshot, cacheRoot);
    try {
      await recordProjectCacheArtifact(cacheRoot, {
        artifactId: projectKeywordArtifactId(snapshot),
        kind: "keyword",
        corpusDigest: snapshot.indexCorpusDigest,
        documentCount: snapshot.practices.length,
        state: "ready",
        filePath: paths.active,
        verified: true,
      });
      const candidates = index.search(input.text, input.limit);
      return Object.freeze({
        mode: "keyword",
        results: assembleQueryHits(
          snapshot.practices,
          candidates,
          (message) => new KeywordIndexError(message),
        ),
      });
    } finally {
      index.close();
    }
  });
}
