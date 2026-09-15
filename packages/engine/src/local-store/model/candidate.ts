import {
  buildReport,
  parsePackInput,
  validateResourceLinks,
  validateResourcePath,
  validateParsedPack,
  type Pack,
  type UnvalidatedPackInput,
  type ValidationIssue,
} from "@lorelum/format";

import { canonicalizePractice } from "./canonical-practice";
import { InvalidResourcePathError, InvalidSourcePathError, PackValidationError } from "./errors";
import { deepFreeze } from "./freeze";
import type { PackCandidate, PackResource, PackSnapshot, PracticeSource } from "./types";

function isWindowsReservedPathSegment(segment: string): boolean {
  const baseName = segment.split(".", 1)[0]?.toLowerCase();
  return (
    baseName === "con" ||
    baseName === "prn" ||
    baseName === "aux" ||
    baseName === "nul" ||
    baseName === "clock$" ||
    /^com[1-9]$/.test(baseName ?? "") ||
    /^lpt[1-9]$/.test(baseName ?? "")
  );
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

/** Verify a Pack-root-relative Practice source path without resolving it on disk. */
export function isPracticeSourcePath(path: string): boolean {
  return (
    /^practices\/(?:[^/]+\/)*[^/]+\.md$/.test(path) &&
    !path.includes("\\") &&
    !path.includes(":") &&
    !path.includes("*") &&
    !path.includes("<") &&
    !path.includes(">") &&
    !path.includes("|") &&
    !path.includes(String.fromCharCode(34)) &&
    !path.includes(String.fromCharCode(63)) &&
    !hasControlCharacter(path) &&
    !path
      .split("/")
      .some(
        (segment) => segment === "." || segment === ".." || isWindowsReservedPathSegment(segment),
      )
  );
}

/** Verify a Pack-root-relative resource path without resolving it on disk. */
export function isPackResourcePath(path: string): boolean {
  return validateResourcePath(path).valid;
}

function snapshotPack(pack: Pack): PackSnapshot {
  const snapshot = structuredClone(pack);
  return deepFreeze(snapshot) as PackSnapshot;
}

/** Construct a storage-ready candidate only after the format authoring gate passes. */
export function createPackCandidate(
  input: UnvalidatedPackInput,
  sourcePathsByPracticeId: Readonly<Record<string, string>>,
  resources: readonly PackResource[] = [],
): { candidate: PackCandidate; diagnostics: readonly ValidationIssue[] } {
  const parsed = parsePackInput(input);
  if (!parsed.ok) throw new PackValidationError(parsed.report);
  const { pack, practices, decisions } = parsed.value;
  // Full report: format gate already passed, so the semantic stages decide
  // validity (reference integrity, cycles) and provide diagnostics.
  const report = validateParsedPack(parsed.value);
  if (!report.valid) throw new PackValidationError(report);
  const practiceIds = new Set(practices.map((practice) => practice.id));
  for (const sourcePracticeId of Object.keys(sourcePathsByPracticeId)) {
    if (!practiceIds.has(sourcePracticeId)) {
      throw new InvalidSourcePathError(
        sourcePracticeId,
        sourcePathsByPracticeId[sourcePracticeId] ?? "(missing)",
      );
    }
  }

  const sources: PracticeSource[] = practices.map((practice) => {
    const sourcePath = Object.hasOwn(sourcePathsByPracticeId, practice.id)
      ? sourcePathsByPracticeId[practice.id]
      : undefined;
    if (sourcePath === undefined || !isPracticeSourcePath(sourcePath)) {
      throw new InvalidSourcePathError(practice.id, sourcePath ?? "(missing)");
    }

    const canonicalPractice = canonicalizePractice(practice);
    return Object.freeze({
      packName: pack.name,
      practiceId: practice.id,
      contentDigest: canonicalPractice.contentDigest,
      sourcePath,
      canonicalPractice,
    });
  });
  const sourcePaths = new Set<string>();
  for (const source of sources) {
    if (sourcePaths.has(source.sourcePath)) {
      throw new InvalidSourcePathError(source.practiceId, `${source.sourcePath} (duplicate)`);
    }
    sourcePaths.add(source.sourcePath);
  }

  const resourcePaths = new Set<string>();
  const resourceSnapshots = resources.map((resource) => {
    const pathValidation = validateResourcePath(resource.sourcePath);
    if (!pathValidation.valid) {
      throw new InvalidResourcePathError(resource.sourcePath, pathValidation.reason);
    }
    if (!(resource.bytes instanceof Uint8Array)) {
      throw new InvalidResourcePathError(resource.sourcePath, "contents are not raw bytes");
    }
    if (resourcePaths.has(resource.sourcePath)) {
      throw new InvalidResourcePathError(resource.sourcePath, "duplicate path");
    }
    resourcePaths.add(resource.sourcePath);
    return Object.freeze({
      sourcePath: resource.sourcePath,
      // Copy source bytes so callers cannot alter a candidate before it is
      // materialized into its immutable snapshot.
      bytes: new Uint8Array(resource.bytes),
    });
  });

  const availableResourcePaths = new Set(resourceSnapshots.map((resource) => resource.sourcePath));
  const resourceLinkIssues = sources.flatMap((source) =>
    validateResourceLinks(source.canonicalPractice.practice.body ?? "", {
      sourcePath: source.sourcePath,
      availablePaths: availableResourcePaths,
    }),
  );
  if (resourceLinkIssues.length > 0) {
    throw new PackValidationError(
      buildReport([...report.warnings, ...report.infos, ...resourceLinkIssues]),
    );
  }

  return {
    candidate: Object.freeze({
      pack: snapshotPack(pack),
      sources: Object.freeze(sources),
      decisions: Object.freeze(decisions.map((decision) => deepFreeze(structuredClone(decision)))),
      resources: Object.freeze(resourceSnapshots),
    }),
    diagnostics: [...report.warnings, ...report.infos],
  };
}
