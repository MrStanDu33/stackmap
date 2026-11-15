<script setup lang="ts">
import type { InstalledExtension } from '~/extensions/inventory';

import { useExtensions } from '~/composables/useExtensions';
import { inventoryTypes } from '~/extensions/inventory';

// The inventory opens on its first type, the sites, once the extensions are known.
const route = useRoute();
const { t } = useI18n();
const { session, signOut } = useAccount();
const { workspaces } = useWorkspaces();
const { error, retry } = useExtensions(() => workspaces.value?.find(({ slug }) => slug === route.params.slug)?.id);
const installed = useState<InstalledExtension[]>('extensions', () => []);
const slug = computed(() => String(route.params.slug));
useHead({ title: () => [t('inventory.title'), t('app.name')].join(' · ') });

watch(installed, async (extensions) => {
  const [first] = inventoryTypes(extensions);
  if (first) {
    await navigateTo(`/w/${slug.value}/inventory/${first.key}`, { replace: true });
  }
}, { immediate: true });
</script>

<template>
  <AppShell
    :user="session?.user"
    :workspaces="workspaces"
    :current="slug"
    :can-create="session?.user.role === 'admin'"
    @sign-out="signOut"
  >
    <InventoryTemplate
      :groups="[]"
      :title="t('inventory.title')"
      :not-found="false"
      :back-to="`/w/${slug}/inventory`"
    >
      <div
        v-if="error"
        role="alert"
        class="flex flex-wrap items-center gap-3"
      >
        <p>{{ t('inventory.extensionsFailed') }}</p>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          @click="retry"
        >
          {{ t('inventory.retry') }}
        </UButton>
      </div>
      <p
        v-else
        role="status"
        class="text-muted"
      >
        {{ t('inventory.loading') }}
      </p>
    </InventoryTemplate>
  </AppShell>
</template>
