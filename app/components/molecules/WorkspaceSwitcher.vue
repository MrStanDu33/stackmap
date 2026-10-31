<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';
import type { DropdownMenuItem } from '@nuxt/ui';

/** The sidebar's workspace menu: the current one, and links to the same view of the others. */
const props = defineProps<{
  /** Null while the list loads. */
  workspaces: { name: string; slug: string; role: WorkspaceRole }[] | null;
  current?: string;
  view: 'graph' | 'trace';
  canCreate?: boolean;
  collapsed?: boolean;
}>();

const { t } = useI18n();

const currentName = computed(() => props.workspaces?.find(({ slug }) => slug === props.current)?.name);
const label = computed(() => (currentName.value
  ? t('workspace.switcher', { name: currentName.value })
  : t('workspace.switcherLoading')));

const items = computed<DropdownMenuItem[][]>(() => [
  (props.workspaces ?? []).map(({ name, slug, role }) => {
    const current = slug === props.current;
    const named = t('workspace.withRole', { name, role: t(`workspace.role.${role}`) });
    return {
      // Said in words, not by the check mark alone.
      label: current ? `${named} ${t('workspace.current')}` : named,
      to: `/w/${slug}/${props.view}`,
      icon: current ? 'i-lucide-check' : 'i-lucide-layers',
      ...(current ? { 'aria-current': 'page' as const } : {}),
    };
  }),
  ...(props.canCreate ? [[{ label: t('workspace.create'), to: '/workspaces/new', icon: 'i-lucide-plus' }]] : []),
]);
</script>

<template>
  <!--
    Not modal: a menu of links, which hiding the rest of the page from screen readers would not help. Rendered in
    place, so it stays in the sidebar's landmark (RGAA 12.6).
  -->
  <UDropdownMenu
    :items="items"
    :content="{ align: 'start' }"
    :modal="false"
    :portal="false"
  >
    <UTooltip
      :text="label"
      :disabled="!collapsed"
    >
      <UButton
        :aria-label="label"
        :aria-busy="workspaces === null ? 'true' : undefined"
        :label="collapsed ? undefined : currentName ?? t('workspace.switcherLoading')"
        icon="i-lucide-layers"
        :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
        color="neutral"
        variant="ghost"
        :block="!collapsed"
        :square="collapsed"
        :ui="{ trailingIcon: 'ms-auto text-dimmed' }"
      />
    </UTooltip>
  </UDropdownMenu>
</template>
