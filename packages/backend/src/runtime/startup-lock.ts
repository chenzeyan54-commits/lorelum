import { sqliteExclusiveLock } from "./coordination/sqlite-exclusive-lock";

/** SQLite's OS-backed writer lock is released on crash; no stale PID lock reclamation. */
export async function withStartupLock<T>(
  directory: string,
  timeoutMs: number,
  run: () => Promise<T>,
): Promise<T> {
  return sqliteExclusiveLock.withLock(directory, timeoutMs, run);
}
