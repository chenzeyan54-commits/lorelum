import { access, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { Database } from "bun:sqlite";

import { rebuildEffectivePracticesFromManifest } from "../artifacts/rebuild";
import { tryReadManifest } from "../manifest/manifest-store";
import { acquireMutationLock } from "../mutation-lock";
import { SqliteStateError, StoreRecoveryRequiredError } from "../errors";

import { sqlitePath } from "./database";
import { migrateDatabase } from "./migrations";
import { readLocalStoreSnapshot } from "./snapshot-reader";
import { writeDerivedState } from "./state-writer";

const DRIZZLE_MIGRATIONS_TABLE = "__drizzle_migrations";

function hasTable(database: Database, name: string): boolean {
  const row = database
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return row !== null && row !== undefined;
}

async function hasStoreDatabase(rootPath: string): Promise<boolean> {
  try {
    await access(sqlitePath(rootPath));
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/** A manual LocalStore schema is legacy only when it has no Drizzle history. */
async function isLegacyStore(rootPath: string): Promise<boolean> {
  if (!(await hasStoreDatabase(rootPath))) return false;
  let database: Database | undefined;
  try {
    database = new Database(sqlitePath(rootPath), { readonly: true });
    if (hasTable(database, DRIZZLE_MIGRATIONS_TABLE)) return false;
    return hasTable(database, "local_store_metadata");
  } catch (error) {
    throw new SqliteStateError("cannot inspect existing LocalStore database", error);
  } finally {
    database?.close();
  }
}

async function discardLegacyDerivedState(rootPath: string): Promise<void> {
  await Promise.all([
    rm(join(rootPath, "operations"), { recursive: true, force: true }),
    rm(join(rootPath, "indexes", "keyword"), { recursive: true, force: true }),
    rm(join(rootPath, "indexes", "semantic"), { recursive: true, force: true }),
  ]);
}

async function publishRebuiltDatabase(rootPath: string): Promise<void> {
  const path = sqlitePath(rootPath);
  const stagingPath = `${path}.next-${crypto.randomUUID()}`;
  let database: Database | undefined;
  try {
    const manifest = await tryReadManifest(rootPath);
    if (manifest === undefined) {
      throw new StoreRecoveryRequiredError(
        "Legacy LocalStore has no manifest from which to rebuild its SQLite projection",
      );
    }
    const effectivePractices = await rebuildEffectivePracticesFromManifest(rootPath, manifest);

    database = new Database(stagingPath);
    migrateDatabase(database);
    writeDerivedState(database, {
      generation: manifest.generation,
      effectiveRevision: manifest.effectiveRevision,
      activePacks: manifest.packs,
      effectivePractices,
    });
    const snapshot = readLocalStoreSnapshot(database);
    if (
      snapshot === undefined ||
      snapshot.metadata.generation !== manifest.generation ||
      snapshot.metadata.effectiveRevision !== manifest.effectiveRevision
    ) {
      throw new StoreRecoveryRequiredError(
        "Legacy LocalStore rebuild did not produce a valid snapshot",
      );
    }
    database.close();
    database = undefined;

    await discardLegacyDerivedState(rootPath);
    await Promise.all([rm(`${path}-wal`, { force: true }), rm(`${path}-shm`, { force: true })]);
    await rename(stagingPath, path);
  } catch (error) {
    if (error instanceof StoreRecoveryRequiredError) throw error;
    throw new StoreRecoveryRequiredError(
      "Legacy LocalStore cannot be rebuilt from its manifest and Pack artifacts",
    );
  } finally {
    database?.close();
    await rm(stagingPath, { force: true }).catch(() => undefined);
  }
}

/** Reset a legacy manual SQLite projection while the Store mutation lock is already held. */
export async function resetLegacyStoreUnderLock(rootPath: string): Promise<boolean> {
  if (!(await isLegacyStore(rootPath))) return false;
  await publishRebuiltDatabase(rootPath);
  return true;
}

/** Ensure ordinary readers reset a legacy Store before any journal recovery attempts. */
export async function ensureCurrentStoreBaseline(rootPath: string): Promise<boolean> {
  await mkdir(rootPath, { recursive: true });
  if (!(await isLegacyStore(rootPath))) return false;
  const lock = await acquireMutationLock(rootPath);
  try {
    return await resetLegacyStoreUnderLock(rootPath);
  } finally {
    await lock.release();
  }
}
