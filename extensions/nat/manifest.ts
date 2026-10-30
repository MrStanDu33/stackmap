import { defineExtension } from '@stackmap/extension-sdk';

/** Port forwards (destination NAT): which port of a host's address goes to which internal address and port. */
export default defineExtension({
  id: 'nat',
  version: '0.0.0',
  apiVersion: 1,
  name: 'extensions.nat.name',
  description: 'extensions.nat.description',
  icon: 'i-lucide-arrow-right-left',
  alwaysOn: false,
  dependsOn: ['core'],
  code: { server: true },
  contributes: {
    entities: [
      { id: 'port-forward', table: 'nat_portForward', label: 'extensions.nat.entities.port-forward' },
    ],
    kinds: {},
  },
});
