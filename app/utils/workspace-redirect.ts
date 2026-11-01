/** Where `/`, `/graph` or `/trace` lead: the same view of a workspace, or null without any. */
export function workspaceRedirect<Q>(
  view: 'graph' | 'trace',
  query: Q,
  slugs: readonly string[],
  remembered: string | undefined,
): { path: string; query: Q } | null {
  const slug = remembered && slugs.includes(remembered) ? remembered : slugs[0];
  return slug === undefined ? null : { path: `/w/${slug}/${view}`, query };
}
