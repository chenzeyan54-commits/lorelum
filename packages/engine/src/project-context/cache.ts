import { createHash } from "node:crypto";
import { join } from "node:path";

import { resolveLorelumPaths } from "@lorelum/config";

import type { PersistentKeywordIndexPaths } from "../query/keyword/persistent-keyword-index";
import type { SemanticIndexPaths } from "../query/semantic/index/paths";
import type { ProjectContextSnapshot } from "./types";

export const PROJECT_CONTEXT_CACHE_VERSION = "v1";

export interface ProjectCachePaths {
  readonly directory: string;
  readonly catalog: string;
  readonly catalogWriter: string;
  readonly artifacts: string;
}

export interface SemanticVectorCachePaths {
  readonly directory: string;
  readonly database: string;
  readonly writer: string;
}

function hash(parts: readonly string[]): string {
  const hasher = createHash("sha256");
  for (const part of parts) {
    hasher.update(part, "utf8");
    hasher.update("\0", "utf8");
  }
  return hasher.digest("hex");
}

/** User-owned derived state; it is separate from both source directories and LocalStore data. */
export function defaultProjectCacheRoot(): string {
  return join(resolveLorelumPaths().rootDirectory, "cache");
}

/** All project cache state is user-owned and outside ProjectContext source trees. */
export function projectCachePaths(cacheRoot: string): ProjectCachePaths {
  const directory = join(cacheRoot, "project-context", PROJECT_CONTEXT_CACHE_VERSION);
  return Object.freeze({
    directory,
    catalog: join(directory, "project-cache.sqlite"),
    catalogWriter: join(directory, "catalog-writer"),
    artifacts: join(directory, "artifacts"),
  });
}

/** Shared vectors are independent from one complete ProjectContext artifact. */
export function semanticVectorCachePaths(cacheRoot: string): SemanticVectorCachePaths {
  const directory = join(cacheRoot, "semantic", PROJECT_CONTEXT_CACHE_VERSION);
  return Object.freeze({
    directory,
    database: join(directory, "vector-cache.sqlite"),
    writer: join(directory, "writer"),
  });
}

export function projectKeywordArtifactId(snapshot: ProjectContextSnapshot): string {
  return hash(["project-context-keyword/v1", snapshot.indexCorpusDigest]);
}

export function projectSemanticArtifactId(
  snapshot: ProjectContextSnapshot,
  profileId: string,
): string {
  return hash(["project-context-semantic/v1", profileId, snapshot.indexCorpusDigest]);
}

export function projectKeywordIndexPaths(
  cacheRoot: string,
  snapshot: ProjectContextSnapshot,
): PersistentKeywordIndexPaths {
  const directory = join(
    projectCachePaths(cacheRoot).artifacts,
    "keyword",
    projectKeywordArtifactId(snapshot),
  );
  return Object.freeze({
    directory,
    active: join(directory, "active.sqlite"),
    writer: join(directory, "writer"),
  });
}

export function projectSemanticIndexPaths(
  cacheRoot: string,
  snapshot: ProjectContextSnapshot,
  profileId: string,
): SemanticIndexPaths {
  const directory = join(
    projectCachePaths(cacheRoot).artifacts,
    "semantic",
    projectSemanticArtifactId(snapshot, profileId),
  );
  return Object.freeze({
    directory,
    active: join(directory, "active.sqlite"),
    writer: join(directory, "writer"),
  });
}
