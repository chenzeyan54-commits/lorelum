import type { Database } from "bun:sqlite";

import { createSqliteConnection } from "../../../persistence/database/connection";
import { localStoreDatabaseDefinition } from "../../../persistence/definitions";
import type { LocalStoreDatabase } from "../../../persistence/schemas/database-types";

/** Build the same typed ORM session that LocalStore lifecycle code receives. */
export function testLocalStoreDatabase(database: Database): LocalStoreDatabase {
  return createSqliteConnection(database, localStoreDatabaseDefinition.schema).orm;
}
