import { defineExtension } from '@stackmap/extension-sdk';

export default defineExtension({
  id: 'core',
  version: '0.0.0',
  apiVersion: 1,
  name: 'extensions.core.name',
  description: 'extensions.core.description',
  icon: 'i-lucide-layers',
  alwaysOn: true,
});
