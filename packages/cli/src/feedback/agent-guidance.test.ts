import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const skills = [
  "plugins/codex/lorelum/skills/lorelum/SKILL.md",
  "plugins/zcode/lorelum/skills/lorelum/SKILL.md",
  "skills/lorelum/SKILL.md",
].map((path) => `${repositoryRoot}${path}`);

test("host guidance defers feedback and requires explicit user consent before local drafting", async () => {
  await Promise.all(
    skills.map(async (path) => {
      const content = await Bun.file(path).text();
      expect(content).toContain("diagnostics.traceId");
      expect(content).toContain(
        "lore feedback draft --trace-id <traceId> --kind <bug|improvement>",
      );
      expect(content).toContain("explicitly agrees");
      expect(content).toContain("do not create a draft");
      expect(content).toContain("never create feedback artifacts");
    }),
  );
});
