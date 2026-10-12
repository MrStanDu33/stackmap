import { defineExtensionServer } from '@stackmap/extension-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createExtensionRegistry } from './registry';
import { startExtensions } from './runtime';

import type {
  ExtensionContext, ExtensionManifest, HookDeclaration, HookHandlers, ServerHooks,
} from '@stackmap/extension-sdk';

const manifest = (
  id: string,
  { dependsOn = [], enhances, hooks, apiVersion = 1 }:
  { dependsOn?: string[]; enhances?: string[]; hooks?: HookDeclaration[]; apiVersion?: number } = {},
): ExtensionManifest => ({
  id,
  version: '1.0.0',
  apiVersion,
  name: `extensions.${id}.name`,
  description: `extensions.${id}.description`,
  alwaysOn: false,
  dependsOn,
  ...(enhances ? { enhances } : {}),
  code: { server: true },
  contributes: { kinds: {}, ...(hooks ? { hooks } : {}) },
});

const peerAdded: HookDeclaration = { name: 'peer-added', side: 'server', description: 'A VPN peer was added' };

/** Calls a hook by any name: extension hooks are not in ServerHooks here. */
const callAny = (context: ExtensionContext<ServerHooks>, name: string, payload: unknown) =>
  (context.callHook as (hook: string, data: unknown) => Promise<void>)(name, payload);

/** Server hooks by any name, for handlers of extension hooks. */
const anyHooks = (hooks: Record<string, (payload: unknown) => unknown>) =>
  hooks as unknown as HookHandlers<ServerHooks>;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('extension runtime', () => {
  it('gives setup a context with every installed extension and its state, callHook and a logger prefixed with the extension', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    let context: ExtensionContext<ServerHooks> | undefined;
    const vpn = manifest('vpn');
    const server = defineExtensionServer(vpn, {
      setup: (received) => {
        context = received;
        received.log.info('ready');
      },
    });

    await startExtensions(createExtensionRegistry([vpn, manifest('proxy', { dependsOn: ['missing'] })], { servers: [server] }));

    expect(context?.extensions).toEqual([
      { id: 'proxy', version: '1.0.0', state: 'failed' },
      { id: 'vpn', version: '1.0.0', state: 'active' },
    ]);
    expect(info).toHaveBeenCalledWith('[extension:vpn] ready');
  });

  it('lets an extension call only its own declared hooks', async () => {
    const received = vi.fn();
    const contexts = new Map<string, ExtensionContext<ServerHooks>>();
    const vpn = manifest('vpn', { hooks: [peerAdded] });
    const audit = manifest('audit', { dependsOn: ['vpn'] });
    const servers = [
      defineExtensionServer(vpn, { setup: (context) => void contexts.set('vpn', context) }),
      defineExtensionServer(audit, {
        setup: (context) => void contexts.set('audit', context),
        hooks: anyHooks({ 'vpn:peer-added': received }),
      }),
    ];

    await startExtensions(createExtensionRegistry([vpn, audit], { servers }));
    await callAny(contexts.get('vpn')!, 'vpn:peer-added', { peer: 'laptop' });

    expect(received).toHaveBeenCalledWith({ peer: 'laptop' });
    await expect(callAny(contexts.get('audit')!, 'vpn:peer-added', {})).rejects.toThrow(/"audit" can only call its own hooks/);
    await expect(callAny(contexts.get('vpn')!, 'vpn:undeclared', {})).rejects.toThrow(/"vpn" does not declare "vpn:undeclared"/);
  });

  it('marks failed an extension handling hooks of an extension it neither depends on nor enhances', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const vpn = manifest('vpn', { hooks: [peerAdded] });
    const spy = manifest('spy');
    const odd = manifest('odd');
    const reader = manifest('reader', { dependsOn: ['vpn'] });
    const registry = createExtensionRegistry([vpn, spy, odd, reader], {
      servers: [
        defineExtensionServer(vpn, {}),
        defineExtensionServer(spy, { hooks: anyHooks({ 'vpn:peer-added': vi.fn() }) }),
        defineExtensionServer(odd, { hooks: anyHooks({ 'app:unknown': vi.fn() }) }),
        defineExtensionServer(reader, { hooks: anyHooks({ 'vpn:not-declared': vi.fn() }) }),
      ],
    });

    await startExtensions(registry);

    expect(registry.get('spy')).toMatchObject({
      state: 'failed',
      errors: ['handles "vpn:peer-added" but neither depends on nor enhances "vpn"'],
    });
    expect(registry.get('odd')).toMatchObject({
      state: 'failed',
      errors: ['handles "app:unknown", which is not a Stackmap hook'],
    });
    expect(registry.get('reader')).toMatchObject({
      state: 'failed',
      errors: ['handles "vpn:not-declared", which "vpn" does not declare'],
    });
    expect(registry.get('vpn')?.state).toBe('active');
  });

  it('marks failed an extension handling a hook that is not exactly <id>:<name>', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const vpn = manifest('vpn', { hooks: [peerAdded] });
    const odd = manifest('odd', { dependsOn: ['vpn'] });
    const registry = createExtensionRegistry([vpn, odd], {
      servers: [
        defineExtensionServer(vpn, {}),
        defineExtensionServer(odd, { hooks: anyHooks({ 'vpn:peer-added:extra': vi.fn() }) }),
      ],
    });

    await startExtensions(registry);

    expect(registry.get('odd')).toMatchObject({
      state: 'failed',
      errors: ['handles "vpn:peer-added:extra", which is not a Stackmap hook'],
    });
  });

  it('marks failed an extension whose setup does not settle in time', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const vpn = manifest('vpn');
    const registry = createExtensionRegistry([vpn], {
      servers: [defineExtensionServer(vpn, { setup: () => new Promise(() => undefined) })],
    });

    await startExtensions(registry, { setupTimeoutMs: 20 });

    expect(registry.get('vpn')).toMatchObject({ state: 'failed', errors: ['setup failed: timed out after 20 ms'] });
  });

  it('masks credentials in the errors it keeps, which diagnostics show', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const vpn = manifest('vpn');
    const registry = createExtensionRegistry([vpn], {
      servers: [defineExtensionServer(vpn, {
        setup: () => {
          throw new Error('cannot reach postgres://stackmap:s3cret@db.internal:5432/stackmap?password=hunter2');
        },
      })],
    });

    await startExtensions(registry);

    expect(registry.get('vpn')?.errors).toEqual([
      'setup failed: cannot reach postgres://stackmap:***@db.internal:5432/stackmap?password=***',
    ]);
  });

  it('skips the handlers for an enhanced extension while it is missing or failed', async () => {
    const stats = manifest('stats', { enhances: ['vpn'] });
    const statsServer = defineExtensionServer(stats, { hooks: anyHooks({ 'vpn:peer-added': vi.fn() }) });
    const vpn = manifest('vpn', { hooks: [peerAdded] });
    const vpnServer = defineExtensionServer(vpn, {});
    const brokenVpn = { ...vpn, apiVersion: 99 };

    const start = (manifests: ExtensionManifest[]) =>
      startExtensions(createExtensionRegistry(manifests, { servers: [statsServer, vpnServer] }));

    const without = await start([stats]);
    const failed = await start([stats, brokenVpn]);
    const withVpn = await start([stats, vpn]);

    expect(without.handlersOf('vpn:peer-added' as keyof ServerHooks)).toEqual([]);
    expect(failed.handlersOf('vpn:peer-added' as keyof ServerHooks)).toEqual([]);
    expect(withVpn.handlersOf('vpn:peer-added' as keyof ServerHooks)).toEqual(['stats']);
  });

  it('with STACKMAP_DEBUG=extensions, traces every hook call', async () => {
    vi.stubEnv('STACKMAP_DEBUG', 'extensions');
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const vpn = manifest('vpn');
    const runtime = await startExtensions(createExtensionRegistry([vpn], {
      servers: [defineExtensionServer(vpn, { hooks: { 'app:ready': () => undefined } })],
    }));

    await runtime.callHook('app:ready', { version: '1.0.0' });

    expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^\[extensions\] app:ready → vpn \(\d/));
  });
});
