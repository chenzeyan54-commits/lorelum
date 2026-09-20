import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const templatesDirectory = fileURLToPath(
  new URL("../../../../.github/ISSUE_TEMPLATE/", import.meta.url),
);

async function form(name: string): Promise<{ labels?: unknown; body?: unknown }> {
  return Bun.YAML.parse(await Bun.file(`${templatesDirectory}${name}`).text()) as {
    labels?: unknown;
    body?: unknown;
  };
}

test("public feedback forms are valid YAML and preserve reviewed-disclosure boundaries", async () => {
  const bug = await form("bug_report.yml");
  const feature = await form("feature_request.yml");
  const field = await form("field_feedback.yml");

  expect(bug.labels).toEqual(["bug"]);
  expect(feature.labels).toEqual(["enhancement"]);
  expect(field.labels).toBeUndefined();

  for (const candidate of [bug, feature, field]) {
    expect(Array.isArray(candidate.body)).toBe(true);
    const ids = (candidate.body as Array<{ id?: string }>).flatMap((item) =>
      item.id === undefined ? [] : [item.id],
    );
    expect(ids).toContain("disclosure-review");
  }
  const featureText = await Bun.file(`${templatesDirectory}feature_request.yml`).text();
  expect(featureText).not.toContain("MCP server");
  expect(featureText).not.toContain("needs-triage");
});
