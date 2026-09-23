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
import {
  inspectAndTightenDirectory,
  inspectAndTightenExistingFile,
  inspectAndTightenHandle,
  ManagedLogLocationError,
  type ManagedLogLocationFailure,
  type ManagedRepairFact,
} from "./safety.js";

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function relativeSegments(root: string, target: string): readonly string[] {
  const suffix = relative(root, target);
  if (suffix === "") return [];
  if (suffix === ".." || suffix.startsWith(`..${sep}`)) {
    throw new Error("Managed log directory escaped its root.");
  }
  return suffix.split(sep).filter(Boolean);
}

/** What a sink's managed location ended up doing, read after `close()`. */
export interface JsonlFileSinkOutcome {
  readonly status: "new" | "ready" | "unavailable" | "write-failed";
  readonly repairs: readonly ManagedRepairFact[];
  readonly failure?: ManagedLogLocationFailure;
}

/** A best-effort append-only JSONL sink for one process-owned segment file. */
export class JsonlFileSink implements LogSink {
  private disabled = false;
  private queue: Promise<void> = Promise.resolve();
  private preflightPromise: Promise<void> | undefined;
  private readonly repairs: ManagedRepairFact[] = [];
  private failure: ManagedLogLocationFailure | undefined;
  private status: JsonlFileSinkOutcome["status"] = "new";

  constructor(
    readonly path: string,
    private readonly rootDirectory = dirname(path),
    private readonly trustedDirectory = dirname(rootDirectory),
  ) {}

  get outcome(): JsonlFileSinkOutcome {
    return {
      status: this.status,
      repairs: this.repairs,
      ...(this.failure === undefined ? {} : { failure: this.failure }),
    };
  }

  /** Safe paths are established once; a later replacement disables this sink. */
  async preflight(): Promise<void> {
    this.preflightPromise ??= this.prepareLocation();
    await this.preflightPromise;
  }

  /**
   * Verifies (and where safely possible tightens) every existing segment from
   * the trusted directory down to the segment file, creating missing segments
   * with the intended private mode. Unsafe segments reject with a typed
   * ManagedLogLocationError instead of being touched.
   */
  private async prepareLocation(): Promise<void> {
    const trusted = resolve(this.trustedDirectory);
    const root = resolve(this.rootDirectory);
    const target = resolve(dirname(this.path));
    const rootSegments = relativeSegments(trusted, root);
    const targetSegments = relativeSegments(root, target);
    // A trusted path that exists in an odd shape (for example a symlink) must
    // reach the typed inspection below, not surface as a raw mkdir failure.
    await mkdir(trusted, { recursive: true, mode: 0o700 }).catch((error: unknown) => {
      if (!hasCode(error, "EEXIST") && !hasCode(error, "ENOTDIR") && !hasCode(error, "ELOOP")) {
        throw error;
      }
    });
    await this.ensureSegment(trusted);
    let current = trusted;
    for (const segment of [...rootSegments, ...targetSegments]) {
      current = join(current, segment);
      await this.ensureSegment(current);
    }
    const inspected = await inspectAndTightenExistingFile(this.path);
    if (inspected?.verdict.verdict === "unsafe") {
      throw new ManagedLogLocationError(inspected.verdict.reason, this.path);
    }
    if (inspected?.repair) this.repairs.push(inspected.repair);
  }

  private async ensureSegment(directory: string): Promise<void> {
    const existing = await inspectAndTightenDirectory(directory);
    if (existing === undefined) {
      let created = false;
      await mkdir(directory, { mode: 0o700 }).then(
        () => {
          created = true;
        },
        (error: unknown) => {
          if (!hasCode(error, "EEXIST")) throw error;
        },
      );
      // Only a directory this process created is forced back to the intended
      // mode; umask may have stripped owner bits at creation time.
      if (created) await chmod(directory, 0o700);
      const fresh = await inspectAndTightenDirectory(directory);
      if (fresh === undefined) throw new ManagedLogLocationError("wrong-type", directory);
      if (fresh.verdict.verdict === "unsafe") {
        throw new ManagedLogLocationError(fresh.verdict.reason, directory);
      }
      if (fresh.repair) this.repairs.push(fresh.repair);
      return;
    }
    if (existing.verdict.verdict === "unsafe") {
      throw new ManagedLogLocationError(existing.verdict.reason, directory);
    }
    if (existing.repair) this.repairs.push(existing.repair);
  }

  write(record: LogRecord | LogEventInput): Promise<void> {
    if (this.disabled) return Promise.resolve();
    const operation = this.queue.then(async () => {
      if (this.disabled) return;
      try {
        await this.preflight();
        // Re-verify on every write so a replaced managed directory cannot be
        // followed after a successful startup, matching the pre-repair checks.
        await this.prepareLocation();
        const existed = await lstat(this.path).then(
          () => true,
          (error: unknown) => {
            if (hasCode(error, "ENOENT")) return false;
            throw error;
          },
        );
        const file = await open(
          this.path,
          constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0),
          0o600,
        );
        try {
          // A segment this process created is forced to the intended mode
          // regardless of umask; an existing one is verified and tightened on
          // the same descriptor the record is written through.
          if (!existed) await file.chmod(0o600);
          const inspected = await inspectAndTightenHandle(file, this.path, "file");
          if (inspected.verdict.verdict === "unsafe") {
            throw new ManagedLogLocationError(inspected.verdict.reason, this.path);
          }
          if (inspected.repair) this.repairs.push(inspected.repair);
          await file.writeFile(serializeLogRecord(createLogRecord(record)), "utf8");
          await file.sync();
        } finally {
          await file.close();
        }
        this.status = "ready";
      } catch (error) {
        this.disabled = true;
        if (error instanceof ManagedLogLocationError) {
          this.failure = { kind: "location-unavailable", reason: error.reason, path: error.path };
          this.status = "unavailable";
        } else if (this.status === "ready") {
          this.failure = { kind: "write-failed", path: this.path, error: String(error) };
          this.status = "write-failed";
        } else {
          this.failure = { kind: "location-error", path: this.path, error: String(error) };
          this.status = "unavailable";
        }
      }
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async close(): Promise<void> {
    await this.queue;
  }
}
