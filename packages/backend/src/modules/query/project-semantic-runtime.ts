import { createHash, randomUUID } from "node:crypto";

import {
  createProjectSemanticServices,
  InvalidProjectRootError,
  ProjectSemanticProgressService,
  projectSemanticArtifactId,
  projectSemanticIndexPaths,
  resolveProjectContext,
  withProjectArtifactLease,
  type EmbeddingPort,
  type EmbeddingProfile,
  type LocalStore,
  type QueryRequest,
  type SemanticQueryResult,
  type StorageRoot,
} from "@lorelum/engine";

import { EmbeddingError } from "../embedding/errors";
import type { ModelPreparation, ModelStatus } from "../embedding/dto";
import { ProjectOperationJournal, type ProjectOperationRecord } from "./project-operation-journal";

export interface ProjectSemanticRequest {
  readonly projectRoot: string;
  readonly cacheRoot: string;
}

export interface ProjectSemanticIndexingResult {
  readonly state: "indexing";
  readonly operationId: string;
  readonly indexedPracticeCount: number;
  readonly totalPracticeCount: number;
}

export interface ProjectSemanticPartialResult extends SemanticQueryResult {
  readonly indexedPracticeCount: number;
  readonly totalPracticeCount: number;
  readonly operationId: string;
}

export type ProjectSemanticQueryResult =
  | SemanticQueryResult
  | ProjectSemanticPartialResult
  | ProjectSemanticIndexingResult;

export interface ProjectSemanticRuntimePort {
  query(
    root: StorageRoot,
    request: ProjectSemanticRequest,
    query: QueryRequest,
    policy: { readonly maxWaitMs: number; readonly minCoveragePercent: number },
  ): Promise<ProjectSemanticQueryResult>;
  waitForIdle(deadline?: number): Promise<void>;
}

interface ProjectOperation {
  readonly operationId: string;
  readonly artifactId: string;
  readonly projectSlotId: string;
  readonly task: Promise<void>;
}

export interface ProjectSemanticModelPreparation {
  beginModelPreparation(): ModelPreparation;
  waitModelPreparation(preparationId: string): Promise<ModelStatus>;
}

/**
 * Backend-owned operation manager for content-addressed project artifacts.
 * Source locations live only in the closure of an accepted task. Its durable
 * progress file contains target digests and vectors, never a project path.
 */
export class ProjectSemanticRuntime implements ProjectSemanticRuntimePort {
  private readonly operations = new Map<string, ProjectOperation>();
  private readonly desiredArtifactBySlot = new Map<string, string>();
  private queue: Promise<void> = Promise.resolve();
  private readonly recovered: Promise<readonly ProjectOperationRecord[]>;

  constructor(
    private readonly store: Pick<LocalStore, "readEffectivePracticeSnapshot">,
    private readonly profile: EmbeddingProfile,
    private readonly documentEmbedding: EmbeddingPort,
    private readonly queryEmbedding: EmbeddingPort,
    private readonly modelPreparation: ProjectSemanticModelPreparation,
    private readonly journal?: ProjectOperationJournal,
  ) {
    this.recovered = journal?.recover() ?? Promise.resolve([]);
  }

  private static hash(parts: readonly string[]): string {
    const hasher = createHash("sha256");
    for (const part of parts) {
      hasher.update(part, "utf8");
      hasher.update("\0", "utf8");
    }
    return hasher.digest("hex");
  }

  private projectSlotId(snapshot: Awaited<ReturnType<ProjectSemanticRuntime["snapshot"]>>): string {
    return ProjectSemanticRuntime.hash([
      "project-context-slot/v1",
      snapshot.projectRootId,
      this.profile.profileId,
    ]);
  }

  private async record(
    input: Omit<ProjectOperationRecord, "updatedAt">,
  ): Promise<ProjectOperationRecord> {
    const record: ProjectOperationRecord = Object.freeze({
      ...input,
      updatedAt: new Date().toISOString(),
    });
    await this.journal?.upsert(record);
    return record;
  }

  private async snapshot(root: StorageRoot, request: ProjectSemanticRequest) {
    const snapshot = await resolveProjectContext({
      store: this.store,
      storageRoot: root,
      projectRoot: request.projectRoot,
    });
    if (snapshot === undefined) throw new InvalidProjectRootError();
    return snapshot;
  }

  private async start(
    snapshot: Awaited<ReturnType<ProjectSemanticRuntime["snapshot"]>>,
    cacheRoot: string,
  ): Promise<ProjectOperation> {
    const artifactId = projectSemanticArtifactId(snapshot, this.profile.profileId);
    const existing = this.operations.get(artifactId);
    if (existing !== undefined) return existing;
    await this.recovered;
    const projectSlotId = this.projectSlotId(snapshot);
    this.desiredArtifactBySlot.set(projectSlotId, artifactId);
    const previous = await this.journal?.latestForSlot(projectSlotId);
    const recovered = await this.journal?.findByArtifact(artifactId);
    const operationId = recovered?.operationId ?? randomUUID();
    const createdAt = recovered?.createdAt ?? new Date().toISOString();
    const attempts = recovered?.attempts ?? 0;
    if (
      previous !== undefined &&
      previous.artifactId !== artifactId &&
      (previous.state === "queued" ||
        previous.state === "building" ||
        previous.state === "waiting-for-source")
    ) {
      await this.record({
        ...previous,
        state: "superseded",
      });
    }
    await this.record({
      operationId,
      projectRootId: snapshot.projectRootId,
      projectSlotId,
      artifactId,
      corpusDigest: snapshot.indexCorpusDigest,
      profileId: this.profile.profileId,
      state: "queued",
      indexedPracticeCount: recovered?.indexedPracticeCount ?? 0,
      totalPracticeCount: snapshot.practices.length,
      attempts,
      createdAt,
    });
    const desired = () => this.desiredArtifactBySlot.get(projectSlotId) === artifactId;
    const run = async (): Promise<"ready" | "superseded"> => {
      if (!desired()) return "superseded";
      const progress = new ProjectSemanticProgressService(
        snapshot,
        cacheRoot,
        this.profile,
        this.documentEmbedding,
        desired,
      );
      try {
        await this.record({
          operationId,
          projectRootId: snapshot.projectRootId,
          projectSlotId,
          artifactId,
          corpusDigest: snapshot.indexCorpusDigest,
          profileId: this.profile.profileId,
          state: "building",
          indexedPracticeCount: (await progress.status()).indexedPracticeCount,
          totalPracticeCount: snapshot.practices.length,
          attempts: attempts + 1,
          createdAt,
        });
        const result = await progress.build();
        if (!desired() || result.state !== "ready") return "superseded";
      } catch (error) {
        if (!(error instanceof EmbeddingError) || error.code !== "embedding.not-loaded")
          throw error;
        const preparation = this.modelPreparation.beginModelPreparation();
        await this.modelPreparation.waitModelPreparation(preparation.preparationId);
        const result = await progress.build();
        if (!desired() || result.state !== "ready") return "superseded";
      }
      return "ready";
    };
    // Serialize distinct document targets because the fixed embedding runtime has one native slot.
    const task = this.queue
      .catch(() => undefined)
      .then(run)
      .then(async (outcome) => {
        const status = await new ProjectSemanticProgressService(
          snapshot,
          cacheRoot,
          this.profile,
          this.documentEmbedding,
        ).status();
        await this.record({
          operationId,
          projectRootId: snapshot.projectRootId,
          projectSlotId,
          artifactId,
          corpusDigest: snapshot.indexCorpusDigest,
          profileId: this.profile.profileId,
          state: outcome === "ready" ? "ready" : "superseded",
          indexedPracticeCount: status.indexedPracticeCount,
          totalPracticeCount: snapshot.practices.length,
          attempts: attempts + 1,
          createdAt,
        });
      })
      .catch(async (error: unknown) => {
        const status = await new ProjectSemanticProgressService(
          snapshot,
          cacheRoot,
          this.profile,
          this.documentEmbedding,
        )
          .status()
          .catch(() => ({ indexedPracticeCount: 0 }));
        await this.record({
          operationId,
          projectRootId: snapshot.projectRootId,
          projectSlotId,
          artifactId,
          corpusDigest: snapshot.indexCorpusDigest,
          profileId: this.profile.profileId,
          state: "failed",
          indexedPracticeCount: status.indexedPracticeCount,
          totalPracticeCount: snapshot.practices.length,
          attempts: attempts + 1,
          createdAt,
        });
        throw error;
      });
    this.queue = task.catch(() => undefined);
    const operation = Object.freeze({ operationId, artifactId, projectSlotId, task });
    this.operations.set(artifactId, operation);
    void task.finally(() => {
      // Ready artifacts are discoverable by digest; retaining the operation only while it runs
      // prevents stale daemon state from becoming a durable source of truth.
      if (this.operations.get(artifactId) === operation) this.operations.delete(artifactId);
      if (this.desiredArtifactBySlot.get(projectSlotId) === artifactId) {
        this.desiredArtifactBySlot.delete(projectSlotId);
      }
    });
    return operation;
  }

  async query(
    root: StorageRoot,
    request: ProjectSemanticRequest,
    query: QueryRequest,
    policy: { readonly maxWaitMs: number; readonly minCoveragePercent: number },
  ): Promise<ProjectSemanticQueryResult> {
    const snapshot = await this.snapshot(root, request);
    const progress = new ProjectSemanticProgressService(
      snapshot,
      request.cacheRoot,
      this.profile,
      this.documentEmbedding,
    );
    const status = await progress.status();
    if (status.state === "ready") {
      const paths = projectSemanticIndexPaths(request.cacheRoot, snapshot, this.profile.profileId);
      return withProjectArtifactLease(paths.directory, async () => {
        const services = createProjectSemanticServices(
          snapshot,
          request.cacheRoot,
          this.profile,
          this.queryEmbedding,
        );
        return services.query.query(services.root, query);
      });
    }
    const operation = await this.start(snapshot, request.cacheRoot);
    if (policy.maxWaitMs > 0) {
      await Promise.race([operation.task.catch(() => undefined), Bun.sleep(policy.maxWaitMs)]);
      const afterWait = await progress.status();
      if (afterWait.state === "ready") {
        const paths = projectSemanticIndexPaths(
          request.cacheRoot,
          snapshot,
          this.profile.profileId,
        );
        return withProjectArtifactLease(paths.directory, async () => {
          const services = createProjectSemanticServices(
            snapshot,
            request.cacheRoot,
            this.profile,
            this.queryEmbedding,
          );
          return services.query.query(services.root, query);
        });
      }
    }
    const partial = await progress.queryPartial(query).catch((error: unknown) => {
      if (error instanceof EmbeddingError && error.code === "embedding.not-loaded")
        return undefined;
      throw error;
    });
    if (
      partial !== undefined &&
      partial.indexedPracticeCount * 100 >= partial.totalPracticeCount * policy.minCoveragePercent
    ) {
      return Object.freeze({
        ...partial.result,
        indexedPracticeCount: partial.indexedPracticeCount,
        totalPracticeCount: partial.totalPracticeCount,
        operationId: operation.operationId,
      });
    }
    const current = await progress.status();
    return Object.freeze({
      state: "indexing",
      operationId: operation.operationId,
      indexedPracticeCount: current.indexedPracticeCount,
      totalPracticeCount: current.totalPracticeCount,
    });
  }

  async waitForIdle(deadline?: number): Promise<void> {
    const task = this.queue;
    if (deadline === undefined) return task;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    await Promise.race([task, Bun.sleep(remaining)]);
  }
}
