import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { PackCandidate } from "../../model";
import { ArtifactIntegrityError } from "../errors";

/**
 * Rebuild a Pack snapshot directory from an in-memory candidate. The public
 * install/upgrade API takes a `PackCandidate` (ADR 0007 §13), so the immutable
 * snapshot is reconstructed from the validated data: `pack.yaml`, each
 * Practice's frontmatter, and `decisions.yaml` are serialized as JSON, which
 * is a strict YAML 1.2 subset — `@lorelum/format`'s `parseYaml` and the
 * guarded frontmatter parser both accept it, so the workspace keeps its
 * single YAML dependency.
 *
 * The snapshot is sealed (projection written, digest computed) by the caller
 * via `sealSnapshot` + `promoteArtifact`; this module only materializes the
 * author-visible files. A candidate with no decisions writes no
 * `decisions.yaml`, which is a valid v1 pack (ADR 0007 §10).
 */

function frontmatterFields(
  practice: PackCandidate["sources"][number]["canonicalPractice"]["practice"],
): object {
  const { id, title, stage, tech_stack, applies_when, severity, anti_patterns } = practice;
  return {
    id,
    title,
    stage,
    tech_stack,
    applies_when,
    ...(severity === undefined ? {} : { severity }),
    ...(anti_patterns === undefined || anti_patterns.length === 0 ? {} : { anti_patterns }),
  };
}

/** Materialize a candidate into an unsealed snapshot directory. */
export async function writeSnapshotFromCandidate(
  snapshotPath: string,
  candidate: PackCandidate,
): Promise<void> {
  // pack.yaml as JSON (YAML subset): keeps the digest byte-stable across
  // rebuilds and needs no YAML serializer in the engine package.
  await mkdir(snapshotPath, { recursive: true });
  try {
    await writeFile(join(snapshotPath, "pack.yaml"), JSON.stringify(candidate.pack), "utf8");
  } catch (error) {
    throw new ArtifactIntegrityError(
      snapshotPath,
      "cannot write pack.yaml: " + (error instanceof Error ? error.message : String(error)),
    );
  }

  // decisions.yaml as a top-level JSON array (YAML sequence) when present.
  if (candidate.decisions.length > 0) {
    try {
      await writeFile(
        join(snapshotPath, "decisions.yaml"),
        JSON.stringify(candidate.decisions),
        "utf8",
      );
    } catch (error) {
      throw new ArtifactIntegrityError(
        snapshotPath,
        "cannot write decisions.yaml: " + (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  // Materialize each Practice file; writes are independent per source.
  await Promise.all(
    candidate.sources.map(async (source) => {
      const practice = source.canonicalPractice.practice;
      const markdownPath = join(snapshotPath, source.sourcePath);
      try {
        await mkdir(join(markdownPath, ".."), { recursive: true });
        const frontmatter = JSON.stringify(frontmatterFields(practice));
        const body = practice.body ?? "";
        await writeFile(markdownPath, `---\n${frontmatter}\n---\n${body}`, "utf8");
      } catch (error) {
        throw new ArtifactIntegrityError(
          snapshotPath,
          "cannot write " +
            source.sourcePath +
            ": " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    }),
  );

  // Resources are intentionally materialized verbatim and remain outside the
  // canonical Practice projection. Their paths were validated when the
  // candidate was constructed; `writeFile` accepts Uint8Array without text
  // conversion, preserving binary assets exactly.
  await Promise.all(
    candidate.resources.map(async (resource) => {
      const resourcePath = join(snapshotPath, resource.sourcePath);
      try {
        await mkdir(dirname(resourcePath), { recursive: true });
        await writeFile(resourcePath, resource.bytes);
      } catch (error) {
        throw new ArtifactIntegrityError(
          snapshotPath,
          "cannot write " +
            resource.sourcePath +
            ": " +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    }),
  );
}
