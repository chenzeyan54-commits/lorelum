import { homedir } from "node:os";
import { join } from "node:path";

export interface LorelumPaths {
  readonly rootDirectory: string;
  readonly configFile: string;
}

/** Resolve the shared Lorelum paths without touching the filesystem. */
export function resolveLorelumPaths(homeDirectory = homedir()): LorelumPaths {
  const rootDirectory = join(homeDirectory, ".lorelum");
  return Object.freeze({
    rootDirectory,
    configFile: join(rootDirectory, "config.yaml"),
  });
}

/** User-scoped local artifacts that are intentionally separate from config. */
export function defaultFeedbackDirectory(homeDirectory = homedir()): string {
  return join(resolveLorelumPaths(homeDirectory).rootDirectory, "feedback");
}

/** User-scoped records written by CLI, Backend, and Host Hook log sinks. */
export function defaultLogDirectory(homeDirectory = homedir()): string {
  return join(resolveLorelumPaths(homeDirectory).rootDirectory, "logs");
}
