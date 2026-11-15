import { describe, expect, it } from 'vitest';

import { extensionLabels } from './extension-labels';
import { createTestI18n } from '../../tests/support/i18n';

import type { Translate } from './traffic-graph';
import type { WorkspaceExtension } from '../../shared/contracts/extensions';

const core: WorkspaceExtension = {
  id: 'core',
  version: '1.0.0',
  name: 'extensions.core.name',
  description: 'extensions.core.description',
  icon: 'i-lucide-layers',
  alwaysOn: true,
  dependsOn: [],
  state: 'active',
  enabled: true,
  kinds: {
    host: [
      { id: 'physical', label: 'extensions.core.kinds.host.physical', icon: 'i-lucide-server' },
      { id: 'vm', label: 'extensions.core.kinds.host.vm', icon: 'i-lucide-monitor' },
    ],
    network: [],
    service: [{ id: 'external-api', label: 'extensions.core.kinds.service.externalApi', icon: 'i-lucide-plug' }],
    protocol: [],
  },
  entities: [{ id: 'dns-record', label: 'extensions.core.entities.dns-record' }],
  locales: [],
};

const proxy: WorkspaceExtension = {
  ...core,
  id: 'reverse-proxy',
  name: 'extensions.reverse-proxy.name',
  description: 'extensions.reverse-proxy.description',
  alwaysOn: false,
  kinds: {
    host: [], network: [], protocol: [],
    service: [{ id: 'reverse-proxy', label: 'extensions.reverse-proxy.kinds.service.reverse-proxy' }],
  },
  entities: [{ id: 'route', label: 'extensions.reverse-proxy.entities.route' }],
};

const translator = (locale: 'en' | 'fr'): Translate => {
  const { t } = createTestI18n(locale).global;
  return (key, params) => t(key, params ?? {});
};

describe('useExtensions', () => {
  const labels = () => extensionLabels([core, proxy], translator('en'));

  it('translates a kind by entity and kind id, from the extension that declares it', () => {
    expect(labels().kindLabel('host', 'vm')).toBe('Virtual machine');
    expect(labels().kindLabel('service', 'external-api')).toBe('External API');
  });

  it('translates an entity type by extension and entity id, and its plural', () => {
    expect(labels().entityLabel('core', 'dns-record')).toBe('DNS record');
    expect(labels().entityPlural('core', 'dns-record')).toBe('DNS records');
  });

  it('translates an extension\'s name', () => {
    expect(labels().extensionName('core')).toBe('Core');
  });

  it('falls back to the raw id when no active extension declares the kind or entity', () => {
    expect(labels().kindLabel('host', 'mainframe')).toBe('mainframe');
    expect(labels().entityLabel('vpn', 'peer')).toBe('peer');
    expect(labels().extensionName('vpn')).toBe('vpn');
    const failed = extensionLabels([{ ...proxy, state: 'failed' }], translator('en'));
    expect(failed.entityLabel('reverse-proxy', 'route')).toBe('route');
  });

  it('lists the kinds of an entity across active extensions, with their icons, for a select', () => {
    expect(labels().kindOptions('service')).toEqual([
      { value: 'external-api', label: 'External API', icon: 'i-lucide-plug' },
      { value: 'reverse-proxy', label: 'Reverse proxy' },
    ]);
    expect(labels().kindOptions('network')).toEqual([]);
  });

  it('follows a locale change without reloading the extensions', () => {
    const i18n = createTestI18n('en');
    const followed = extensionLabels([core], (key, params) => i18n.global.t(key, params ?? {}));

    expect(followed.kindLabel('host', 'vm')).toBe('Virtual machine');
    i18n.global.locale.value = 'fr';
    expect(followed.kindLabel('host', 'vm')).toBe('Machine virtuelle');
  });

  it('given an extension turned off in the workspace, does not offer its kinds in a select (37)', () => {
    const labels = extensionLabels([core, { ...proxy, enabled: false }], translator('en'));
    expect(labels.kindOptions('service').map(({ value }) => value)).toEqual(['external-api']);
  });

  it('given an extension turned off in the workspace, still names its kinds and entity types (21, 37)', () => {
    const labels = extensionLabels([core, { ...proxy, enabled: false }], translator('en'));
    expect(labels.kindLabel('service', 'reverse-proxy')).toBe('Reverse proxy');
    expect(labels.entityLabel('reverse-proxy', 'route')).toBe('Proxy route');
    expect(labels.extensionName('reverse-proxy')).toBe('Reverse proxy');
  });
});
