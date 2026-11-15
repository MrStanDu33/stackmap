import { defineInventory } from '@stackmap/extension-sdk';

import manifest from '../manifest';

import type { InventoryColumn } from '@stackmap/extension-sdk';
import type { Component } from 'vue';

const field = (entity: string, name: string, column: Omit<InventoryColumn, 'field' | 'label'> = {}): InventoryColumn => ({
  field: name, label: `extensions.core.fields.${entity}.${name}`, ...column,
});

/** The core's types in the inventory, in the manifest's order: their forms and table columns. */
export default defineInventory<Component>(manifest, [
  {
    entity: 'site',
    form: () => import('./components/inventory/SiteForm.vue').then((module) => module.default),
    columns: [field('site', 'name')],
  },
  {
    entity: 'network',
    form: () => import('./components/inventory/NetworkForm.vue').then((module) => module.default),
    columns: [
      field('network', 'name'),
      field('network', 'kind', { format: 'kind', kind: 'network' }),
      field('network', 'cidr'),
      field('network', 'vlan', { format: 'number' }),
      field('network', 'siteId', { format: 'reference', reference: 'core/site' }),
    ],
  },
  {
    entity: 'host',
    form: () => import('./components/inventory/HostForm.vue').then((module) => module.default),
    columns: [
      field('host', 'name'),
      field('host', 'kind', { format: 'kind', kind: 'host' }),
      field('host', 'siteId', { format: 'reference', reference: 'core/site' }),
      field('host', 'addresses', { format: 'list' }),
    ],
    references: ['core/network'],
  },
  {
    entity: 'service',
    form: () => import('./components/inventory/ServiceForm.vue').then((module) => module.default),
    columns: [
      field('service', 'name'),
      field('service', 'kind', { format: 'kind', kind: 'service' }),
      field('service', 'hostId', { format: 'reference', reference: 'core/host' }),
      field('service', 'image'),
    ],
  },
  {
    entity: 'listener',
    form: () => import('./components/inventory/ListenerForm.vue').then((module) => module.default),
    columns: [
      field('listener', 'serviceId', { format: 'reference', reference: 'core/service' }),
      field('listener', 'port', { format: 'number' }),
      field('listener', 'transport'),
      field('listener', 'protocol', { format: 'kind', kind: 'protocol' }),
      field('listener', 'publishedPort', { format: 'number' }),
    ],
    title: (listener, name) => `${name('core/service', listener.serviceId)} :${String(listener.port)}/${String(listener.transport)}`,
  },
  {
    entity: 'domain',
    form: () => import('./components/inventory/DomainForm.vue').then((module) => module.default),
    columns: [field('domain', 'name')],
  },
  {
    entity: 'dns-record',
    form: () => import('./components/inventory/DnsRecordForm.vue').then((module) => module.default),
    columns: [
      field('dns-record', 'name'),
      field('dns-record', 'domainId', { format: 'reference', reference: 'core/domain' }),
      field('dns-record', 'type'),
      field('dns-record', 'value'),
      field('dns-record', 'view'),
    ],
    title: (record, name) => `${String(record.name)} (${name('core/domain', record.domainId)})`,
  },
  {
    entity: 'flow',
    form: () => import('./components/inventory/FlowForm.vue').then((module) => module.default),
    columns: [
      field('flow', 'sourceServiceId', { format: 'reference', reference: 'core/service' }),
      field('flow', 'targetListenerId', { format: 'reference', reference: 'core/listener' }),
      field('flow', 'protocol', { format: 'kind', kind: 'protocol' }),
      field('flow', 'purpose'),
    ],
    title: (flow, name) => `${name('core/service', flow.sourceServiceId)} → ${name('core/listener', flow.targetListenerId)}`,
  },
]);
