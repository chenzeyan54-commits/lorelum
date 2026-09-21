import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const skills = [
  {
    path: "skills/lorelum/SKILL.md",
    catalogRule: "## Establish the Pack Catalog once",
  },
  {
    path: "plugins/codex/lorelum/skills/lorelum/SKILL.md",
    catalogRule: "Codex receives a compact **Installed Pack Catalog**",
  },
  {
    path: "plugins/zcode/lorelum/skills/lorelum/SKILL.md",
    catalogRule: "ZCode receives a compact **Installed Pack Catalog**",
  },
  {
    path: "plugins/cursor/lorelum/skills/lorelum/SKILL.md",
    catalogRule: "Cursor may receive a compact **Installed Pack Catalog**",
  },
  {
    path: "plugins/workbuddy/lorelum/skills/lorelum/SKILL.md",
    catalogRule: "WorkBuddy receives a compact **Installed Pack Catalog**",
  },
] as const;

test("Skill guidance bounds diagnostics to the current trace and requires consent for local drafting", async () => {
  await Promise.all(
    skills.map(async ({ path, catalogRule }) => {
      const content = await Bun.file(`${repositoryRoot}${path}`).text();
      expect(content).toContain(catalogRule);
      expect(content).toContain("diagnostics.traceId");
      expect(content).toContain("lore logs --trace-id <traceId>");
      expect(content).toContain("missingEvidence");
      expect(content).toContain("Do not scan another trace");
      expect(content).toContain("Do not preflight Backend, model, index, or status");
      expect(content).toContain("new invocation, not evidence from the original failure");
      expect(content).toContain(
        "lore feedback draft --trace-id <traceId> --kind <bug|improvement>",
      );
      expect(content).toContain("explicitly agrees");
      expect(content).toContain("do not create a draft");
      expect(content).toContain("never create feedback artifacts");
    }),
  );
});
