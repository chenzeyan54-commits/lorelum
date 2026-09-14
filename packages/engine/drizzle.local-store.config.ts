import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./packages/engine/src/persistence/schemas/local-store.ts",
  out: "./packages/engine/src/persistence/migrations/local-store",
});
