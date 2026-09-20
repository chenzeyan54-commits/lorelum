import { constants } from "node:fs";
import { chmod, lstat, mkdir, open } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
/* eslint-disable no-await-in-loop -- Each path component must be checked and created in order. */

import {
  createLogRecord,
  serializeLogRecord,
  type LogEventInput,
  type LogRecord,
} from "../record.js";
import type { LogSink } from "../sink.js";

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function assertPrivateDirectory(path: string): Promise<void> {
  const info = await lstat(path);
  if (
    info.isSymbolicLink() ||
    !info.isDirectory() ||
    (process.platform !== "win32" && (info.mode & 0o077) !== 0)
  ) {
    throw new Error("Managed log directory is unsafe.");
  }
}

function relativeSegments(root: string, target: string): readonly string[] {
  const suffix = relative(root, target);
  if (suffix === "") return [];
  if (suffix === ".." || suffix.startsWith(`..${sep}`)) {
    throw new Error("Managed log directory escaped its root.");
  }
  return suffix.split(sep).filter(Boolean);
}

async function ensurePrivateDirectory(
  directory: string,
  rootDirectory: string,
  trustedDirectory: string,
): Promise<void> {
  const trusted = resolve(trustedDirectory);
  const root = resolve(rootDirectory);
  const target = resolve(directory);
  const rootSegments = relativeSegments(trusted, root);
  const targetSegments = relativeSegments(root, target);
  await mkdir(trusted, { recursive: true, mode: 0o700 });
  await assertPrivateDirectory(trusted);
  let current = trusted;
  for (const segment of [...rootSegments, ...targetSegments]) {
    current = join(current, segment);
    let created = false;
    await lstat(current).catch(async (error: unknown) => {
      if (!hasCode(error, "ENOENT")) throw error;
      try {
        await mkdir(current, { mode: 0o700 });
        created = true;
      } catch (mkdirError) {
        if (!hasCode(mkdirError, "EEXIST")) throw mkdirError;
      }
      return lstat(current);
    });
    if (created) {
      await chmod(current, 0o700);
    }
    await assertPrivateDirectory(current);
  }
}

async function assertPrivateTarget(path: string, allowMissing: boolean): Promise<void> {
  const info = await lstat(path).catch((error: unknown) => {
    if (allowMissing && hasCode(error, "ENOENT")) return undefined;
    throw error;
  });
  if (info === undefined) return;
  if (info.isSymbolicLink() || !info.isFile() || info.nlink !== 1) {
    throw new Error("Managed log file is unsafe.");
  }
  if (process.platform !== "win32" && (info.mode & 0o077) !== 0) {
    throw new Error("Managed log file is not private.");
  }
}

/** A best-effort append-only JSONL sink for one process-owned segment file. */
export class JsonlFileSink implements LogSink {
  private disabled = false;
  private queue: Promise<void> = Promise.resolve();
  private preflightPromise: Promise<void> | undefined;

  constructor(
    readonly path: string,
    private readonly rootDirectory = dirname(path),
    private readonly trustedDirectory = dirname(rootDirectory),
  ) {}

  /** Safe paths are established once; a later replacement disables this sink. */
  async preflight(): Promise<void> {
    this.preflightPromise ??= (async () => {
      await ensurePrivateDirectory(dirname(this.path), this.rootDirectory, this.trustedDirectory);
      await assertPrivateTarget(this.path, true);
    })();
    await this.preflightPromise;
  }

  write(record: LogRecord | LogEventInput): Promise<void> {
    if (this.disabled) return Promise.resolve();
    const operation = this.queue.then(async () => {
      if (this.disabled) return;
      try {
        await this.preflight();
        await ensurePrivateDirectory(dirname(this.path), this.rootDirectory, this.trustedDirectory);
        await assertPrivateTarget(this.path, true);
        const file = await open(
          this.path,
          constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
          0o600,
        );
        try {
          await file.writeFile(serializeLogRecord(createLogRecord(record)), "utf8");
          await file.sync();
        } finally {
          await file.close();
        }
      } catch {
        this.disabled = true;
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async close(): Promise<void> {
    await this.queue;
  }
}
