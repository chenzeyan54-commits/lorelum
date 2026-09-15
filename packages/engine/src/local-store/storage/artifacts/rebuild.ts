import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { DecisionNode } from "@lorelum/format";

import {
  reconcileEffectivePractices,
  type EffectivePractice,
  type PracticeSource,
} from "../../model";
import { artifactPath, calculateArtifactDigest } from "./artifact-store";
import { decodeSnapshot } from "./snapshot-codec";
import { parseProjection, PROJECTION_RELATIVE_PATH, type SnapshotProjection } from "./projection";
import { ArtifactIntegrityError, ManifestError } from "../errors";
import type {
  InstalledPackManifestEntry,
  InstalledPacksManifest,
} from "../manifest/manifest-store";

function entryPath(rootPath: string, entry: InstalledPackManifestEntry): string {
  return artifactPath(rootPath, entry.storageKey, entry.artifactDigest);
}

async function readSealedProjection(artifactDir: string): Promise<SnapshotProjection> {
  let text: string;
  try {
    text = await readFile(join(artifactDir, PROJECTION_RELATIVE_PATH), "utf8");
  } catch (error) {
    throw new ArtifactIntegrityError(
      artifactDir,
      "sealed projection cannot be read: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  return parseProjection(text, artifactDir);
}

function verifyProjectionMatches(
  entry: InstalledPackManifestEntry,
  sources: readonly PracticeSource[],
  decisions: readonly DecisionNode[],
  projection: SnapshotProjection,
): void {
  if (projection.pack.name !== entry.packName || projection.pack.version !== entry.packVersion) {
    throw new ManifestError(entry.storageKey, "projection pack metadata differs from the manifest");
  }
  const bySourcePath = new Map(sources.map((source) => [source.sourcePath, source] as const));
  if (projection.practices.length !== sources.length) {
    throw new ManifestError(
      entry.storageKey,
      "projection practice count differs from re-parsed snapshot",
    );
  }
  for (const expected of projection.practices) {
    const source = bySourcePath.get(expected.sourcePath);
    if (
      source === undefined ||
      source.practiceId !== expected.id ||
      source.contentDigest !== expected.contentDigest ||
      source.canonicalPractice.canonicalContent !== expected.canonicalContent
    ) {
      throw new ManifestError(
        entry.storageKey,
        `projection practice ${expected.id} differs from re-parsed snapshot`,
      );
    }
  }
  if (JSON.stringify(projection.decisions) !== JSON.stringify(decisions)) {
    throw new ManifestError(
      entry.storageKey,
      "projection decisions differ from re-parsed snapshot",
    );
  }
}

function mergeSources(sources: readonly PracticeSource[]): readonly EffectivePractice[] {
  const byPack = new Map<string, PracticeSource[]>();
  for (const source of sources) {
    const group = byPack.get(source.packName);
    if (group === undefined) byPack.set(source.packName, [source]);
    else group.push(source);
  }
  let reconciled = {
    sources: Object.freeze([] as readonly PracticeSource[]),
    effectivePractices: Object.freeze([] as readonly EffectivePractice[]),
  };
  for (const [packName, packSources] of byPack) {
    const candidate = {
      pack: Object.freeze({ name: packName, version: "0.0.0" }),
      sources: Object.freeze(packSources),
      decisions: Object.freeze([]),
      resources: Object.freeze([]),
    };
    reconciled = reconcileEffectivePractices(reconciled.sources, candidate);
  }
  return reconciled.effectivePractices;
}

/** Reconstruct the effective corpus exclusively from authoritative active Pack snapshots. */
export async function rebuildEffectivePracticesFromManifest(
  rootPath: string,
  manifest: InstalledPacksManifest,
): Promise<readonly EffectivePractice[]> {
  const decodedByIndex = await Promise.all(
    manifest.packs.map(async (entry) => {
      const artifactDir = entryPath(rootPath, entry);
      if ((await calculateArtifactDigest(artifactDir)) !== entry.artifactDigest) {
        throw new ManifestError(artifactDir, "artifact digest does not match the active manifest");
      }
      const decoded = await decodeSnapshot(artifactDir);
      const projection = await readSealedProjection(artifactDir);
      verifyProjectionMatches(
        entry,
        decoded.candidate.sources,
        decoded.candidate.decisions,
        projection,
      );
      return decoded.candidate.sources;
    }),
  );
  return mergeSources(decodedByIndex.flat());
}
