import { describe, expect, it, vi } from 'vitest';

import { readTraffic } from './traffic';
import { DIALECTS } from '../../tests/support/databases';
import { useTestWorkspaces } from '../../tests/support/workspaces';
import { seedDemoStack } from '../demo/demo-stack';

import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('readTraffic on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  it('reads each table once', async () => {
    await seedDemoStack(workspaces.a.repos);
    const { repos, workspace } = workspaces.a;
    const lists = (['hosts', 'services', 'listeners', 'flows'] as const)
      .map((key) => vi.spyOn(repos[key], 'list'));

    const traffic = await readTraffic({
      db: workspaces.db, repos, workspaceId: workspace.id,
    });

    expect(traffic.flows.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(list).toHaveBeenCalledOnce();
    }
  });
});
