import { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";

import { createSqliteConnection } from "../../../persistence/database/connection";
import { migrateSqlite } from "../../../persistence/database/migrator";
import { semanticIndexDatabaseDefinition } from "../../../persistence/definitions";
import { semanticIndexMetadata } from "../../../persistence/schemas/semantic-index";
import { SemanticIndexError } from "../errors";
import type { SemanticDocument } from "../projection";
import type { SemanticIndexMetadata } from "./metadata";

const INSERT_VECTOR = `
  INSERT INTO semantic_vectors (practice_id, content_digest, projection_digest, vector)
  VALUES (?, ?, ?, ?)
`;

interface MetadataRow extends Record<string, unknown> {
  readonly indexVersion: number;
  readonly rootBinding: string;
  readonly generation: number;
  readonly effectiveRevision: number;
  readonly manifestDigest: string;
  readonly profileId: string;
  readonly encodingId: string;
  readonly dimensions: number;
  readonly documentProjectionVersion: number;
  readonly normalization: string;
  readonly vectorCount: number;
}

export interface SemanticIndexVector {
  readonly contentDigest: string;
  readonly projectionDigest: string;
  readonly vector: Float32Array;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function metadataFromRow(row: unknown): SemanticIndexMetadata {
  if (typeof row !== "object" || row === null) {
    throw new SemanticIndexError("Semantic index metadata is missing");
  }
  const value = row as Partial<MetadataRow>;
  if (
    !positiveInteger(value.indexVersion) ||
    typeof value.rootBinding !== "string" ||
    !positiveInteger(value.generation) ||
    !positiveInteger(value.effectiveRevision) ||
    typeof value.manifestDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.profileId ?? "") ||
    !/^[a-f0-9]{64}$/.test(value.encodingId ?? "") ||
    !positiveInteger(value.dimensions) ||
    value.dimensions === 0 ||
    !positiveInteger(value.documentProjectionVersion) ||
    value.documentProjectionVersion === 0 ||
    value.normalization !== "l2" ||
    !positiveInteger(value.vectorCount)
  ) {
    throw new SemanticIndexError("Semantic index metadata is invalid");
  }
  return Object.freeze({
    indexVersion: value.indexVersion,
    rootBinding: value.rootBinding,
    generation: value.generation,
    effectiveRevision: value.effectiveRevision,
    manifestDigest: value.manifestDigest,
    profileId: value.profileId!,
    encodingId: value.encodingId!,
    dimensions: value.dimensions,
    documentProjectionVersion: value.documentProjectionVersion,
    normalization: value.normalization,
    vectorCount: value.vectorCount,
  });
}

function vectorBlob(vector: Float32Array): Uint8Array {
  return new Uint8Array(
    vector.buffer.slice(vector.byteOffset, vector.byteOffset + vector.byteLength),
  );
}

function validateVectorBlob(value: unknown, dimensions: number): void {
  if (
    !(value instanceof Uint8Array) ||
    value.byteLength !== dimensions * Float32Array.BYTES_PER_ELEMENT
  ) {
    throw new SemanticIndexError("Semantic index vector blob is invalid");
  }
  const copy = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  const vector = new Float32Array(copy);
  let squaredLength = 0;
  for (const item of vector) {
    if (!Number.isFinite(item)) throw new SemanticIndexError("Semantic index vector is not finite");
    squaredLength += item * item;
  }
  if (Math.abs(Math.sqrt(squaredLength) - 1) >= 0.001) {
    throw new SemanticIndexError("Semantic index vector is not L2-normalized");
  }
}

function vectorFromBlob(value: unknown, dimensions: number): Float32Array {
  validateVectorBlob(value, dimensions);
  const bytes = value as Uint8Array;
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Float32Array(copy);
}

function connectionFor(database: Database) {
  return createSqliteConnection(database, semanticIndexDatabaseDefinition.schema);
}

function metadataRow(database: Database): MetadataRow | undefined {
  return connectionFor(database)
    .orm.select({
      indexVersion: semanticIndexMetadata.indexVersion,
      rootBinding: semanticIndexMetadata.rootBinding,
      generation: semanticIndexMetadata.generation,
      effectiveRevision: semanticIndexMetadata.effectiveRevision,
      manifestDigest: semanticIndexMetadata.manifestDigest,
      profileId: semanticIndexMetadata.profileId,
      encodingId: semanticIndexMetadata.encodingId,
      dimensions: semanticIndexMetadata.dimensions,
      documentProjectionVersion: semanticIndexMetadata.documentProjectionVersion,
      normalization: semanticIndexMetadata.normalization,
      vectorCount: semanticIndexMetadata.vectorCount,
    })
    .from(semanticIndexMetadata)
    .where(eq(semanticIndexMetadata.singleton, 1))
    .get();
}

function insertMetadata(database: Database, metadata: SemanticIndexMetadata): void {
  connectionFor(database)
    .orm.insert(semanticIndexMetadata)
    .values({ singleton: 1, ...metadata })
    .run();
}

function updateMetadata(database: Database, metadata: SemanticIndexMetadata): void {
  connectionFor(database)
    .orm.update(semanticIndexMetadata)
    .set(metadata)
    .where(eq(semanticIndexMetadata.singleton, 1))
    .run();
  if (metadataRow(database) === undefined) {
    throw new SemanticIndexError("Semantic index metadata is missing");
  }
}

function finalMetadata(
  metadata: SemanticIndexMetadata,
  vectorCount: number,
): SemanticIndexMetadata {
  if (!Number.isSafeInteger(vectorCount) || vectorCount < 0) {
    throw new SemanticIndexError("Semantic index vector count is invalid");
  }
  return Object.freeze({
    ...metadata,
    vectorCount,
  });
}

export function initializeSemanticIndex(
  database: Database,
  metadata: SemanticIndexMetadata,
  documents: readonly SemanticDocument[],
  vectors: readonly Float32Array[],
): void {
  if (documents.length !== vectors.length || metadata.vectorCount !== documents.length) {
    throw new SemanticIndexError("Semantic index document and vector counts differ");
  }
  try {
    migrateSqlite(connectionFor(database), semanticIndexDatabaseDefinition);
    connectionFor(database).orm.transaction(() => {
      insertMetadata(database, metadata);
      const insert = database.query(INSERT_VECTOR);
      for (let index = 0; index < documents.length; index += 1) {
        const document = documents[index]!;
        const vector = vectors[index]!;
        validateVectorBlob(vectorBlob(vector), metadata.dimensions);
        insert.run(
          document.practiceId,
          document.contentDigest,
          document.projectionDigest,
          vectorBlob(vector),
        );
      }
    });
  } catch (error) {
    if (error instanceof SemanticIndexError) throw error;
    throw new SemanticIndexError("Cannot initialize semantic SQLite index", { cause: error });
  }
}

/** Read one validated vector for incremental reuse. */
export function readSemanticIndexVector(
  database: Database,
  practiceId: string,
  dimensions: number,
): SemanticIndexVector | undefined {
  try {
    const row = database
      .query(
        "SELECT content_digest, projection_digest, vector FROM semantic_vectors WHERE practice_id = ?",
      )
      .get(practiceId) as Record<string, unknown> | null | undefined;
    if (row === null || row === undefined) return undefined;
    if (
      typeof row.content_digest !== "string" ||
      !/^[a-f0-9]{64}$/.test(row.content_digest) ||
      typeof row.projection_digest !== "string" ||
      !/^[a-f0-9]{64}$/.test(row.projection_digest)
    ) {
      throw new SemanticIndexError("Semantic index vector row is invalid");
    }
    return Object.freeze({
      contentDigest: row.content_digest,
      projectionDigest: row.projection_digest,
      vector: vectorFromBlob(row.vector, dimensions),
    });
  } catch (error) {
    if (error instanceof SemanticIndexError) throw error;
    throw new SemanticIndexError("Cannot read semantic index vector", { cause: error });
  }
}

/** Replace the final rows touched by a retained Store revision sequence. */
export function applySemanticIndexChanges(
  database: Database,
  target: SemanticIndexMetadata,
  removedPracticeIds: readonly string[],
  documents: readonly SemanticDocument[],
  vectors: readonly Float32Array[],
): SemanticIndexMetadata {
  if (documents.length !== vectors.length) {
    throw new SemanticIndexError("Semantic index document and vector counts differ");
  }
  const removed = [...new Set(removedPracticeIds)].sort();
  let written: SemanticIndexMetadata | undefined;
  try {
    database.transaction(() => {
      if (removed.length > 0) {
        database
          .query(
            `DELETE FROM semantic_vectors WHERE practice_id IN (${removed.map(() => "?").join(", ")})`,
          )
          .run(...removed);
      }
      const insert = database.query(INSERT_VECTOR);
      for (let index = 0; index < documents.length; index += 1) {
        const document = documents[index]!;
        const vector = vectors[index]!;
        validateVectorBlob(vectorBlob(vector), target.dimensions);
        insert.run(
          document.practiceId,
          document.contentDigest,
          document.projectionDigest,
          vectorBlob(vector),
        );
      }
      const count = database
        .query("SELECT COUNT(*) AS count FROM semantic_vectors")
        .get() as unknown;
      if (
        typeof count !== "object" ||
        count === null ||
        !("count" in count) ||
        !positiveInteger(count.count)
      ) {
        throw new SemanticIndexError("Semantic index vector count is inconsistent");
      }
      written = finalMetadata(target, count.count);
      updateMetadata(database, written);
    })();
    if (written === undefined)
      throw new SemanticIndexError("Semantic index metadata was not updated");
    return written;
  } catch (error) {
    if (error instanceof SemanticIndexError) throw error;
    throw new SemanticIndexError("Cannot update semantic SQLite index", { cause: error });
  }
}

export function readSemanticIndexMetadata(database: Database): SemanticIndexMetadata {
  try {
    const metadata = metadataFromRow(metadataRow(database));
    const count = database.query("SELECT COUNT(*) AS count FROM semantic_vectors").get() as unknown;
    if (
      typeof count !== "object" ||
      count === null ||
      !("count" in count) ||
      !positiveInteger(count.count) ||
      count.count !== metadata.vectorCount
    ) {
      throw new SemanticIndexError("Semantic index vector count is inconsistent");
    }
    const vectors = database.query("SELECT vector FROM semantic_vectors").all() as unknown[];
    for (const row of vectors) {
      if (typeof row !== "object" || row === null || !("vector" in row)) {
        throw new SemanticIndexError("Semantic index vector row is invalid");
      }
      validateVectorBlob(row.vector, metadata.dimensions);
    }
    return metadata;
  } catch (error) {
    if (error instanceof SemanticIndexError) throw error;
    throw new SemanticIndexError("Cannot read semantic SQLite index metadata", { cause: error });
  }
}

export function verifySemanticIndexIntegrity(database: Database): void {
  try {
    const rows = database.query("PRAGMA integrity_check").all() as unknown[];
    if (
      rows.length !== 1 ||
      typeof rows[0] !== "object" ||
      rows[0] === null ||
      !("integrity_check" in rows[0]) ||
      rows[0].integrity_check !== "ok"
    ) {
      throw new SemanticIndexError("Semantic SQLite index integrity check failed");
    }
  } catch (error) {
    if (error instanceof SemanticIndexError) throw error;
    throw new SemanticIndexError("Cannot verify semantic SQLite index", { cause: error });
  }
}
