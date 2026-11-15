<script setup lang="ts">
import type { ExtensionImpact, WorkspaceExtension } from '#shared/contracts/extensions';
import type { OrphanItem } from '~/utils/orphan-item';

import { useExtensionLabels, useExtensions } from '~/composables/useExtensions';
import { inventoryTypes } from '~/extensions/inventory';
import { valueText } from '~/utils/inventory-cells';

const { t } = useI18n();
const { session, signOut } = useAccount();
const route = useRoute();
const labels = useExtensionLabels();

const { workspaces, error: workspaceError, refresh: refreshWorkspaces } = useWorkspaces();
const workspace = computed(() => workspaces.value?.find(({ slug }) => slug === route.params.slug));
const noWorkspace = computed(() => workspaces.value?.length === 0);
const notFound = computed(() => Boolean(workspaces.value?.length) && !workspace.value);
const canCreate = computed(() => session.value?.user.role === 'admin');
const canManage = computed(() => workspace.value?.role === 'admin' || workspace.value?.role === 'owner');

// The workspace's list is also what the rest of the app reads for its kinds and types.
const { extensions: loaded, error: extensionsError, retry } = useExtensions(() => workspace.value?.id);
const extensions = computed(() => loaded.value as WorkspaceExtension[] | null);

useHead({
  title: () => (notFound.value
    ? [t('workspace.notFound'), t('app.name')]
    : [t('workspaceExtensions.title'), workspace.value?.name, t('app.name')]).filter(Boolean).join(' · '),
});

const base = computed(() => `/api/workspaces/${workspace.value?.id ?? ''}/extensions`);
const busy = ref<string | null>(null);
const notice = ref('');
const failure = ref('');
const pending = ref<{ id: string; enabled: boolean; changes: ExtensionImpact[] } | null>(null);
// The switch that asked: it gets the focus back once the toggle is done or cancelled; the heading does when it is gone.
let trigger: HTMLElement | null = null;
const heading = useTemplateRef<HTMLElement>('heading');
const refocus = async () => {
  await nextTick();
  (trigger?.isConnected ? trigger : heading.value)?.focus();
};
const retryList = async () => {
  await retry();
  await nextTick();
  heading.value?.focus();
};
const retryWorkspaces = async () => {
  await refreshWorkspaces();
  await nextTick();
  heading.value?.focus();
};

const save = async (id: string, enabled: boolean) => {
  pending.value = null;
  busy.value = id;
  const name = labels.extensionName(id);
  let done = '';
  try {
    await $fetch(`${base.value}/${id}`, { method: 'PUT', body: { enabled } });
    await retry();
    done = t(enabled ? 'workspaceExtensions.turnedOn' : 'workspaceExtensions.turnedOff', { name });
  } catch {
    failure.value = t('workspaceExtensions.saveFailed', { name });
    // A role lowered meanwhile turns the switches into text.
    await refreshWorkspaces();
  } finally {
    busy.value = null;
    await refocus();
    // After the focus moves, so that reading the switch does not cut the announcement off.
    notice.value = done;
  }
};

const toggle = async (id: string, enabled: boolean) => {
  if (busy.value) {
    return;
  }
  trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // Emptied first, so the same message twice is announced again.
  notice.value = '';
  failure.value = '';
  busy.value = id;
  try {
    const { changes } = await $fetch<{ changes: ExtensionImpact[] }>(`${base.value}/${id}/impact`, {
      query: { enabled: String(enabled) },
    });
    busy.value = null;
    // Turning on asks only when it brings dependencies with it.
    if (!enabled || changes.length > 1) {
      pending.value = { id, enabled, changes };
      return;
    }
  } catch {
    busy.value = null;
    failure.value = t('workspaceExtensions.saveFailed', { name: labels.extensionName(id) });
    await refocus();
    return;
  }
  await save(id, enabled);
};

/** The hidden entities of each turned-off extension that connect to nothing, by extension: null while loading. */
type Orphans = { items: { entity: string; id: string; fields: Record<string, unknown> }[]; truncated: boolean };
const orphans = ref<Record<string, Orphans | null | 'error'>>({});
const orphanBusy = ref<string | null>(null);
// Named as the inventory names them, so their types are read even though they are off; their references are on.
const types = computed(() => inventoryTypes((extensions.value ?? [])
  .map((extension) => ({ ...extension, enabled: true }))));
const referenceLists = ref<Record<string, { id: string; [field: string]: unknown }[]>>({});
const entitiesBase = computed(() => `/api/workspaces/${workspace.value?.id ?? ''}/entities`);
const nameIn = (key: string, entity: Record<string, unknown>): string => {
  const owner = types.value.find((candidate) => candidate.key === key);
  const [first] = owner?.columns ?? [];
  return owner?.title?.(entity, nameOf) ?? (first ? valueText(entity[first.field]) : String(entity.id));
};
const nameOf = (key: string, id: unknown): string => {
  const found = referenceLists.value[key]?.find((item) => item.id === id);
  return found ? nameIn(key, found) : '';
};
const loadOrphans = async (id: string) => {
  orphans.value[id] = null;
  try {
    const list = await $fetch<Orphans>(`${base.value}/${id}/orphans`);
    const typeOf = (entity: string) => types.value.find(({ key }) => key === `${id}/${entity}`);
    const references = new Set(list.items.flatMap(({ entity }) => typeOf(entity)?.references ?? []));
    await Promise.all([...references].filter((key) => !referenceLists.value[key]).map(async (key) => {
      referenceLists.value[key] = (await $fetch<{ items: { id: string }[] }>(`${entitiesBase.value}/${key}`, { query: { limit: 1000 } })).items;
    }));
    orphans.value[id] = list;
  } catch {
    orphans.value[id] = 'error';
  }
};
// Whenever the list changes, the turned-off extensions' orphans are read again.
watch(extensions, (list) => {
  orphans.value = {};
  for (const { id } of (list ?? []).filter(({ enabled, state }) => !enabled && state === 'active')) {
    void loadOrphans(id);
  }
}, { immediate: true });
const orphanItems = (id: string): OrphanItem[] | null => {
  const list = orphans.value[id];
  return list && list !== 'error'
    ? list.items.map(({ entity, id: entityId, fields }) => ({
        entity, id: entityId, name: nameIn(`${id}/${entity}`, fields), type: labels.entityLabel(id, entity),
      }))
    : null;
};
const orphansTruncated = (id: string) => {
  const list = orphans.value[id];
  return Boolean(list && list !== 'error' && list.truncated);
};
const actOnOrphan = async (extension: string, item: OrphanItem, action: 'delete' | 'keep') => {
  orphanBusy.value = item.id;
  notice.value = '';
  failure.value = '';
  try {
    const url = `${base.value}/${extension}/orphans/${item.entity}/${item.id}`;
    await (action === 'delete' ? $fetch(url, { method: 'DELETE' }) : $fetch(`${url}/kept`, { method: 'PUT' }));
    const list = orphans.value[extension];
    if (list && list !== 'error') {
      list.items = list.items.filter(({ id }) => id !== item.id);
    }
    notice.value = t(action === 'delete' ? 'workspaceExtensions.orphanDeleted' : 'workspaceExtensions.orphanKept', { name: item.name });
  } catch {
    failure.value = t('workspaceExtensions.orphanFailed', { name: item.name });
  } finally {
    orphanBusy.value = null;
  }
};

const cancel = async (open: boolean) => {
  if (!open) {
    pending.value = null;
    await refocus();
  }
};
</script>

<template>
  <AppShell
    :user="session?.user"
    :workspaces="workspaces"
    :current="workspace?.slug"
    :can-create="canCreate"
    @sign-out="signOut"
  >
    <h1
      ref="heading"
      tabindex="-1"
      class="text-2xl font-semibold outline-none focus-visible:outline-2 focus-visible:outline-primary"
    >
      {{ t('workspaceExtensions.title') }}
    </h1>

    <div
      v-if="workspaceError"
      role="alert"
      class="flex flex-col items-start gap-3 rounded-md border border-error p-4"
    >
      <p>{{ t('workspaceExtensions.loadFailed') }}</p>
      <UButton
        icon="i-lucide-refresh-cw"
        @click="retryWorkspaces"
      >
        {{ t('workspaceExtensions.retry') }}
      </UButton>
    </div>

    <NoWorkspace
      v-else-if="noWorkspace"
      :can-create="canCreate"
    />

    <div
      v-else-if="notFound"
      class="flex flex-col items-start gap-2 rounded-md border border-default p-6"
    >
      <h2 class="text-lg font-semibold">
        {{ t('workspace.notFound') }}
      </h2>
      <p class="text-muted">
        {{ t('workspace.notFoundHint') }}
      </p>
    </div>

    <template v-else>
      <p class="text-muted">
        {{ t('workspaceExtensions.intro') }}
      </p>
      <p
        role="status"
        class="sr-only"
      >
        {{ notice }}
      </p>
      <p
        v-if="failure"
        role="alert"
        class="text-error"
      >
        {{ failure }}
      </p>
      <ExtensionsList
        :extensions="extensions"
        :failed="Boolean(extensionsError)"
        :can-manage="canManage"
        :busy="busy"
        @toggle="toggle"
        @retry="retryList"
      >
        <template #details="{ extension }">
          <HiddenOrphans
            v-if="!extension.enabled && extension.state === 'active'"
            :extension="extension.id"
            :items="orphanItems(extension.id)"
            :truncated="orphansTruncated(extension.id)"
            :failed="orphans[extension.id] === 'error'"
            :can-manage="canManage"
            :busy="orphanBusy"
            @delete="(item) => actOnOrphan(extension.id, item, 'delete')"
            @keep="(item) => actOnOrphan(extension.id, item, 'keep')"
            @retry="loadOrphans(extension.id)"
            @empty="heading?.focus()"
          />
        </template>
      </ExtensionsList>
      <ExtensionToggleConfirm
        v-if="pending"
        :open="true"
        :extension="pending.id"
        :enabled="pending.enabled"
        :changes="pending.changes"
        @confirm="save(pending.id, pending.enabled)"
        @update:open="cancel"
      />
    </template>
  </AppShell>
</template>
