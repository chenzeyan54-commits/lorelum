import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { LOCAL_STORE_SCHEMA_VERSION, migrateDatabase } from "./migrations";
import { readPractice } from "./practice-reader";
import { testLocalStoreDatabase } from "./test-utils";

test("point JOIN uses both existing indexes and one query even when absent", () => {
  const database = new Database(":memory:");
  try {
    migrateDatabase(database);
    const orm = testLocalStoreDatabase(database);
    const queries: string[] = [];
    const originalPrepare = database.prepare.bind(database);
    database.prepare = ((sql: string) => {
      queries.push(sql);
      return originalPrepare(sql);
    }) as typeof database.prepare;
    expect(
      readPractice(
        orm,
        {
          schemaVersion: LOCAL_STORE_SCHEMA_VERSION,
          generation: 0,
          effectiveRevision: 0,
        },
        "example.absent",
      ),
    ).toBeUndefined();
    expect(queries).toHaveLength(1);
    const plan = database.query(`EXPLAIN QUERY PLAN ${queries[0]}`).all("example.absent");
    const details = plan.map((row) => String((row as { detail: unknown }).detail));
    expect(details.some((detail) => /SEARCH effective_practices USING INDEX/.test(detail))).toBe(
      true,
    );
    expect(
      details.some((detail) =>
        /SEARCH practice_sources USING INDEX practice_sources_by_practice/.test(detail),
      ),
    ).toBe(true);
    expect(
      details.some((detail) => /SCAN (effective_practices|practice_sources)\b/.test(detail)),
    ).toBe(false);
  } finally {
    database.close();
  }
});
