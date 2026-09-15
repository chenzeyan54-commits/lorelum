import type { ValidationIssue } from "./report";

/** Pack-root directories that may contain on-demand resources. */
export const PACK_RESOURCE_ROOTS = ["references", "assets", "scripts"] as const;

export type PackResourceRoot = (typeof PACK_RESOURCE_ROOTS)[number];

/** A resource link found in a Practice Markdown body. */
export interface ResourceLink {
  /** The Pack-root-relative path after the `resource:` scheme. */
  readonly path: string;
  /** The complete target as written in the Markdown link. */
  readonly target: string;
  /** One-based source line containing the link. */
  readonly line: number;
  /** One-based source column at the opening `[` of the link. */
  readonly column: number;
}

export interface ResourcePathResult {
  readonly valid: true;
  readonly path: string;
  readonly root: PackResourceRoot;
}

export interface InvalidResourcePathResult {
  readonly valid: false;
  readonly reason: string;
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

/**
 * Validate the path portion of a `resource:` target without touching the
 * filesystem. The returned path is intentionally not normalized: traversal
 * and platform-specific spellings must be rejected rather than rewritten.
 */
export function validateResourcePath(path: string): ResourcePathResult | InvalidResourcePathResult {
  if (path.length === 0) return { valid: false, reason: "path is empty" };
  if (path.startsWith("/") || path.startsWith("\\")) {
    return { valid: false, reason: "path must be Pack-root-relative" };
  }
  if (hasControlCharacter(path)) {
    return { valid: false, reason: "path contains a control character" };
  }
  if (path.includes("\\")) return { valid: false, reason: "backslashes are not allowed" };
  if (path.includes("?") || path.includes("#")) {
    return { valid: false, reason: "query and fragment components are not allowed" };
  }

  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    return { valid: false, reason: "path contains an empty segment" };
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return { valid: false, reason: "parent and current-directory segments are not allowed" };
  }
  if (segments.some((segment) => /[:*<>|"]/u.test(segment))) {
    return { valid: false, reason: "platform-specific path segments are not allowed" };
  }
  if (segments.some((segment) => /[ .]$/u.test(segment))) {
    return { valid: false, reason: "path segments may not end with a space or dot" };
  }
  if (
    segments.some((segment) =>
      /^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(segment),
    )
  ) {
    return { valid: false, reason: "reserved platform path segments are not allowed" };
  }

  const root = PACK_RESOURCE_ROOTS.find((candidate) => path.startsWith(`${candidate}/`));
  if (root === undefined) {
    return {
      valid: false,
      reason: "path must start with references/, assets/, or scripts/",
    };
  }
  if (segments.length < 2) return { valid: false, reason: "path must name a file" };
  return { valid: true, path, root };
}

interface LinkMatch {
  readonly offset: number;
  readonly target: string;
}

function lineAndColumn(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    if (source.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

function maskRange(chars: string[], start: number, end: number): void {
  for (let i = start; i < end; i++) {
    if (chars[i] !== "\n") chars[i] = " ";
  }
}

/**
 * Mask fenced code blocks and inline code while retaining offsets/newlines.
 * This deliberately handles Markdown's common backtick/tilde forms without
 * trying to become a full Markdown parser.
 */
function maskCode(source: string): string {
  // split("") preserves UTF-16 offsets used by RegExp#matchAll and
  // String#indexOf; spreading by code point would shift locations after an
  // astral character (for example an emoji in a Practice heading).
  const chars = source.split("");
  const lines = source.split("\n");
  let offset = 0;
  let fence: { marker: "`" | "~"; length: number; start: number } | undefined;

  for (const line of lines) {
    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence === undefined && opening !== null) {
      fence = { marker: opening[1]![0] as "`" | "~", length: opening[1]!.length, start: offset };
      maskRange(chars, offset, offset + line.length);
    } else if (fence === undefined && /^(?: {4}|\t)/u.test(line)) {
      // CommonMark's indented code block form. A resource-looking link in
      // such a line is code, not an instruction to load a Pack file.
      maskRange(chars, offset, offset + line.length);
    } else if (fence !== undefined) {
      const closing = new RegExp(`^ {0,3}${fence.marker}{${fence.length},}\\s*$`).test(line);
      maskRange(chars, offset, offset + line.length);
      if (closing) fence = undefined;
    }
    offset += line.length + 1;
  }

  // Inline code is processed after fenced blocks have been masked. Runs of
  // three or more backticks are fence syntax and are intentionally skipped.
  for (let i = 0; i < chars.length;) {
    if (chars[i] !== "`" || chars[i - 1] === "\\") {
      i += 1;
      continue;
    }
    let length = 1;
    while (chars[i + length] === "`") length += 1;
    if (length >= 3) {
      i += length;
      continue;
    }
    const delimiter = "`".repeat(length);
    const closing = source.indexOf(delimiter, i + length);
    if (closing === -1) {
      i += length;
      continue;
    }
    maskRange(chars, i, closing + length);
    i = closing + length;
  }
  return chars.join("");
}

function markdownLinkMatches(source: string): LinkMatch[] {
  const masked = maskCode(source);
  const matches: LinkMatch[] = [];
  // Link labels intentionally stay single-line. Resource links are authored
  // as ordinary inline Markdown links; rejecting multiline labels avoids
  // accidentally interpreting arbitrary prose as a target.
  const pattern = /\[[^\]\n]*\]\(\s*(?:<([^>\n]*)>|([^\s)\n]+))/g;
  for (const match of masked.matchAll(pattern)) {
    const target = match[1] ?? match[2];
    if (target === undefined || !target.startsWith("resource:")) continue;
    matches.push({ offset: match.index ?? 0, target });
  }
  return matches;
}

/** Parse real Markdown link targets using the `resource:` scheme. */
export function parseResourceLinks(markdown: string): ResourceLink[] {
  return markdownLinkMatches(markdown).map(({ offset, target }) => {
    const location = lineAndColumn(markdown, offset);
    return {
      path: target.slice("resource:".length),
      target,
      ...location,
    };
  });
}

/**
 * Validate resource links and, when supplied, check that each target exists
 * in the Pack's already-scanned regular-file set. This helper is pure and
 * never reads, executes, or otherwise interprets resource contents.
 */
export function validateResourceLinks(
  markdown: string,
  options: {
    readonly sourcePath?: string;
    readonly availablePaths?: ReadonlySet<string>;
  } = {},
): ValidationIssue[] {
  const sourcePath = options.sourcePath ?? "(body)";
  return parseResourceLinks(markdown).flatMap((link) => {
    const location = `${sourcePath}:${link.line}:${link.column}`;
    const pathResult = validateResourcePath(link.path);
    if (!pathResult.valid) {
      return [
        {
          level: "error" as const,
          code: "resource-target-invalid",
          path: location,
          message: `invalid resource target "${link.target}": ${pathResult.reason}`,
        },
      ];
    }
    if (options.availablePaths !== undefined && !options.availablePaths.has(pathResult.path)) {
      return [
        {
          level: "error" as const,
          code: "resource-target-missing",
          path: location,
          message: `resource target "${link.path}" does not exist in the Pack`,
        },
      ];
    }
    return [];
  });
}
