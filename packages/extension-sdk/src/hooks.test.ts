import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import { createHookBus, defineExtensionClient, defineExtensionServer } from './hooks';

import type { ExtensionServer } from './hooks';
import type { ExtensionManifest } from './manifest';

interface TestHooks {
  'app:ready': { version: string };
  'vpn:peer-added': { peer: { name: string } };
}

const vpn: ExtensionManifest = {
  id: 'vpn',
  version: '1.0.0',
  apiVersion: 1,
  name: 'extensions.vpn.name',
  description: 'extensions.vpn.description',
  alwaysOn: false,
  dependsOn: [],
  code: { server: true, client: true },
  contributes: { kinds: {} },
};

describe('defineExtensionServer', () => {
  it('keeps the migrations and the repository definitions of the extension\'s server code', () => {
    const manifest = vpn;
    const migrations = { '0001_peer': { up: () => Promise.resolve(), down: () => Promise.resolve() } };
    const repositories = [{ entity: 'peer', key: 'vpnPeers', table: 'vpn_peer' }] as unknown as ExtensionServer['repositories'];

    expect(defineExtensionServer(manifest, { migrations, repositories })).toMatchObject({ extension: 'vpn', migrations, repositories });
    expect(defineExtensionServer(manifest, {})).not.toHaveProperty('migrations');
  });

  it('freezes copies of the migrations and repository definitions, so they cannot change after the check', () => {
    const repositories = [{ entity: 'peer', key: 'vpnPeers', table: 'vpn_peer', columns: ['name'] }] as unknown as ExtensionServer['repositories'];
    const server = defineExtensionServer(vpn, { migrations: { '0001_peer': { up: () => Promise.resolve() } }, repositories });

    expect(Object.isFrozen(server.migrations)).toBe(true);
    expect(Object.isFrozen(server.repositories)).toBe(true);
    expect(Object.isFrozen(server.repositories?.[0])).toBe(true);
    expect(Object.isFrozen(server.repositories?.[0]?.columns)).toBe(true);
    expect(server.repositories).not.toBe(repositories);
  });
});

describe('createHookBus', () => {
  it('calls the handlers in registry order, awaiting each, with the payload', async () => {
    const calls: string[] = [];
    const bus = createHookBus<TestHooks>([
      {
        extension: 'core',
        hooks: {
          'app:ready': async ({ version }) => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            calls.push(`core ${version}`);
          },
        },
      },
      { extension: 'vpn', hooks: { 'app:ready': ({ version }) => void calls.push(`vpn ${version}`) } },
    ], { onError: vi.fn() });

    await bus.callHook('app:ready', { version: '1.0.0' });

    expect(calls).toEqual(['core 1.0.0', 'vpn 1.0.0']);
    expect(bus.handlersOf('app:ready')).toEqual(['core', 'vpn']);
  });

  it('gives each handler its own copy of the payload', async () => {
    const seen: string[] = [];
    const payload = { peer: { name: 'laptop' } };
    const bus = createHookBus<TestHooks>([
      { extension: 'a', hooks: { 'vpn:peer-added': (event) => void (event.peer.name = 'changed') } },
      { extension: 'b', hooks: { 'vpn:peer-added': (event) => void seen.push(event.peer.name) } },
    ], { onError: vi.fn() });

    await bus.callHook('vpn:peer-added', payload);

    expect(seen).toEqual(['laptop']);
    expect(payload.peer.name).toBe('laptop');
  });

  it('given a handler that throws or rejects, reports it with the extension, the hook and the error, and calls the next handlers', async () => {
    const onError = vi.fn();
    const after = vi.fn();
    const bus = createHookBus<TestHooks>([
      {
        extension: 'broken',
        hooks: {
          'app:ready': () => {
            throw new Error('boom');
          },
        },
      },
      { extension: 'rejects', hooks: { 'app:ready': () => Promise.reject(new Error('later')) } },
      { extension: 'fine', hooks: { 'app:ready': after } },
    ], { onError });

    await expect(bus.callHook('app:ready', { version: '1' })).resolves.toBeUndefined();

    expect(onError).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: 'boom' }), {
      extension: 'broken',
      hook: 'app:ready',
    });
    expect(onError).toHaveBeenNthCalledWith(2, expect.objectContaining({ message: 'later' }), {
      extension: 'rejects',
      hook: 'app:ready',
    });
    expect(after).toHaveBeenCalledWith({ version: '1' });
  });

  it('outside production, given a payload that is not plain JSON, fails the call naming the hook', async () => {
    const handler = vi.fn();
    const bus = createHookBus<Record<string, unknown>>([{ extension: 'a', hooks: { 'vpn:peer-added': handler } }], {
      onError: vi.fn(),
      checkPayloads: true,
    });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    const notJson = [{ at: new Date() }, { run: () => undefined }, cyclic, { value: undefined }, { n: Number.NaN }];
    for (const payload of notJson) {
      await expect(bus.callHook('vpn:peer-added', payload)).rejects.toThrow(/vpn:peer-added.*plain JSON/);
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('given a hook nobody handles, resolves', async () => {
    const bus = createHookBus<TestHooks>([{ extension: 'a', hooks: {} }], { onError: vi.fn() });

    await expect(bus.callHook('app:ready', { version: '1' })).resolves.toBeUndefined();
    expect(bus.handlersOf('app:ready')).toEqual([]);
  });

  it('with tracing on, logs every call: hook, handlers in order, duration of each, errors', async () => {
    const trace = vi.fn();
    const bus = createHookBus<TestHooks>([
      { extension: 'core', hooks: { 'app:ready': () => undefined } },
      {
        extension: 'broken',
        hooks: {
          'app:ready': () => {
            throw new Error('boom');
          },
        },
      },
    ], { onError: vi.fn(), trace });

    await bus.callHook('app:ready', { version: '1' });

    expect(trace).toHaveBeenCalledWith(
      expect.stringMatching(/app:ready.*core \(\d+(?:\.\d+)?ms\).*broken \(\d+(?:\.\d+)?ms, failed: boom\)/),
    );
  });
});

describe('createHookBus: timeouts', () => {
  it('given a handler that does not settle in time, reports it as failed and calls the next handlers', async () => {
    const onError = vi.fn();
    const after = vi.fn();
    const bus = createHookBus<TestHooks>([
      { extension: 'stuck', hooks: { 'app:ready': () => new Promise(() => undefined) } },
      { extension: 'fine', hooks: { 'app:ready': after } },
    ], { onError, timeoutMs: 20 });

    await bus.callHook('app:ready', { version: '1' });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'timed out after 20 ms' }), {
      extension: 'stuck',
      hook: 'app:ready',
    });
    expect(after).toHaveBeenCalled();
  });
});

describe('defineExtensionServer and defineExtensionClient', () => {
  it('freeze a copy of the hooks: handlers added after the definition are ignored', () => {
    const hooks: Record<string, () => void> = {};
    const server = defineExtensionServer(vpn, { hooks });

    hooks['app:ready'] = vi.fn();

    expect(server.hooks).not.toHaveProperty('app:ready');
    expect(Object.isFrozen(server.hooks)).toBe(true);
    expect(Object.isFrozen(defineExtensionClient(vpn, {}).hooks)).toBe(true);
  });

  it('tie the code to the manifest, with typed hook names and payloads', () => {
    const setup = vi.fn();

    const server = defineExtensionServer(vpn, {
      setup,
      hooks: { 'app:ready': ({ version }) => void expectTypeOf(version).toBeString() },
    });
    const client = defineExtensionClient(vpn, {
      hooks: { 'route:changed': ({ path }) => void expectTypeOf(path).toBeString() },
    });

    expect(server).toEqual({ extension: 'vpn', setup, hooks: { 'app:ready': expect.any(Function) as unknown } });
    expect(client).toEqual({ extension: 'vpn', hooks: { 'route:changed': expect.any(Function) as unknown } });
    expect(defineExtensionClient(vpn, {})).toEqual({ extension: 'vpn', hooks: {} });
  });
});
