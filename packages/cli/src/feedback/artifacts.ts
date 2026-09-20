import { constants } from "node:fs";
import { lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { FeedbackReport } from "./types.js";

export interface FeedbackArtifact {
  readonly directory: string;
  readonly reportPath: string;
  readonly markdownPath: string;
}

async function ensureSafeDirectory(path: string): Promise<void> {
  const absolute = resolve(path);
  const parent = dirname(absolute);
  if (parent !== absolute) await ensureSafeDirectory(parent);
  const current = await lstat(absolute).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  });
  if (current === undefined) {
    await mkdir(absolute, { mode: 0o700 });
    return;
  }
  if (!current.isDirectory() || current.isSymbolicLink()) {
    throw new TypeError("Feedback output directory is unsafe.");
  }
}

async function writeAtomically(path: string, contents: string): Promise<void> {
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  const file = await open(
    temporary,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600,
  );
  try {
    await file.writeFile(contents, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

/** Publish both report views in one unique private directory or clean up on failure. */
export async function publishFeedbackArtifact(
  outputDirectory: string,
  report: FeedbackReport,
  markdown: string,
): Promise<FeedbackArtifact> {
  await ensureSafeDirectory(outputDirectory);
  const directory = join(resolve(outputDirectory), `feedback-${crypto.randomUUID()}`);
  await mkdir(directory, { mode: 0o700 });
  const reportPath = join(directory, "report.json");
  const markdownPath = join(directory, "report.md");
  try {
    await writeAtomically(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await writeAtomically(markdownPath, markdown);
    return { directory, reportPath, markdownPath };
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
