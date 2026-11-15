import { defineInventory } from '@stackmap/extension-sdk';
import { endpoint } from '@stackmap/extension-sdk/entities';

import manifest from '../manifest';

import type { InventoryColumn } from '@stackmap/extension-sdk';
import type { Component } from 'vue';

const field = (name: string, column: Omit<InventoryColumn, 'field' | 'label'> = {}, label = name): InventoryColumn => ({
  field: name, label: `extensions.nat.fields.port-forward.${label}`, ...column,
});

/** The NAT extension's types in the inventory: the port forward's form and table columns. */
export default defineInventory<Component>(manifest, [
  {
    entity: 'port-forward',
    form: () => import('./components/inventory/PortForwardForm.vue').then((module) => module.default),
    columns: [
      field('hostId', { format: 'reference', reference: 'core/host' }),
      field('externalAddress', { format: 'endpoint', port: 'externalPort' }, 'external'),
      field('transport', { format: 'enum', labels: 'extensions.core.transports' }),
      field('internalAddress', { format: 'endpoint', port: 'internalPort' }, 'internal'),
      field('description'),
    ],
    title: (forward, name) => `${name('core/host', forward.hostId)} ${
      endpoint(String(forward.externalAddress), typeof forward.externalPort === 'number' ? forward.externalPort : null)}/${String(forward.transport)}`,
  },
]);
