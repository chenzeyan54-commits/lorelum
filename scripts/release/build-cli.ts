import { join, resolve } from "node:path";

import { compileCli } from "./compile-cli";

const repositoryRoot = resolve(import.meta.dir, "../..");

/** Build the current platform CLI with the same readable-stack contract as releases. */
export async function buildCli(): Promise<string> {
  const compiled = await compileCli({ outfile: join(repositoryRoot, "dist", "lore") });
  return compiled.output;
}

if (import.meta.main) console.log(await buildCli());
