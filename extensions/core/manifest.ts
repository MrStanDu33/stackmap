import { defineExtension } from '@stackmap/extension-sdk';

/** The core: always on, and built with the same SDK as every other extension. */
export default defineExtension({
  id: 'core',
  version: '0.0.0',
  apiVersion: 1,
  name: 'extensions.core.name',
  description: 'extensions.core.description',
  icon: 'i-lucide-layers',
  alwaysOn: true,
  contributes: {
    kinds: {
      host: [
        { id: 'physical', label: 'extensions.core.kinds.host.physical', icon: 'i-lucide-server' },
        { id: 'vm', label: 'extensions.core.kinds.host.vm', icon: 'i-lucide-monitor' },
        { id: 'vps', label: 'extensions.core.kinds.host.vps', icon: 'i-lucide-cloud' },
        { id: 'router', label: 'extensions.core.kinds.host.router', icon: 'i-lucide-router' },
      ],
      network: [
        { id: 'lan', label: 'extensions.core.kinds.network.lan', icon: 'i-lucide-network' },
        { id: 'dmz', label: 'extensions.core.kinds.network.dmz', icon: 'i-lucide-shield' },
        { id: 'public', label: 'extensions.core.kinds.network.public', icon: 'i-lucide-globe' },
      ],
      service: [
        { id: 'app', label: 'extensions.core.kinds.service.app', icon: 'i-lucide-app-window' },
        { id: 'database', label: 'extensions.core.kinds.service.database', icon: 'i-lucide-database' },
        { id: 'cache', label: 'extensions.core.kinds.service.cache', icon: 'i-lucide-zap' },
        { id: 'dns', label: 'extensions.core.kinds.service.dns', icon: 'i-lucide-signpost' },
        { id: 'external-api', label: 'extensions.core.kinds.service.externalApi', icon: 'i-lucide-plug' },
        { id: 'other', label: 'extensions.core.kinds.service.other', icon: 'i-lucide-circle-help' },
      ],
      protocol: [
        { id: 'tcp', label: 'extensions.core.kinds.protocol.tcp', icon: 'i-lucide-cable' },
        { id: 'udp', label: 'extensions.core.kinds.protocol.udp', icon: 'i-lucide-radio' },
        { id: 'http', label: 'extensions.core.kinds.protocol.http', icon: 'i-lucide-globe' },
        { id: 'https', label: 'extensions.core.kinds.protocol.https', icon: 'i-lucide-lock' },
        { id: 'ssh', label: 'extensions.core.kinds.protocol.ssh', icon: 'i-lucide-terminal' },
        { id: 'ftp', label: 'extensions.core.kinds.protocol.ftp', icon: 'i-lucide-folder-up' },
        { id: 'sftp', label: 'extensions.core.kinds.protocol.sftp', icon: 'i-lucide-folder-lock' },
      ],
    },
  },
});
