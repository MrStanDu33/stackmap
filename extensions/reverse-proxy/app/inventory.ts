import { defineInventory } from '@stackmap/extension-sdk';

import manifest from '../manifest';

import type { InventoryColumn } from '@stackmap/extension-sdk';
import type { Component } from 'vue';

const field = (name: string, column: Omit<InventoryColumn, 'field' | 'label'> = {}): InventoryColumn => ({
  field: name, label: `extensions.reverse-proxy.fields.route.${name}`, ...column,
});

/** The reverse proxy's types in the inventory: the route's form and table columns. */
export default defineInventory<Component>(manifest, [
  {
    entity: 'route',
    form: () => import('./components/inventory/RouteForm.vue').then((module) => module.default),
    columns: [
      field('hostnames', { format: 'list' }),
      field('proxyServiceId', { format: 'reference', reference: 'core/service' }),
      field('upstreamListenerId', { format: 'reference', reference: 'core/listener' }),
      field('forceSsl', { format: 'boolean' }),
      field('websockets', { format: 'boolean' }),
    ],
    // A proxy serves a hostname once: "<proxy> → <hostname>" names a route uniquely.
    title: (route, name) => {
      const [first = '', ...others] = (route.hostnames ?? []) as string[];
      const hostnames = others.length > 0 ? `${first} (+${String(others.length)})` : first;
      const proxy = name('core/service', route.proxyServiceId);
      return proxy ? `${proxy} → ${hostnames}` : hostnames;
    },
  },
]);
