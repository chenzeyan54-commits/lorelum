import { appendFile } from "node:fs/promises";

export type SiteBuildSelection = Readonly<{
  siteBuild: "run" | "skip";
  reason:
    | "base-unavailable"
    | "core-package-only"
    | "empty-diff"
    | "invalid-event"
    | "invalid-name-status"
    | "non-pull-request"
    | "site-relevant-or-unknown";
}>;

export interface GitResult {
  readonly exitCode: number;
  readonly stdout: Uint8Array;
}

type GitRunner = (gitArguments: readonly string[], cwd: string) => GitResult;
type EventReader = (path: string) => Promise<string>;

interface SelectorOptions {
  readonly cwd?: string;
  readonly eventName?: string;
  readonly eventPath?: string;
  readonly readEvent?: EventReader;
  readonly runGit?: GitRunner;
}

const SHA = /^[0-9a-f]{40}$/i;

function runGit(gitArguments: readonly string[], cwd: string): GitResult {
  const result = Bun.spawnSync(["git", ...gitArguments], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return { exitCode: result.exitCode, stdout: result.stdout };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object";
}

export function pullRequestBaseSha(event: unknown): string | undefined {
  if (!isRecord(event) || !isRecord(event.pull_request) || !isRecord(event.pull_request.base))
    return undefined;

  const sha = event.pull_request.base.sha;
  return typeof sha === "string" && SHA.test(sha) ? sha : undefined;
}

export function selectSiteBuildFromNameStatus(output: Uint8Array): SiteBuildSelection {
  let fields: string[];
  try {
    fields = new TextDecoder("utf-8", { fatal: true }).decode(output).split("\0");
  } catch {
    return { siteBuild: "run", reason: "invalid-name-status" };
  }

  if (fields.pop() !== "") return { siteBuild: "run", reason: "invalid-name-status" };
  if (fields.length === 0) return { siteBuild: "run", reason: "empty-diff" };

  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (status !== "A" && status !== "M")
      return { siteBuild: "run", reason: "site-relevant-or-unknown" };

    const path = fields[index++];
    if (path === undefined || !path.startsWith("packages/") || path.startsWith("packages/ui/"))
      return { siteBuild: "run", reason: "site-relevant-or-unknown" };
  }

  return { siteBuild: "skip", reason: "core-package-only" };
}

async function readEventFile(path: string): Promise<string> {
  return Bun.file(path).text();
}

function diffFromBase(baseSha: string, runner: GitRunner, cwd: string): GitResult | undefined {
  const gitArguments = ["diff", "--name-status", "-z", baseSha, "HEAD"] as const;
  const initial = runner(gitArguments, cwd);
  if (initial.exitCode === 0) return initial;

  const fetched = runner(["fetch", "--no-tags", "--depth=1", "origin", baseSha], cwd);
  if (fetched.exitCode !== 0) return undefined;

  const retry = runner(gitArguments, cwd);
  return retry.exitCode === 0 ? retry : undefined;
}

export async function selectSiteBuild(options: SelectorOptions = {}): Promise<SiteBuildSelection> {
  const eventName = options.eventName ?? process.env.GITHUB_EVENT_NAME;
  if (eventName !== "pull_request") return { siteBuild: "run", reason: "non-pull-request" };

  const eventPath = options.eventPath ?? process.env.GITHUB_EVENT_PATH;
  if (eventPath === undefined || eventPath === "")
    return { siteBuild: "run", reason: "invalid-event" };

  try {
    const event = JSON.parse(await (options.readEvent ?? readEventFile)(eventPath)) as unknown;
    const baseSha = pullRequestBaseSha(event);
    if (baseSha === undefined) return { siteBuild: "run", reason: "invalid-event" };

    const diff = diffFromBase(baseSha, options.runGit ?? runGit, options.cwd ?? process.cwd());
    return diff === undefined
      ? { siteBuild: "run", reason: "base-unavailable" }
      : selectSiteBuildFromNameStatus(diff.stdout);
  } catch {
    return { siteBuild: "run", reason: "invalid-event" };
  }
}

async function publishSelection(selection: SiteBuildSelection): Promise<void> {
  const output = process.env.GITHUB_OUTPUT;
  if (output !== undefined && output !== "") {
    await appendFile(
      output,
      `site_build=${selection.siteBuild}\nsite_build_reason=${selection.reason}\n`,
    );
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary !== undefined && summary !== "") {
    await appendFile(
      summary,
      `| Site build selector (report only) | ${selection.siteBuild} | ${selection.reason} |\n`,
    );
  }

  console.log(`site build selector: ${selection.siteBuild} (${selection.reason})`);
}

if (import.meta.main) await publishSelection(await selectSiteBuild());
