import { describe, expect, it } from 'vitest';

import { DEMO_STACK, seedDemoStack } from './demo-stack';
import { DIALECTS } from '../../tests/support/databases';
import { BUILTIN_KINDS, countRows, SCOPED_TABLES, useTestWorkspaces } from '../../tests/support/workspaces';
import { listDerivedFlows } from '../repositories/derived-flows';

import type { Dialect } from '../../tests/support/databases';

describe.each(DIALECTS)('demo stack seed on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  it('seeds the demo stack into a fresh workspace and returns the created entities by reference', async () => {
    const seeded = await seedDemoStack(workspaces.a.repos);

    for (const group of ['sites', 'networks', 'hosts', 'services', 'listeners', 'domains', 'dnsRecords', 'proxyRoutes'] as const) {
      expect(Object.keys(seeded[group]), group).toEqual(Object.keys(DEMO_STACK[group]));
      expect(await workspaces.a.repos[group].list(), group).toHaveLength(Object.keys(DEMO_STACK[group]).length);
    }
    expect(seeded.services.npm).toMatchObject({ name: 'Nginx Proxy Manager', workspaceId: workspaces.a.workspace.id });
  });

  it('resolves every reference to the created entity', async () => {
    const seeded = await seedDemoStack(workspaces.a.repos);
    const { sites, networks, hosts, services, listeners, domains, dnsRecords } = seeded;

    expect(networks.lan?.siteId).toBe(sites.home?.id);
    expect(hosts.server).toMatchObject({
      siteId: sites.home?.id,
      addresses: [{ address: '10.0.10.20', networkId: networks.lan?.id }],
    });
    expect(hosts.router?.addresses.map(({ networkId }) => networkId))
      .toEqual([networks.lan?.id, networks.internet?.id]);
    expect(services.website?.hostId).toBe(hosts.server?.id);
    expect(services.weatherApi?.hostId).toBeNull();
    expect(Object.values(listeners).filter(({ serviceId }) => serviceId === services.npm?.id)).toHaveLength(3);
    expect(Object.values(dnsRecords).every(({ domainId }) => domainId === domains.homelab?.id)).toBe(true);
  });

  it('seeds the proxy routes of Nginx Proxy Manager on the website and its admin port', async () => {
    const { services, listeners, proxyRoutes } = await seedDemoStack(workspaces.a.repos);

    expect(services.npm).toMatchObject({ kind: 'reverse-proxy' });
    expect(proxyRoutes.website).toMatchObject({
      proxyServiceId: services.npm?.id,
      hostnames: ['homelab.example', 'www.homelab.example', 'app.homelab.example'],
      upstreamListenerId: listeners.website?.id,
      forceSsl: true,
    });
    expect(proxyRoutes.npmAdmin).toMatchObject({
      proxyServiceId: services.npm?.id,
      hostnames: ['npm.homelab.example'],
      upstreamListenerId: listeners.npmAdmin?.id,
    });
  });

  it('derives the flows of the demo stack: internal client to NPM 80, 443 and 81, public client to NPM 80 and 443 through the router, NPM to the website and to its admin port, and the manual website flows', async () => {
    const { a, db } = workspaces;
    const { services, listeners } = await seedDemoStack(a.repos);
    const serviceRef = (id: string | null) => Object.keys(services).find((ref) => services[ref]?.id === id);
    const listenerRef = (id: string) => Object.keys(listeners).find((ref) => listeners[ref]?.id === id);

    const derived = (await listDerivedFlows(db as never, a.workspace.id)).map((flow) =>
      `${flow.sourceClient ?? serviceRef(flow.sourceServiceId) ?? '?'} -> ${listenerRef(flow.targetListenerId) ?? '?'} ${flow.hostnames.join(' ')}`);
    const manual = (await a.repos.flows.list()).map((flow) =>
      `${serviceRef(flow.sourceServiceId) ?? '?'} -> ${listenerRef(flow.targetListenerId) ?? '?'}`);

    expect(derived.sort()).toEqual([
      'internal -> npmAdmin npm.homelab.example',
      'internal -> npmHttp npm.homelab.example',
      'internal -> npmHttps npm.homelab.example',
      'npm -> npmAdmin npm.homelab.example',
      'npm -> website homelab.example www.homelab.example app.homelab.example',
      'public -> npmHttp app.homelab.example homelab.example www.homelab.example',
      'public -> npmHttps app.homelab.example homelab.example www.homelab.example',
    ]);
    expect(manual.sort()).toEqual(['website -> database', 'website -> weatherApi']);
  });

  it('forwards the router\'s ports 80 and 443 to NPM, so the public records reach NPM 80 and 443', async () => {
    const { a, db } = workspaces;
    const { listeners } = await seedDemoStack(a.repos);
    const listenerRef = (id: string) => Object.keys(listeners).find((ref) => listeners[ref]?.id === id);

    const fromPublic = (await listDerivedFlows(db as never, a.workspace.id))
      .filter(({ sourceClient }) => sourceClient === 'public')
      .map((flow) => `${flow.extension} -> ${listenerRef(flow.targetListenerId) ?? '?'} ${flow.hostnames.join(' ')}`);

    expect(fromPublic.sort()).toEqual([
      'nat -> npmHttp app.homelab.example homelab.example www.homelab.example',
      'nat -> npmHttps app.homelab.example homelab.example www.homelab.example',
    ]);
  });

  it('given a failure halfway, keeps nothing (one transaction)', async () => {
    const { a, db } = workspaces;
    // Without the external-api kind, the Weather API cannot be created, after the other services.
    const withoutExternalApis = workspaces.repositories(a.workspace.id, {
      kinds: { hasKind: (entity, id) => id !== 'external-api' && BUILTIN_KINDS.hasKind(entity, id) },
    });

    await expect(seedDemoStack(withoutExternalApis)).rejects.toThrow(/external-api/);

    for (const table of SCOPED_TABLES) {
      expect(await countRows(db, table, a.workspace.id), table).toBe(0);
    }
  });
});
