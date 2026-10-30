import { describe, expect, it } from 'vitest';

import { createProxyRoute } from './factories';
import { DIALECTS } from '../../../tests/support/databases';
import { useTestWorkspaces } from '../../../tests/support/workspaces';

import type { Dialect } from '../../../tests/support/databases';

describe.each(DIALECTS)('proxy route factories on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  it('createProxyRoute creates the proxy service and upstream listener when not given', async () => {
    const { repos } = workspaces.a;

    const route = await createProxyRoute(repos);

    expect(await repos.services.get(route.proxyServiceId)).toMatchObject({ kind: 'reverse-proxy' });
    const upstream = await repos.listeners.get(route.upstreamListenerId);
    expect(upstream?.serviceId).not.toBe(route.proxyServiceId);
  });
});
