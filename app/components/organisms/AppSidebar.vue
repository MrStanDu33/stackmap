<script setup lang="ts">
/** The app's navigation: only the sections that exist, and the display preferences in its footer. */
const { t } = useI18n();

const items = computed(() => [{ label: t('nav.graph'), icon: 'i-lucide-waypoints', to: '/graph' }]);
</script>

<template>
  <!-- A landmark of its own: every piece of content sits in one (RGAA 12.6). -->
  <UDashboardSidebar
    collapsible
    role="region"
    :aria-label="t('app.name')"
    :ui="{ footer: 'border-t border-default' }"
  >
    <template #header="{ collapsed }">
      <span
        v-if="!collapsed"
        class="font-semibold"
      >{{ t('app.name') }}</span>
      <UIcon
        v-else
        name="i-lucide-map"
        class="mx-auto size-5 text-primary"
        aria-hidden="true"
      />
    </template>

    <template #default="{ collapsed }">
      <UNavigationMenu
        :collapsed="collapsed"
        :items="items"
        orientation="vertical"
        :aria-label="t('nav.label')"
      />
    </template>

    <template #footer="{ collapsed }">
      <DisplayPreferences
        v-if="!collapsed"
        class="w-full py-2"
      />
    </template>
  </UDashboardSidebar>
</template>
