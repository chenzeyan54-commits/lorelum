import type { OutputWriter } from "../output/protocol.js";
import type { Logger } from "@lorelum/log";
import {
  buildCursorHookResponse,
  createHostHookResponse,
  parseHostHookInvocation,
  runHostHook,
  type CursorHookResponse,
  type HostHookInput,
  type HostHookInvocation,
  type HostHookServices,
  type TextInput,
} from "./host-hook.js";

export type CursorHookInput = HostHookInput;
export type CursorHookServices = HostHookServices;
export type CursorHookInvocation = HostHookInvocation;
export type { CursorHookEvent, CursorHookResponse } from "./host-hook.js";
export type { TextInput } from "./host-hook.js";

export interface RunCursorHookOptions {
  readonly stdin: TextInput;
  readonly stdout: OutputWriter;
  readonly stderr: OutputWriter;
  readonly services?: CursorHookServices;
  readonly storeRoot?: string;
  readonly log?: Logger;
}

/** Detect the raw Cursor Hook ABI and consume its only supported global option. */
export function parseCursorHookInvocation(
  arguments_: readonly string[],
): CursorHookInvocation | undefined {
  return parseHostHookInvocation(arguments_, "cursor");
}

/**
 * Execute the versioned raw Cursor Hook ABI. It deliberately does not emit the
 * normal Lorelum CLI envelope: Cursor consumes this envelope directly.
 */
export async function runCursorHook(options: RunCursorHookOptions): Promise<0> {
  return runHostHook({ ...options, host: "cursor" });
}

export async function createCursorHookResponse(
  input: CursorHookInput,
  services?: CursorHookServices,
  storeRoot?: string,
): Promise<CursorHookResponse> {
  return createHostHookResponse(input, "cursor", services, storeRoot);
}

export { buildCursorHookResponse };
