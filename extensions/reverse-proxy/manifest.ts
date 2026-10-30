import { defineExtension } from '@stackmap/extension-sdk';

/** Reverse proxies and their routes: which hostnames a proxy serves, and which listener it forwards each one to. */
export default defineExtension({
  id: 'reverse-proxy',
  version: '0.0.0',
  apiVersion: 1,
  name: 'extensions.reverse-proxy.name',
  description: 'extensions.reverse-proxy.description',
  icon: 'i-lucide-split',
  alwaysOn: false,
  dependsOn: ['core'],
  code: { server: true },
  contributes: {
    entities: [
      { id: 'route', table: 'reverse_proxy_route', label: 'extensions.reverse-proxy.entities.route' },
    ],
    kinds: {
      service: [
        { id: 'reverse-proxy', label: 'extensions.reverse-proxy.kinds.service.reverse-proxy', icon: 'i-lucide-split' },
      ],
    },
  },
});
