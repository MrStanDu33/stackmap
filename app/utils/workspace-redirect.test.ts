import { describe, expect, it } from 'vitest';

import { workspaceRedirect } from './workspace-redirect';

describe('workspaceRedirect', () => {
  it('sends /, /graph and /trace to /w/<slug>/… with the same query (19)', () => {
    expect(workspaceRedirect('graph', { view: 'list' }, ['demo'], undefined))
      .toEqual({ path: '/w/demo/graph', query: { view: 'list' } });
    expect(workspaceRedirect('trace', { hostname: 'app.homelab.example', client: 'internet' }, ['demo'], undefined))
      .toEqual({ path: '/w/demo/trace', query: { hostname: 'app.homelab.example', client: 'internet' } });
  });

  it('uses the remembered slug when the user can still open it, else their first workspace by name (19)', () => {
    expect(workspaceRedirect('graph', {}, ['demo', 'homelab'], 'homelab')?.path).toBe('/w/homelab/graph');
    expect(workspaceRedirect('graph', {}, ['demo', 'homelab'], 'gone')?.path).toBe('/w/demo/graph');
    expect(workspaceRedirect('graph', {}, ['demo', 'homelab'], undefined)?.path).toBe('/w/demo/graph');
  });

  it('gives nothing without any workspace, so the page shows its empty state (20)', () => {
    expect(workspaceRedirect('graph', {}, [], 'demo')).toBeNull();
  });
});
