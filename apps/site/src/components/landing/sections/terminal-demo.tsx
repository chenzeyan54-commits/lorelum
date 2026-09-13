import { useEffect, useRef, useState } from "react";
import { getStrings, type LandingStrings } from "@/shared/i18n/legacy-translations";

/**
 * A readable query/get demonstration. The guidance is condensed for the
 * presentation, not a transcript of the CLI's machine-readable response.
 * Typing and line reveal pause while the demo is offscreen.
 */
const TYPE_SPEED = 26;
const LINE_DELAY = 340;
const COMMAND_PAUSE = 520;
const REPLAY_DELAY = 2000;

interface TranscriptLine {
  readonly key: string;
  readonly text: string;
  readonly tone: "title" | "text" | "dim";
}

interface DemoCommand {
  readonly command: string;
  readonly lines: readonly TranscriptLine[];
}

const PRACTICE_ID = "agentic-coding.verification.bind-evidence-to-artifact-state";

function buildCommands(t: LandingStrings): readonly DemoCommand[] {
  return [
    {
      command: `lore query "${t.demoQuery}"`,
      lines: [
        { key: "q-label", text: t.demoMatchLabel, tone: "dim" },
        { key: "q-title", text: t.getTitle, tone: "title" },
        { key: "q-id", text: PRACTICE_ID, tone: "dim" },
        { key: "q-applies", text: t.appliesWhen, tone: "text" },
        { key: "q-next", text: t.demoReadNext, tone: "dim" },
      ],
    },
    {
      command: `lore get ${PRACTICE_ID}`,
      lines: [
        { key: "g-title", text: t.getTitle, tone: "title" },
        { key: "g-label", text: t.demoGuidanceLabel, tone: "dim" },
        ...t.demoGuidance.map((text, i) => ({
          key: `g-step-${i}`,
          text: `${i + 1}. ${text}`,
          tone: "text" as const,
        })),
      ],
    },
  ];
}

export function TerminalDemo({ locale = "en" }: { locale?: string }) {
  const t = getStrings(locale);
  const commands = buildCommands(t);

  // phase: 'typing' | 'output' | 'paused'
  const [phase, setPhase] = useState<"typing" | "output" | "paused">("typing");
  const [commandIndex, setCommandIndex] = useState(0);
  /** Number of output lines of the current command currently visible. */
  const [lineCount, setLineCount] = useState(0);
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const commandRef = useRef<HTMLSpanElement>(null);

  // Pause the whole demo when it scrolls out of view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.05,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const current = commands[commandIndex]!;

  // Phase 1: type the command into the DOM directly — no React renders here.
  useEffect(() => {
    if (!visible || phase !== "typing") return;
    const el = commandRef.current;
    if (!el) return;
    let count = 0;
    let timer = 0;
    const tick = () => {
      count = Math.min(count + 2, current.command.length);
      el.textContent = current.command.slice(0, count);
      if (count >= current.command.length) {
        timer = window.setTimeout(() => setPhase("output"), COMMAND_PAUSE);
      } else {
        timer = window.setTimeout(tick, TYPE_SPEED);
      }
    };
    timer = window.setTimeout(tick, TYPE_SPEED);
    return () => window.clearTimeout(timer);
  }, [visible, phase, current]);

  // Phase 2: reveal output lines one at a time.
  useEffect(() => {
    if (!visible || phase !== "output") return;
    if (lineCount < current.lines.length) {
      const id = window.setTimeout(() => setLineCount((c) => c + 1), LINE_DELAY);
      return () => window.clearTimeout(id);
    }
    const isLastCommand = commandIndex === commands.length - 1;
    const id = window.setTimeout(
      () => {
        if (isLastCommand) {
          setPhase("paused");
        } else {
          setCommandIndex((i) => i + 1);
          setLineCount(0);
          if (commandRef.current) commandRef.current.textContent = "";
          setPhase("typing");
        }
      },
      isLastCommand ? REPLAY_DELAY : LINE_DELAY,
    );
    return () => window.clearTimeout(id);
  }, [visible, phase, lineCount, current, commandIndex, commands.length]);

  // Phase 3: reset everything and replay.
  useEffect(() => {
    if (!visible || phase !== "paused") return;
    setCommandIndex(0);
    setLineCount(0);
    if (commandRef.current) commandRef.current.textContent = "";
    setPhase("typing");
  }, [visible, phase]);

  // Completed commands stay rendered while the next one types.
  const doneCommands = commands.slice(0, commandIndex);
  const showCursor = phase === "typing";
  const currentLines = phase !== "typing" ? current.lines.slice(0, lineCount) : [];

  const renderLine = (line: TranscriptLine) => (
    <div
      key={line.key}
      className={`whitespace-pre-wrap break-words ${line.tone === "title" ? "font-medium text-emerald-300" : line.tone === "dim" ? "text-zinc-400" : "text-zinc-200"}`}
    >
      {line.text}
    </div>
  );

  return (
    <div ref={rootRef} className="w-full text-left">
      <div className="overflow-hidden rounded-lg border border-fd-border bg-[#1e1e22] shadow-md">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 border-b border-fd-border bg-[#1e1e22] px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-xs text-zinc-400">{t.terminalWindowTitle}</span>
          <span className="ml-auto rounded bg-zinc-700/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
            lore
          </span>
        </div>

        {/*
          A stable viewport keeps the page from moving as lines appear.
          Narrow screens can scroll the transcript when wrapped text needs room.
        */}
        <div className="h-[32rem] overflow-y-auto bg-[#141417] px-5 py-4 font-mono text-xs leading-6 text-zinc-200 sm:text-[13px]">
          {doneCommands.map((cmd) => (
            <div key={cmd.command} className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-zinc-400">$</span>
                <span className="break-all text-zinc-100">{cmd.command}</span>
              </div>
              {cmd.lines.map(renderLine)}
            </div>
          ))}

          {/* Current command: typed live, then its lines stream in */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-zinc-400">$</span>
              <span ref={commandRef} className="break-all text-zinc-100" />
              {showCursor && (
                <span className="inline-block h-4 w-2 shrink-0 animate-pulse bg-run align-middle" />
              )}
            </div>
            {currentLines.map(renderLine)}
          </div>
        </div>
      </div>
    </div>
  );
}
