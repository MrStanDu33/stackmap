import { defineExtensionServer } from '@stackmap/extension-sdk';
import { createApp, toWebHandler } from 'h3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import handler from './diagnostics.get';
import { createExtensionRegistry } from '../../extensions/registry';
import { setExtensionRegistry } from '../../utils/extensions';

import type { ExtensionManifest } from '@stackmap/extension-sdk';

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

const get = async () => {
  setExtensionRegistry(createExtensionRegistry([vpn, proxy], {
    servers: [defineExtensionServer(vpn, { hooks: { 'app:ready': () => undefined } })],
  }));
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

  it('requires the admin role', () => {
    expect(handler.contract.requiredRole).toBe('admin');
  });
});
