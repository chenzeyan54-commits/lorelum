/* eslint-disable no-await-in-loop -- Observe a single shared model task within one caller budget. */
import type { BackendClient, BackendRequestOptions } from "../client/client";
import { BackendError } from "../protocol/errors";
import type { ModelPreparation } from "../modules/embedding/dto";

export type RuntimeProgress =
  | "backend: starting"
  | "index: building"
  | "model: waiting"
  | "model: downloading"
  | "model: verifying"
  | "model: starting";
export interface RuntimeWaitOptions extends BackendRequestOptions {
  readonly onProgress?: (progress: RuntimeProgress) => void;
}
/** Owns verified connection and caller observation; daemon owns model preparation lifetime. */
export function createBackendRuntimeCoordinator(options: {
  readonly connect: () => Promise<BackendClient>;
  readonly start: () => Promise<unknown>;
}) {
  async function waitForCaller<T>(task: Promise<T>, wait: RuntimeWaitOptions): Promise<T> {
    const remaining = wait.deadline === undefined ? undefined : wait.deadline - Date.now();
    if (remaining !== undefined && remaining < 1)
      throw new BackendError("backend.deadline-exceeded");
    if (!wait.signal && remaining === undefined) return task;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    try {
      return await Promise.race([
        task,
        new Promise<never>((_resolve, reject) => {
          timer =
            remaining === undefined
              ? undefined
              : setTimeout(() => reject(new BackendError("backend.deadline-exceeded")), remaining);
          abort = () => reject(wait.signal?.reason);
          wait.signal?.addEventListener("abort", abort, { once: true });
          if (wait.signal?.aborted) abort();
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (abort) wait.signal?.removeEventListener("abort", abort);
    }
  }
  async function connect(wait: RuntimeWaitOptions = {}) {
    wait.signal?.throwIfAborted();
    try {
      const client = await waitForCaller(options.connect(), wait);
      await client.identity(wait);
      return client;
    } catch (error) {
      if (!(error instanceof BackendError) || error.code !== "backend.unavailable") throw error;
    }
    wait.onProgress?.("backend: starting");
    const starting = options.start();
    await waitForCaller(starting, wait);
    wait.signal?.throwIfAborted();
    const client = await waitForCaller(options.connect(), wait);
    await client.identity(wait);
    return client;
  }
  async function beginModelPreparation(client: BackendClient, wait: RuntimeWaitOptions = {}) {
    wait.onProgress?.("model: waiting");
    return client.beginModelPreparation(wait);
  }
  async function observeModelPreparation(
    client: BackendClient,
    initial: ModelPreparation,
    wait: RuntimeWaitOptions = {},
    observationMs = 1_000,
  ): Promise<ModelPreparation> {
    if (!Number.isFinite(observationMs) || observationMs < 0)
      throw new TypeError("Observation budget must be nonnegative");
    const deadline = Math.min(wait.deadline ?? Infinity, Date.now() + observationMs);
    let current = initial;
    while (current.status.state === "loading" && Date.now() < deadline) {
      wait.signal?.throwIfAborted();
      const phase = current.status.progress?.phase;
      if (phase === "downloading" || phase === "verifying" || phase === "starting")
        wait.onProgress?.(`model: ${phase}`);
      await waitForCaller(Bun.sleep(Math.min(100, deadline - Date.now())), { signal: wait.signal });
      if (Date.now() >= deadline) break;
      try {
        current = await client.modelPreparation(current.preparationId, {
          signal: wait.signal,
          deadline,
        });
      } catch (error) {
        if (
          error instanceof BackendError &&
          error.code === "backend.deadline-exceeded" &&
          Date.now() >= deadline
        )
          break;
        throw error;
      }
    }
    return current;
  }
  return { connect, beginModelPreparation, observeModelPreparation };
}
export type BackendRuntimeCoordinator = ReturnType<typeof createBackendRuntimeCoordinator>;
