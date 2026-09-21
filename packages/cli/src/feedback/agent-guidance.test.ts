import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const skills = [
  {
    path: "skills/lorelum/SKILL.md",
    recoveryReference: "skills/lorelum/references/semantic-query-recovery.md",
    catalogRule: "## Establish the Pack Catalog once",
  },
  {
    path: "plugins/codex/lorelum/skills/lorelum/SKILL.md",
    recoveryReference: "plugins/codex/lorelum/skills/lorelum/references/semantic-query-recovery.md",
    catalogRule: "Codex receives a compact **Installed Pack Catalog**",
  },
  {
    path: "plugins/zcode/lorelum/skills/lorelum/SKILL.md",
    recoveryReference: "plugins/zcode/lorelum/skills/lorelum/references/semantic-query-recovery.md",
    catalogRule: "ZCode receives a compact **Installed Pack Catalog**",
  },
  {
    path: "plugins/cursor/lorelum/skills/lorelum/SKILL.md",
    recoveryReference:
      "plugins/cursor/lorelum/skills/lorelum/references/semantic-query-recovery.md",
    catalogRule: "Cursor may receive a compact **Installed Pack Catalog**",
  },
  {
    path: "plugins/workbuddy/lorelum/skills/lorelum/SKILL.md",
    recoveryReference:
      "plugins/workbuddy/lorelum/skills/lorelum/references/semantic-query-recovery.md",
    catalogRule: "WorkBuddy receives a compact **Installed Pack Catalog**",
  },
] as const;

test("Skill dispatches bounded diagnostics to the shared recovery reference", async () => {
  await Promise.all(
    skills.map(async ({ path, recoveryReference, catalogRule }) => {
      const [content, recovery] = await Promise.all([
        Bun.file(`${repositoryRoot}${path}`).text(),
        Bun.file(`${repositoryRoot}${recoveryReference}`).text(),
      ]);
      expect(content).toContain(catalogRule);
      expect(content).toContain("diagnostics.traceId");
      expect(content).toContain("lore logs --trace-id <traceId>");
      expect(content).toContain("Do not scan another trace");
      expect(content).toContain("do not preflight Backend, model, index, or status");
      expect(content).toContain("no extra logs, draft, upload, or Issue");
      expect(content).toContain("[diagnostic recovery](references/semantic-query-recovery.md)");

      expect(recovery).toContain("missingEvidence");
      expect(recovery).toContain("Do not scan another trace");
      expect(recovery).toContain("Do not preflight Backend, model, index, or status");
      expect(recovery).toContain("new invocation, not evidence from the original failure");
      expect(recovery).toContain(
        "lore feedback draft --trace-id <traceId> --kind <bug|improvement>",
      );
      expect(recovery).toContain("long-running user task");
      expect(recovery).toContain("completion or another safe stopping point");
      expect(recovery).toContain("explicitly agrees to prepare a local draft");
      expect(recovery).toContain("do not create a draft");
      expect(recovery).toContain("never create feedback artifacts");
      expect(recovery).toContain(
        "complete retained same-trace `error`, `warn`, and `info` call chain",
      );
      expect(recovery).toContain("--include-logs info` is equivalent to the default");
      expect(recovery).toContain("debug-records-not-found");
      expect(recovery).toContain("separate explicit authorization");
      expect(recovery).toContain("credential-like or clearly sensitive content");
      expect(recovery).toContain("lore index build --json");
      expect(recovery).toContain("lore index operation <operation-id> --json");
    }),
  );
});
