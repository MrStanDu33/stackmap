<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';

/** The app's navigation: only the sections that exist, and the display preferences in its footer. */
const props = defineProps<{
  user?: { name: string } | null;
  workspaces?: { name: string; slug: string; role: WorkspaceRole }[] | null;
  current?: string;
  canCreate?: boolean;
  /** The page's view, which the switcher's links keep. */
  view?: 'graph' | 'trace';
}>();
const emit = defineEmits<{ signOut: [] }>();

const { t } = useI18n();

// The views of the current workspace; outside one, the paths that lead to the last one used.
const base = computed(() => (props.current ? `/w/${props.current}` : ''));
// Named on the link too: collapsed, the menu shows the icons alone.
const items = computed(() => [
  { label: t('traffic.title'), 'aria-label': t('traffic.title'), icon: 'i-lucide-waypoints', to: `${base.value}/graph` },
  { label: t('trace.title'), 'aria-label': t('trace.title'), icon: 'i-lucide-route', to: `${base.value}/trace` },
]);
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
      <WorkspaceSwitcher
        v-if="workspaces !== undefined"
        :workspaces="workspaces"
        :current="current"
        :view="view ?? 'graph'"
        :can-create="canCreate"
        :collapsed="collapsed"
      />
      <UNavigationMenu
        :collapsed="collapsed"
        :items="items"
        tooltip
        orientation="vertical"
        :aria-label="t('nav.label')"
      />
    </template>

    <template #footer="{ collapsed }">
      <div class="flex w-full flex-col gap-2 py-2">
        <DisplayPreferences v-if="!collapsed" />
        <div
          v-if="user"
          class="flex items-center justify-between gap-2"
        >
          <span
            v-if="!collapsed"
            class="truncate text-sm"
          >{{ user.name }}</span>
          <!-- An icon alone: the tooltip names it for sighted users, as the menu's do. -->
          <UTooltip
            v-if="collapsed"
            :text="t('auth.signOutOf', { name: user.name })"
          >
            <UButton
              icon="i-lucide-log-out"
              color="neutral"
              variant="ghost"
              class="mx-auto"
              :aria-label="t('auth.signOutOf', { name: user.name })"
              @click="emit('signOut')"
            />
          </UTooltip>
          <UButton
            v-else
            icon="i-lucide-log-out"
            color="neutral"
            variant="outline"
            size="sm"
            @click="emit('signOut')"
          >
            {{ t('auth.signOut') }}
          </UButton>
        </div>
      </div>
    </template>
  </UDashboardSidebar>
</template>
