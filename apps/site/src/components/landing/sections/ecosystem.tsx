import { LogoLoop, type LogoItem } from "@/vendor/react-bits";
import { getStrings } from "@/shared/i18n/legacy-translations";
import { Reveal } from "../motion/reveal";
import { SectionHeading } from "./section-heading";

/**
 * Official agent marks, vendored as monochrome SVGs from Lobe Icons. They use
 * one vector format and one visual treatment; see /public/logos/agents/NOTICE.md.
 * Codex also has an official Lorelum Plugin, while every entry can use the
 * portable CLI and Skill path.
 */
const AGENT_WORKFLOWS: Array<{
  name: string;
  src: string;
  href?: string;
}> = [
  { name: "Claude Code", src: "/logos/agents/claude.svg" },
  {
    name: "Codex",
    src: "/logos/agents/codex.svg",
    href: "https://openai.com/codex/",
  },
  { name: "Cursor", src: "/logos/agents/cursor.svg" },
  { name: "OpenCode", src: "/logos/agents/opencode.svg" },
  { name: "Cline", src: "/logos/agents/cline.svg" },
  { name: "Roo Code", src: "/logos/agents/roocode.svg" },
  { name: "Windsurf", src: "/logos/agents/windsurf.svg" },
  { name: "GitHub Copilot", src: "/logos/agents/githubcopilot.svg" },
];

export function Ecosystem({ lang }: { lang: string }) {
  const t = getStrings(lang);

  const logos: LogoItem[] = AGENT_WORKFLOWS.map(({ name, src, href }) => ({
    node: (
      <span className="flex w-32 flex-col items-center gap-2.5">
        <img
          src={src}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="size-12 object-contain"
        />
        <span className="font-mono text-sm text-fd-muted-foreground">{name}</span>
      </span>
    ),
    title: name,
    ariaLabel: name,
    ...(href && { href }),
  }));

  return (
    <section
      id="ecosystem"
      className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-24 sm:py-32"
    >
      <SectionHeading
        eyebrow={t.ecosystemEyebrow}
        title={t.ecosystemHeading}
        sub={t.ecosystemSub}
      />
      <Reveal className="mt-14">
        <LogoLoop
          className="logo-wall"
          logos={logos}
          speed={24}
          gap={40}
          pauseOnHover
          fadeOut
          fadeOutColor="var(--color-fd-background)"
          ariaLabel={t.ecosystemHeading}
        />
      </Reveal>
    </section>
  );
}
