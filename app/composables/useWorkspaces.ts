import type { MemberWorkspace } from '#shared/contracts/workspaces';

import { WORKSPACE_COOKIE } from '#shared/contracts/workspaces';

/** A year: the last workspace opened is remembered across visits. */
const REMEMBERED_FOR = 60 * 60 * 24 * 365;

/**
 * The signed-in user's workspaces, fetched on the client once and shared by every page under one key (null while
 * they load), and the slug of the last one opened, for `/`, `/graph` and `/trace`.
 */
export function useWorkspaces() {
  const { data, error, refresh } = useFetch<{ workspaces: MemberWorkspace[] }>('/api/workspaces', {
    key: 'workspaces',
    server: false,
  });
  const remembered = useCookie<string | undefined>(WORKSPACE_COOKIE, { maxAge: REMEMBERED_FOR, sameSite: 'lax' });
  const workspaces = computed(() => data.value?.workspaces ?? null);
  return { workspaces, error, refresh, remembered };
}
