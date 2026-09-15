import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PackValidationError } from "../../model";
import { decodePackDirectory } from "../../index";
import { decodeSnapshot } from "./snapshot-codec";

async function withSnapshot(run: (path: string) => Promise<void>): Promise<void> {
  const path = await mkdtemp(join(tmpdir(), "lorelum-snapshot-"));
  try {
    await mkdir(join(path, "practices"));
    await writeFile(join(path, "pack.yaml"), "name: platform\nversion: 1.0.0\n");
    await writeFile(
      join(path, "practices", "api.md"),
      "---\nid: platform.api\ntitle: API\nstage: api\ntech_stack: [typescript]\napplies_when: always\n---\nUse APIs.\n",
    );
    await run(path);
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

test("SnapshotCodec injects Markdown body and normalizes source paths", async () => {
  await withSnapshot(async (path) => {
    const decoded = await decodeSnapshot(path);
    expect(decoded.candidate.sources[0]?.sourcePath).toBe("practices/api.md");
    expect(decoded.candidate.sources[0]?.canonicalPractice.practice.body).toBe("Use APIs.\n");
  });
});

test("SnapshotCodec retains validated reference, asset, and script bytes", async () => {
  await withSnapshot(async (path) => {
    await mkdir(join(path, "references"), { recursive: true });
    await mkdir(join(path, "assets", "reports"), { recursive: true });
    await mkdir(join(path, "scripts", "check"), { recursive: true });
    await writeFile(join(path, "references", "api.md"), "API matrix\n", "utf8");
    await writeFile(join(path, "assets", "reports", "badge.bin"), Buffer.from([0, 255, 7]));
    await writeFile(join(path, "scripts", "check", "main.py"), "print('ok')\n", "utf8");
    await writeFile(join(path, "scripts", "check", "helpers.py"), "VALUE = 1\n", "utf8");
    await writeFile(
      join(path, "practices", "api.md"),
      "---\nid: platform.api\ntitle: API\nstage: api\ntech_stack: [typescript]\napplies_when: always\n---\nRead [the matrix](resource:references/api.md).\nUse [the checker](resource:scripts/check/main.py).\n",
    );

    const decoded = await decodeSnapshot(path);
    expect(decoded.candidate.resources.map((resource) => resource.sourcePath)).toEqual([
      "assets/reports/badge.bin",
      "references/api.md",
      "scripts/check/helpers.py",
      "scripts/check/main.py",
    ]);
    expect([
      ...decoded.candidate.resources.find(
        (resource) => resource.sourcePath === "assets/reports/badge.bin",
      )!.bytes,
    ]).toEqual([0, 255, 7]);
  });
});

test("SnapshotCodec rejects resource links whose target is absent", async () => {
  await withSnapshot(async (path) => {
    await writeFile(
      join(path, "practices", "api.md"),
      "---\nid: platform.api\ntitle: API\nstage: api\ntech_stack: [typescript]\napplies_when: always\n---\nRead [the matrix](resource:references/missing.md).\n",
    );
    await expect(decodeSnapshot(path)).rejects.toMatchObject({
      report: {
        valid: false,
        errors: [expect.objectContaining({ code: "resource-target-missing" })],
      },
    });
  });
});

test("SnapshotCodec rejects symbolic links inside resource directories", async () => {
  await withSnapshot(async (path) => {
    await mkdir(join(path, "references"));
    const outsidePath = join(path, "outside.md");
    await writeFile(outsidePath, "not part of the Pack\n");
    try {
      await symlink(outsidePath, join(path, "references", "outside.md"));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "EPERM")
        return;
      throw error;
    }
    await expect(decodeSnapshot(path)).rejects.toThrow("symbolic links are not allowed");
  });
});

test("SnapshotCodec rejects a decisions wrapper object", async () => {
  await withSnapshot(async (path) => {
    await writeFile(join(path, "decisions.yaml"), "decisions: []\n");
    expect(decodeSnapshot(path)).rejects.toThrow("top-level sequence");
  });
});

test("SnapshotCodec delegates duplicate Practice ids to the format validation gate", async () => {
  await withSnapshot(async (path) => {
    await writeFile(
      join(path, "practices", "duplicate.md"),
      "---\nid: platform.api\ntitle: Duplicate\nstage: api\ntech_stack: [typescript]\napplies_when: always\n---\nDuplicate.\n",
    );
    await expect(decodeSnapshot(path)).rejects.toBeInstanceOf(PackValidationError);
  });
});

test("SnapshotCodec rejects a symbolic pack manifest before parsing it", async () => {
  await withSnapshot(async (path) => {
    const manifestPath = join(path, "pack.yaml");
    const outsidePath = join(path, "outside-pack.yaml");
    await writeFile(outsidePath, "name: platform\nversion: 1.0.0\n");
    await rm(manifestPath);
    try {
      await symlink(outsidePath, manifestPath);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "EPERM")
        return;
      throw error;
    }

    await expect(decodeSnapshot(path)).rejects.toThrow("symbolic links are not allowed");
  });
});

test("public Pack directory decoder enforces Practice-count and byte budgets", async () => {
  await withSnapshot(async (path) => {
    await expect(
      decodePackDirectory(path, {
        maxPracticeFiles: 0,
        maxEntries: 2_048,
        maxDirectories: 256,
        maxDirectoryDepth: 32,
        maxFileBytes: 256 * 1024,
        maxTotalBytes: 16 * 1024 * 1024,
      }),
    ).rejects.toThrow("Practice file budget");

    await expect(
      decodePackDirectory(path, {
        maxPracticeFiles: 10,
        maxEntries: 2_048,
        maxDirectories: 256,
        maxDirectoryDepth: 32,
        maxFileBytes: 8,
        maxTotalBytes: 16 * 1024 * 1024,
      }),
    ).rejects.toThrow("per-file byte budget");

    await expect(
      decodePackDirectory(path, {
        maxPracticeFiles: 10,
        maxEntries: 0,
        maxDirectories: 256,
        maxDirectoryDepth: 32,
        maxFileBytes: 256 * 1024,
        maxTotalBytes: 16 * 1024 * 1024,
      }),
    ).rejects.toThrow("directory-entry budget");
  });
});
