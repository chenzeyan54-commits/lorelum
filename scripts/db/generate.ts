import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "../..");
const configs = [
  "packages/engine/drizzle.local-store.config.ts",
  "packages/engine/drizzle.keyword-index.config.ts",
  "packages/engine/drizzle.semantic-index.config.ts",
] as const;

for (const config of configs) {
  const process = Bun.spawn(["bunx", "drizzle-kit", "generate", "--config", config], {
    cwd: repositoryRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await process.exited;
  if (exitCode !== 0) process.exit(exitCode);
}
