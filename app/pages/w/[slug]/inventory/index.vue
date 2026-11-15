<script setup lang="ts">
import type { InstalledExtension } from '~/extensions/inventory';

import { useExtensions } from '~/composables/useExtensions';
import { inventoryTypes } from '~/extensions/inventory';

// The inventory opens on its first type: the sites.
const route = useRoute();
const { t } = useI18n();
useExtensions();
const installed = useState<InstalledExtension[]>('extensions', () => []);
useHead({ title: () => [t('inventory.title'), t('app.name')].join(' · ') });

watch(installed, async (extensions) => {
  const [first] = inventoryTypes(extensions);
  if (first) {
    await navigateTo(`/w/${String(route.params.slug)}/inventory/${first.key}`, { replace: true });
  }
}, { immediate: true });
</script>

<template>
  <p
    role="status"
    class="p-6 text-muted"
  >
    {{ t('inventory.loading', { type: t('inventory.title') }) }}
  </p>
</template>
