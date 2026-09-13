import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BrandLockup } from "@/shared/ui/brand-lockup";
import { gitConfig } from "@/shared/config/git";
import { i18n } from "@/shared/i18n/config";
import { DocsNavControls } from "./docs-nav-controls";

interface BaseOptions {
  /**
   * Show the Fumadocs search trigger in the nav. Marketing landing pages
   * keep the nav clean and hide it; docs pages keep it enabled.
   */
  withSearch?: boolean;
}

/**
 * Shared layout options for both the home and docs layouts.
 *
 * `locale` drives the Fumadocs UI language (via the root provider) and the
 * nav language switcher; it is read from the route params on every page.
 */
export function baseOptions(
  locale: string = i18n.defaultLanguage,
  opts: BaseOptions = {},
): BaseLayoutProps {
  const { withSearch = true } = opts;
  const homeUrl = locale === i18n.defaultLanguage ? "/" : `/${locale}`;

  return {
    i18n: false,
    searchToggle: withSearch ? undefined : { enabled: false },
    nav: {
      title: <BrandLockup />,
      url: homeUrl,
    },
    themeSwitch: {
      component: <DocsNavControls locale={locale} />,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
