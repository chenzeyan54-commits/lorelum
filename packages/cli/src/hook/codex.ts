import {
  createListService,
  defaultStorageRoot,
  type ListPackDetailsResult,
  type ListService,
  type StorageRoot,
} from "@lorelum/engine";

import type { OutputWriter } from "../output/protocol.js";
import { resolveInvocationStorageRoot } from "../store/storage-root.js";
import { renderPackCatalog } from "./pack-catalog.js";

export type CodexHookEvent = "SessionStart";

export interface CodexHookInput {
  readonly hook_event_name?: string;
}

export interface CodexHookResponse {
  readonly hookSpecificOutput?: {
    readonly hookEventName: CodexHookEvent;
    readonly additionalContext: string;
  };
  readonly continue?: boolean;
}

export interface TextInput {
  text(): Promise<string>;
}

export interface CodexHookServices {
  readonly list: Pick<ListService, "listPackDetails">;
  readonly storageRoot: StorageRoot;
}

export interface RunCodexHookOptions {
  readonly stdin: TextInput;
  readonly stdout: OutputWriter;
  readonly stderr: OutputWriter;
  readonly services?: CodexHookServices;
  readonly storeRoot?: string;
}

export interface CodexHookInvocation {
  readonly storeRoot?: string;
}

const defaultServices: CodexHookServices = Object.freeze({
  list: createListService(),
  storageRoot: defaultStorageRoot(),
});

/** Detect the raw Codex Hook ABI and consume its only supported global option. */
export function parseCodexHookInvocation(
  arguments_: readonly string[],
): CodexHookInvocation | undefined {
  const positionals: string[] = [];
  let storeRoot: string | undefined;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === "--store-root") {
      const value = arguments_[index + 1];
      if (storeRoot !== undefined || typeof value !== "string" || value.length === 0) {
        return undefined;
      }
      storeRoot = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--store-root=")) {
      const value = argument.slice("--store-root=".length);
      if (storeRoot !== undefined || value.length === 0) return undefined;
      storeRoot = value;
      continue;
    }
    positionals.push(argument);
  }

  return positionals.length === 2 && positionals[0] === "hook" && positionals[1] === "codex"
    ? { ...(storeRoot === undefined ? {} : { storeRoot }) }
    : undefined;
}

/**
 * Execute the versioned raw Codex Hook ABI. It deliberately does not emit the
 * normal Lorelum CLI envelope: Codex consumes this envelope directly.
 */
export async function runCodexHook(options: RunCodexHookOptions): Promise<0> {
  try {
    const input = parseHookInput(await options.stdin.text());
    const response = await createCodexHookResponse(
      input,
      options.services ?? defaultServices,
      options.storeRoot,
    );
    options.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    options.stderr.write(`lore hook codex degraded: ${diagnosticMessage(error)}\n`);
    options.stdout.write('{"continue":true}\n');
  }
  return 0;
}

export async function createCodexHookResponse(
  input: CodexHookInput,
  services: CodexHookServices = defaultServices,
  storeRoot?: string,
): Promise<CodexHookResponse> {
  if (input.hook_event_name !== "SessionStart") {
    throw new Error("Lorelum Codex Hook received an unsupported event.");
  }
  const storageRoot = resolveInvocationStorageRoot(storeRoot, services.storageRoot);
  const details = await services.list.listPackDetails({ storageRoot });
  return buildCodexHookResponse(input.hook_event_name, details);
}

export function buildCodexHookResponse(
  eventName: CodexHookEvent,
  details: ListPackDetailsResult,
): CodexHookResponse {
  return {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: renderPackCatalog(
        details.packs.map((pack) => ({
          name: pack.name,
          version: pack.version,
          ...(pack.description === undefined ? {} : { description: pack.description }),
          appliesTo: pack.applies_to ?? [],
        })),
      ),
    },
  };
}

function parseHookInput(serialized: string): CodexHookInput {
  const parsed: unknown = JSON.parse(serialized);
  if (!isRecord(parsed)) throw new Error("Lorelum Codex Hook input must be a JSON object.");
  return parsed;
}

function diagnosticMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
