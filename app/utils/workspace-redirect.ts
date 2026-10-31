/** Where `/`, `/graph` or `/trace` lead: the same view of a workspace, or null without any. */
export function workspaceRedirect(
  _view: 'graph' | 'trace',
  _query: Record<string, unknown>,
  _slugs: readonly string[],
  _remembered: string | undefined,
): { path: string; query: Record<string, unknown> } | null {
  return null;
}
