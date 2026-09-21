import { join, resolve } from "node:path";
import { parseNativeArtifactManifest } from "./manifest";
import darwinArm64Manifest from "./darwin-arm64.json";
import linuxX64Manifest from "./linux-x64.json";
import win32X64Manifest from "./win32-x64.json";

const releaseManifestGlobalKey = "__LORELUM_RELEASE_NATIVE_MANIFEST__";

interface ReleaseManifestInjection {
  readonly artifactId: string;
  readonly manifest: unknown;
}

const backendPackageRoot = resolve(import.meta.dir, "../../../..");
const developmentEmbeddingArtifactRoot = join(
  backendPackageRoot,
  ".artifacts",
  "native",
  "embedding",
);

function manifestForRelease(
  artifactId: string,
  fallback: ReturnType<typeof parseNativeArtifactManifest>,
): ReturnType<typeof parseNativeArtifactManifest> {
  const candidate = (globalThis as Record<string, unknown>)[releaseManifestGlobalKey];
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate))
    return fallback;
  const injection = candidate as ReleaseManifestInjection;
  if (injection.artifactId !== artifactId) return fallback;
  return parseNativeArtifactManifest(injection.manifest);
}

const embeddingNativeArtifacts = [
  {
    id: "darwin-arm64",
    platform: "darwin",
    arch: "arm64",
    compileTarget: "bun-darwin-arm64",
    manifest: manifestForRelease("darwin-arm64", parseNativeArtifactManifest(darwinArm64Manifest)),
  },
  {
    id: "linux-x64",
    platform: "linux",
    arch: "x64",
    compileTarget: "bun-linux-x64",
    manifest: manifestForRelease("linux-x64", parseNativeArtifactManifest(linuxX64Manifest)),
  },
  {
    id: "win32-x64",
    platform: "win32",
    arch: "x64",
    compileTarget: "bun-windows-x64",
    manifest: manifestForRelease("win32-x64", parseNativeArtifactManifest(win32X64Manifest)),
  },
] as const satisfies readonly {
  readonly id: string;
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly compileTarget: Bun.Build.CompileTarget;
  readonly manifest: ReturnType<typeof parseNativeArtifactManifest>;
}[];

export type EmbeddingNativeArtifact = (typeof embeddingNativeArtifacts)[number];

/** Return the shipped embedding runtime for one OS and architecture, if supported. */
export function resolveEmbeddingNativeArtifact(
  platform: NodeJS.Platform,
  arch: string,
): EmbeddingNativeArtifact | undefined {
  return embeddingNativeArtifacts.find(
    (artifact) => artifact.platform === platform && artifact.arch === arch,
  );
}

/** Development candidates are private to the backend package, never release output. */
export function developmentEmbeddingArtifactDirectory(artifact: EmbeddingNativeArtifact): string {
  return join(developmentEmbeddingArtifactRoot, artifact.id);
}

/** Installed artifacts remain adjacent to the compiled executable's resolved release root. */
export function installedEmbeddingArtifactDirectory(
  releaseRoot: string,
  artifact: EmbeddingNativeArtifact,
): string {
  return join(releaseRoot, "native", artifact.id);
}

/** The compiler injects a verified candidate manifest while these source JSON files serve development. */
export function trustedEmbeddingManifestPath(artifact: EmbeddingNativeArtifact): string {
  return join(import.meta.dir, `${artifact.id}.json`);
}
