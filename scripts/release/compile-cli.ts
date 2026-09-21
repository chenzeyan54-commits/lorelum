import { existsSync } from "node:fs";
import { chmod, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { EmbeddingNativeArtifact } from "../../packages/backend/src/runtime/native/embedding/catalog";
import type { NativeArtifactManifest } from "../../packages/backend/src/runtime/native/embedding/manifest";

const repositoryRoot = resolve(import.meta.dir, "../..");
const defaultEntrypoint = join(repositoryRoot, "packages/cli/src/main.ts");
const migrationAssetsDirectory = "packages/engine/src/persistence/migrations";
const windowsIcon = join(repositoryRoot, "scripts/release/lorelum.ico");
const releaseManifestGlobalKey = "__LORELUM_RELEASE_NATIVE_MANIFEST__";

export function windowsCompileMetadataArguments(): readonly string[] {
  if (!existsSync(windowsIcon)) throw new Error(`Windows release icon is missing: ${windowsIcon}`);
  return Object.freeze([
    `--windows-icon=${windowsIcon}`,
    "--windows-title=Lorelum",
    "--windows-description=Lorelum local knowledge retrieval CLI",
  ]);
}

export interface CompileCliOptions {
  readonly outfile: string;
  /** Test-only alternate entrypoint; normal builds use the CLI entrypoint. */
  readonly entrypoint?: string;
  /** Test-only alternate target; normal builds target the current platform. */
  readonly target?: Bun.Build.CompileTarget;
  /** Internal compile-time setup used by release staging. */
  readonly banner?: string;
  /** Test-only override for validating the Windows-compatible Bun CLI compiler path. */
  readonly useBunCommand?: true;
}

export interface CompileReleaseCliOptions {
  readonly nativeManifest: NativeArtifactManifest;
  readonly outfile: string;
  /** Native artifact whose checked-in manifest the release replaces at startup. */
  readonly artifact: EmbeddingNativeArtifact;
  /** Test-only alternate entrypoint; release builds always use the CLI entrypoint. */
  readonly entrypoint?: string;
  /** Test-only compilation target; production derives this from the native artifact. */
  readonly target?: Bun.Build.CompileTarget;
  /** Test-only override for validating the Windows-compatible Bun CLI compiler path. */
  readonly useBunCommand?: true;
}

export interface CompiledCli {
  /** The executable Bun actually wrote; Windows targets append ".exe" to the outfile. */
  readonly output: string;
  readonly bundledInputs: readonly string[];
}

export type CompiledReleaseCli = CompiledCli;

/** Compile one standalone CLI with readable source-mapped runtime stacks. */
export async function compileCli(options: CompileCliOptions): Promise<CompiledCli> {
  await mkdir(dirname(options.outfile), { recursive: true });
  const job: CompileCliJob = {
    outfile: options.outfile,
    entrypoint: options.entrypoint ?? defaultEntrypoint,
    compileTarget:
      options.target ?? (`bun-${process.platform}-${process.arch}` as Bun.Build.CompileTarget),
    ...(options.banner === undefined ? {} : { banner: options.banner }),
  };
  if (options.useBunCommand === true || process.platform === "win32") {
    return compileWithBunCommand(job);
  }

  const result = await Bun.build({
    entrypoints: [job.entrypoint],
    target: "bun",
    sourcemap: "inline",
    minify: false,
    ...(job.banner === undefined ? {} : { banner: job.banner }),
    compile: {
      target: job.compileTarget,
      outfile: job.outfile,
      assets: [migrationAssetsDirectory],
      autoloadDotenv: false,
      autoloadBunfig: false,
    },
    metafile: true,
  });
  if (!result.success) {
    const details = result.logs.map((log) => log.message).join("\n");
    throw new Error(`failed to compile CLI${details ? `: ${details}` : ""}`);
  }
  return finishCompiledOutput(job, result.metafile);
}

/** Compile one CLI whose embedded manifest is byte-for-byte the staged native manifest. */
export async function compileReleaseCli(
  options: CompileReleaseCliOptions,
): Promise<CompiledReleaseCli> {
  return compileCli({
    outfile: options.outfile,
    ...(options.entrypoint === undefined ? {} : { entrypoint: options.entrypoint }),
    target: options.target ?? options.artifact.compileTarget,
    banner: releaseManifestBanner(options.artifact, options.nativeManifest),
    ...(options.useBunCommand === undefined ? {} : { useBunCommand: options.useBunCommand }),
  });
}

/**
 * Bun 1.4.2's Bun.build compile API misbuilds Windows executables: the binary exits
 * immediately without running the entry module. The CLI compiler does run correctly
 * there, and the release manifest arrives through an injected banner so this path can
 * compile the original TypeScript entrypoint rather than an unmapped intermediate bundle.
 */
async function compileWithBunCommand(job: CompileCliJob): Promise<CompiledCli> {
  const child = Bun.spawnSync(
    [
      process.execPath,
      "build",
      "--compile",
      `--target=${job.compileTarget}`,
      "--sourcemap=inline",
      "--no-minify",
      "--no-compile-autoload-dotenv",
      "--no-compile-autoload-bunfig",
      ...(job.compileTarget.startsWith("bun-windows-") ? windowsCompileMetadataArguments() : []),
      ...(job.banner === undefined ? [] : [`--banner=${job.banner}`]),
      "--asset",
      migrationAssetsDirectory,
      job.entrypoint,
      "--outfile",
      job.outfile,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (child.exitCode !== 0) {
    throw new Error(
      `release compile command failed: ${child.stdout.toString()}${child.stderr.toString()}`,
    );
  }
  const bundle = await Bun.build({
    entrypoints: [job.entrypoint],
    target: "bun",
    metafile: true,
    ...(job.banner === undefined ? {} : { banner: job.banner }),
  });
  if (!bundle.success) {
    const details = bundle.logs.map((log) => log.message).join("\n");
    throw new Error(`failed to inspect compiled CLI inputs${details ? `: ${details}` : ""}`);
  }
  return finishCompiledOutput(job, bundle.metafile);
}

interface CompileCliJob {
  readonly outfile: string;
  readonly entrypoint: string;
  readonly compileTarget: Bun.Build.CompileTarget;
  readonly banner?: string;
}

async function finishCompiledOutput(
  options: Pick<CompileCliJob, "outfile">,
  metafile: Bun.BuildMetafile | null | undefined,
): Promise<CompiledCli> {
  // Bun appends ".exe" to the outfile for Windows compile targets.
  const output = existsSync(options.outfile) ? options.outfile : `${options.outfile}.exe`;
  await chmod(output, 0o755);
  if (!metafile) throw new Error("release compiler did not return bundle metadata");
  return Object.freeze({
    output,
    bundledInputs: Object.freeze(Object.keys(metafile.inputs).sort()),
  });
}

function releaseManifestBanner(
  artifact: EmbeddingNativeArtifact,
  manifest: NativeArtifactManifest,
): string {
  return `Object.defineProperty(globalThis,${JSON.stringify(releaseManifestGlobalKey)},{value:${JSON.stringify(
    { artifactId: artifact.id, manifest },
  )},enumerable:false,configurable:false,writable:false});`;
}
