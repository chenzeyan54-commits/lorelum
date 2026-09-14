/** Cross-process exclusive coordination for one Backend runtime directory. */
export interface ExclusiveLock {
  withLock<T>(directory: string, timeoutMs: number, run: () => Promise<T>): Promise<T>;
}
