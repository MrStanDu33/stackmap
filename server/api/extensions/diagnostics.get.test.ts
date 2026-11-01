import { defineExtensionServer } from '@stackmap/extension-sdk';
import { createApp, toWebHandler } from 'h3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import handler from './diagnostics.get';
import { useSignedIn } from '../../../tests/support/sessions';
import { createExtensionRegistry } from '../../extensions/registry';
import { setExtensionRegistry } from '../../utils/extensions';

import type { ExtensionRegistry } from '../../extensions/registry';
import type { ExtensionManifest } from '@stackmap/extension-sdk';

useSignedIn();

const manifest = (id: string, extra: Partial<ExtensionManifest> = {}): ExtensionManifest => ({
  id,
  version: '1.0.0',
  apiVersion: 1,
  name: `extensions.${id}.name`,
  description: `extensions.${id}.description`,
  alwaysOn: false,
  dependsOn: [],
  contributes: { kinds: {} },
  ...extra,
});

const vpn = manifest('vpn', {
  code: { server: true, client: true },
  contributes: { kinds: {}, hooks: [{ name: 'peer-added', side: 'server', description: 'A peer was added' }] },
});
const proxy = manifest('proxy', { dependsOn: ['tls'] });

/** The build module's translation report, as the server gets it in its runtime config. */
const extensionLocales = {
  languages: [{
    code: 'de',
    language: 'de-DE',
    name: 'Deutsch',
    coverage: 0.5,
    missing: ['app.tagline'],
    conflicts: [{ key: 'app.name', winner: null, ignored: ['german'] }],
  }],
};

const registryWith = (hooks: Record<string, () => undefined> = { 'app:ready': () => undefined }) =>
  createExtensionRegistry([vpn, proxy], { servers: [defineExtensionServer(vpn, { hooks: hooks })] });

const get = async (registry: ExtensionRegistry = registryWith()) => {
  setExtensionRegistry(registry);
  vi.stubGlobal('useRuntimeConfig', () => ({ extensionLocales }));
  const response = await toWebHandler(createApp().use('/api/extensions/diagnostics', handler))(
    new Request('http://localhost/api/extensions/diagnostics'),
  );
  return { status: response.status, json: await response.json() as Record<string, unknown> };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/extensions/diagnostics', () => {
  it('returns per extension: state, errors, declared code, hooks provided and handled', async () => {
    const { status, json } = await get();

    expect(status).toBe(200);
    expect(json.extensions).toEqual([
      {
        id: 'proxy',
        version: '1.0.0',
        state: 'failed',
        errors: ['depends on "tls", which is not installed'],
        code: { server: false, client: false },
        hooks: { provides: [], handles: [] },
      },
      {
        id: 'vpn',
        version: '1.0.0',
        state: 'active',
        errors: [],
        code: { server: true, client: true },
        hooks: { provides: ['vpn:peer-added'], handles: ['app:ready'] },
      },
    ]);
  });

  it('returns per language: coverage, missing keys and conflicts', async () => {
    expect((await get()).json.languages).toEqual(extensionLocales.languages);
  });

  it('requires the instance administrator', () => {
    expect(handler.contract.requiredRole).toBe('instanceAdmin');
  });

  type Diagnosed = { id: string; errors: string[]; hooks: { handles: string[] } };
  const vpnOf = (json: Record<string, unknown>) => (json.extensions as Diagnosed[]).find(({ id }) => id === 'vpn');

  it('given an extension whose setup error is 1,500 characters, answers 200 with that error cut to 1000, ending with …', async () => {
    const registry = registryWith();
    registry.fail('vpn', `setup failed: ${'x'.repeat(1500)}`);

    const { status, json } = await get(registry);

    expect(status).toBe(200);
    const [error = ''] = vpnOf(json)?.errors ?? [];
    expect(error).toHaveLength(1000);
    expect(error.endsWith('…')).toBe(true);
  });

  it('given an extension with 60 errors, shows 50: the first 49, then how many more the server logs have', async () => {
    const registry = registryWith();
    for (let index = 1; index <= 60; index += 1) {
      registry.fail('vpn', `error ${String(index)}`);
    }

    const { status, json } = await get(registry);

    expect(status).toBe(200);
    const errors = vpnOf(json)?.errors ?? [];
    expect(errors).toHaveLength(50);
    expect(errors[48]).toBe('error 49');
    expect(errors[49]).toBe('… and 11 more errors (see the server logs)');
  });

  it('given an extension handling a hook with an invalid name (vpn:peer_added), answers 200 listing it in hooks.handles', async () => {
    const { status, json } = await get(registryWith({ 'vpn:peer_added': () => undefined }));

    expect(status).toBe(200);
    expect(vpnOf(json)?.hooks.handles).toEqual(['vpn:peer_added']);
  });

  it('given a hook key longer than 81 characters, answers 200 with it cut to 81', async () => {
    const long = `vpn:${'a'.repeat(100)}`;

    const { status, json } = await get(registryWith({ [long]: () => undefined }));

    expect(status).toBe(200);
    expect(vpnOf(json)?.hooks.handles).toEqual([long.slice(0, 81)]);
  });

  it('given hook keys that are empty, hold refused characters or number more than 100, answers 200 within the contract', async () => {
    const hooks: Record<string, () => undefined> = { '': () => undefined, 'vpn:\u202Epeer': () => undefined, 'vpn:peer\nx': () => undefined };
    for (let index = 0; index < 110; index += 1) {
      hooks[`vpn:hook-${String(index)}`] = () => undefined;
    }

    const { status, json } = await get(registryWith(hooks));

    expect(status).toBe(200);
    const handles = vpnOf(json)?.hooks.handles ?? [];
    expect(handles).toHaveLength(100);
    expect(handles.slice(0, 3)).toEqual(['vpn:?peer', 'vpn:peer?x', 'vpn:hook-0']);
  });
});
