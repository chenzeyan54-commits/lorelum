import { LanguageToggle } from "@/shared/ui/language-toggle";
import { ThemeToggle } from "@/shared/ui/theme-toggle";

/** Keep the docs locale and theme controls in the same utility row. */
export function DocsNavControls({ locale }: { locale: string }) {
  return (
    <div className="docs-nav-controls">
      <LanguageToggle lang={locale} />
      <ThemeToggle lang={locale} />
    </div>
  );
}
