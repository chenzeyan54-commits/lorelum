/** Resolve authored links from the content file, including the docs index page. */
export function resolveContentLink(href: string, path: string, lang: string): string {
  if (!href || href.startsWith("#") || href.startsWith("/") || /^[a-z][a-z\d+.-]*:/i.test(href))
    return href;
  const sourcePath = path.replace(/\.(?:en|zh)\.mdx?$/, ".mdx");
  const resolved = new URL(href, `https://docs.invalid/${lang}/docs/${sourcePath}`);
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
