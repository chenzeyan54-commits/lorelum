import { expect, test } from "bun:test";

import { localStoreDatabaseDefinition } from "../definitions";

import { openSqliteConnection } from "./connection";
import { migrateSqlite } from "./migrator";
import { createWriteSession } from "./session";

test("write sessions roll back an interrupted transaction", () => {
  const connection = openSqliteConnection(":memory:", localStoreDatabaseDefinition.schema);
  try {
    migrateSqlite(connection, localStoreDatabaseDefinition);
    const session = createWriteSession(connection);

    expect(() =>
      session.transaction(() => {
        connection.client
          .query(
            "INSERT INTO local_store_metadata (singleton, schema_version, installed_packs_generation, effective_revision) VALUES (1, 1, 0, 0)",
          )
          .run();
        throw new Error("rollback");
      }),
    ).toThrow("rollback");
    expect(
      connection.client.query("SELECT COUNT(*) AS count FROM local_store_metadata").get(),
    ).toEqual({ count: 0 });
  } finally {
    connection.close();
  }
});
