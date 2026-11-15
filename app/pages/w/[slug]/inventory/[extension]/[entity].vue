<script setup lang="ts">
import { FetchError } from 'ofetch';

import type { Problem } from '#shared/contracts/errors';
import type { InventoryColumn } from '@stackmap/extension-sdk';
import type { Component } from 'vue';
import type { FormIssues } from '~/composables/useEntityForm';
import type { InstalledExtension } from '~/extensions/inventory';
import type { InventoryQuery } from '~/utils/inventory-query';
import type { EntityRow } from '~/utils/inventory-rows';

import { entityPatch, formValues, problemIssues } from '~/composables/useEntityForm';
import { useExtensionLabels, useExtensions } from '~/composables/useExtensions';
import { findInventoryType, inventoryTypes } from '~/extensions/inventory';
import { cellText, valueText } from '~/utils/inventory-cells';
import { inventoryQueryToUrl, parseInventoryQuery } from '~/utils/inventory-query';

/** The rows a table loads at most: the API's page limit (sorting and search happen in the browser). */
const LIMIT = 1000;
const WRITERS = new Set(['editor', 'admin', 'owner']);
const noIssues = (): FormIssues => ({ fields: {}, summary: [] });

const i18n = useI18n();
const { t, locale } = i18n;
const route = useRoute();
const router = useRouter();
const { session, signOut } = useAccount();
const { workspaces, refresh: refreshWorkspaces } = useWorkspaces();
const { error: extensionsError, retry: retryExtensions } = useExtensions();
const installed = useState<InstalledExtension[]>('extensions', () => []);
const labels = useExtensionLabels();

const slug = computed(() => String(route.params.slug));
const workspace = computed(() => workspaces.value?.find((candidate) => candidate.slug === slug.value));
const canCreate = computed(() => session.value?.user.role === 'admin');
const canEdit = computed(() => WRITERS.has(workspace.value?.role ?? ''));

const types = computed(() => inventoryTypes(installed.value));
const type = computed(() => findInventoryType(
  types.value, String(route.params.extension), String(route.params.entity),
));
const notFound = computed(() => installed.value.length > 0 && !type.value);
const typeLabel = computed(() => (type.value ? labels.entityLabel(type.value.extension, type.value.entity) : ''));
const pluralLabel = computed(() => (type.value ? labels.entityPlural(type.value.extension, type.value.entity) : ''));
const groups = computed(() => [...new Set(types.value.map(({ extension }) => extension))].map((extension) => ({
  extension,
  label: labels.extensionName(extension),
  types: types.value.filter((candidate) => candidate.extension === extension)
    .map(({ key, extension: owner, entity }) => ({
      key, label: labels.entityPlural(owner, entity), to: `/w/${slug.value}/inventory/${key}`,
    })),
})));

useHead({
  title: () => (notFound.value
    ? [t('inventory.notFound'), t('app.name')]
    : [pluralLabel.value, workspace.value?.name, t('app.name')]).filter(Boolean).join(' · '),
});

// The table's state lives in the URL, so that a reload or a shared link keeps it.
const query = computed(() => parseInventoryQuery(route.query, type.value?.columns.map(({ field }) => field) ?? []));
const setQuery = (next: InventoryQuery) => {
  void router.replace({ query: inventoryQueryToUrl(next) });
};

/** Every type the page shows or names, loaded once each: the type itself and those it refers to. */
const lists = ref<Record<string, { items: EntityRow[]; total: number } | 'error'>>({});
const base = computed(() => (workspace.value ? `/api/workspaces/${workspace.value.id}/entities` : ''));
const load = async (key: string) => {
  try {
    lists.value[key] = await $fetch<{ items: EntityRow[]; total: number }>(`${base.value}/${key}`, { query: { limit: LIMIT } });
  } catch {
    lists.value[key] = 'error';
  }
};
const needed = computed(() => {
  if (!type.value) {
    return [];
  }
  // One level further, so that a referenced listener is named by its service.
  const direct = type.value.references;
  const further = direct.flatMap((key) => types.value.find((candidate) => candidate.key === key)?.references ?? []);
  return [...new Set([type.value.key, ...direct, ...further])];
});
const refresh = (keys: readonly string[] = needed.value) => Promise.all(keys.map(load));
watch([base, needed], ([url, keys]) => {
  if (url) {
    lists.value = {};
    void refresh(keys);
  }
}, { immediate: true });

const current = computed(() => (type.value ? lists.value[type.value.key] : undefined));
const entities = computed(() => (current.value && current.value !== 'error' ? current.value.items : null));

/** An entity's name: its type's title, or its first column's value. */
const nameIn = (key: string, entity: EntityRow): string => {
  const owner = types.value.find((candidate) => candidate.key === key);
  const [first] = owner?.columns ?? [];

  return owner?.title?.(entity, nameOf) ?? (first ? valueText(entity[first.field]) : entity.id);
};
const nameOf = (key: string, id: unknown): string => {
  const list = lists.value[key];
  const found = list && list !== 'error' ? list.items.find((item) => item.id === id) : undefined;
  return found ? nameIn(key, found) : '';
};
const display = (entity: EntityRow, column: InventoryColumn): string => cellText(entity, column, {
  t, locale: locale.value, name: nameOf, kindLabel: (...args) => labels.kindLabel(...args),
});
const name = (entity: EntityRow) => (type.value ? nameIn(type.value.key, entity) : entity.id);
const kindColumn = computed(() => type.value?.columns.find(({ format, field }) => format === 'kind' && field === 'kind'));
const references = computed(() => Object.fromEntries(Object.entries(lists.value).flatMap(([key, list]) => (list === 'error'
  ? []
  : [[key, list.items.map((item) => ({ id: item.id, label: nameIn(key, item) }))
      .sort((a, b) => a.label.localeCompare(b.label, locale.value, { numeric: true }))]]))));

const template = useTemplateRef<{ focusHeading: () => void }>('template');
const table = useTemplateRef<{ focusRow: (id: string) => void; focusNew: () => void }>('table');
const notice = ref('');
const announce = (message: string) => {
  // Emptied first, so the same message twice is announced again.
  notice.value = '';
  void nextTick(() => {
    notice.value = message;
  });
};

// Loaded with the type, so that the form is there when the slide-over opens and takes the focus.
const form = shallowRef<Component | null>(null);
watch(type, async (current) => {
  form.value = current ? await current.form() : null;
}, { immediate: true });
/**
 * What happens once the slide-over or the dialog has closed: focus moves (the saved row, New, the heading), then the
 * outcome is announced. Not before: while they are open, the page is hidden from assistive technologies, which do not
 * read announcements made there.
 */
let afterClose: (() => void) | null = null;
const onCloseAutoFocus = (event: Event) => {
  if (afterClose) {
    event.preventDefault();
    afterClose();
    afterClose = null;
  }
};
const panel = reactive({
  open: false,
  mode: 'new',
  entity: undefined as EntityRow | undefined,
  issues: noIssues(),
  state: null as 'changed' | 'gone' | 'network' | 'forbidden' | null,
  saving: false,
  dirty: false,
  // Remounts the form for each opening: it starts from the entity, or empty.
  key: 0,
});
const formId = computed(() => `${type.value?.entity ?? 'entity'}-form`);
const panelTitle = computed(() => {
  if (panel.mode === 'new') {
    return t('inventory.new', { type: typeLabel.value });
  }
  const entityName = panel.entity ? name(panel.entity) : '';
  return panel.mode === 'edit' ? t('inventory.edit', { name: entityName }) : entityName;
});
const openPanel = (mode: 'new' | 'edit' | 'view', entity?: EntityRow) => {
  Object.assign(panel, {
    open: true, mode, entity, issues: noIssues(), state: null, saving: false, dirty: false,
  });
  panel.key += 1;
};

const problemOf = (failure: unknown): Problem | undefined =>
  (failure instanceof FetchError ? failure.data as Problem | undefined : undefined);

const save = async (values: Record<string, unknown>) => {
  if (!type.value || panel.saving) {
    return;
  }
  const url = `${base.value}/${type.value.key}`;
  const editing = panel.mode === 'edit' ? panel.entity : undefined;
  const body = editing ? entityPatch(formValues(values, editing), values) : values;
  if (body === null) {
    panel.open = false;
    return;
  }
  panel.saving = true;
  panel.issues = noIssues();
  panel.state = null;
  try {
    const saved = editing
      ? await $fetch<EntityRow>(`${url}/${editing.id}`, { method: 'PATCH', body })
      : await $fetch<EntityRow>(url, { method: 'POST', body });
    await refresh();
    await nextTick();
    const outcome = t(editing ? 'inventory.saved' : 'inventory.created', { name: name(saved) });
    panel.dirty = false;
    afterClose = () => {
      if (editing) {
        table.value?.focusRow(saved.id);
      } else {
        table.value?.focusNew();
      }
      announce(outcome);
    };
    panel.open = false;
  } catch (failure) {
    const problem = problemOf(failure);
    if (problem?.code === 'entity_changed') {
      panel.state = 'changed';
    } else if (problem?.code === 'entity_not_found') {
      panel.state = 'gone';
      void refresh();
    } else if (failure instanceof FetchError && failure.status === 403) {
      panel.state = 'forbidden';
      void refreshWorkspaces();
    } else if (problem && ['entity_invalid', 'entity_conflict', 'reference_invalid'].includes(problem.code)) {
      panel.issues = problemIssues(problem, { fields: Object.keys(values), t, te: (key) => i18n.te(key) });
      if (problem.code === 'reference_invalid') {
        void refresh();
      }
    } else {
      panel.state = 'network';
    }
  } finally {
    panel.saving = false;
  }
};

const reload = async () => {
  if (!type.value || !panel.entity) {
    return;
  }
  try {
    panel.entity = await $fetch<EntityRow>(`${base.value}/${type.value.key}/${panel.entity.id}`);
    panel.state = null;
    panel.issues = noIssues();
  } catch (failure) {
    panel.state = problemOf(failure)?.code === 'entity_not_found' ? 'gone' : 'network';
  }
};

const removal = reactive({
  open: false,
  entity: undefined as EntityRow | undefined,
  busy: false,
  failed: false,
  inUse: null as { label: string; count: number }[] | 'unknown' | null,
});
const askRemove = (entity: EntityRow) => {
  Object.assign(removal, { open: true, entity, busy: false, failed: false, inUse: null });
};
/** Closes the dialog; once closed, the focus goes to the heading (the row is gone) and the outcome is announced. */
const closeRemoval = (outcome: string) => {
  afterClose = () => {
    template.value?.focusHeading();
    announce(outcome);
  };
  removal.open = false;
};
const remove = async () => {
  const entity = removal.entity;
  if (!type.value || !entity) {
    return;
  }
  removal.busy = true;
  removal.failed = false;
  try {
    // The type's key holds a slash: typed as any URL, not as the list's route.
    await $fetch<unknown, string>(`${base.value}/${type.value.key}/${entity.id}`, { method: 'DELETE' });
    await refresh();
    closeRemoval(t('inventory.deleted', { name: name(entity) }));
  } catch (failure) {
    const problem = problemOf(failure);
    if (problem?.code === 'entity_in_use') {
      const dependents = problem.dependents ?? [];
      removal.inUse = dependents.length === 0
        ? 'unknown'
        : dependents.map(({ extension, entity: dependent, count }) => ({
            label: count === 1 ? labels.entityLabel(extension, dependent) : labels.entityPlural(extension, dependent),
            count,
          }));
    } else if (problem?.code === 'entity_not_found') {
      await refresh();
      closeRemoval(t('inventory.alreadyDeleted'));
    } else {
      // Said in the dialog, which stays open to try again.
      removal.failed = true;
    }
  } finally {
    removal.busy = false;
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
    <InventoryTemplate
      ref="template"
      :groups="groups"
      :current="type?.key"
      :title="notFound ? t('inventory.notFound') : pluralLabel || t('inventory.title')"
      :not-found="notFound"
      :back-to="`/w/${slug}/inventory`"
    >
      <div
        v-if="extensionsError && installed.length === 0"
        role="alert"
        class="flex flex-wrap items-center gap-3"
      >
        <p>{{ t('inventory.extensionsFailed') }}</p>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          @click="retryExtensions"
        >
          {{ t('inventory.retry') }}
        </UButton>
      </div>
      <p
        v-else-if="installed.length === 0"
        role="status"
        class="text-muted"
      >
        {{ t('inventory.loading') }}
      </p>
      <EntityTable
        v-else-if="type"
        ref="table"
        :type-label="typeLabel"
        :plural-label="pluralLabel"
        :columns="type.columns"
        :entities="entities"
        :total="current && current !== 'error' ? current.total : 0"
        :error="current === 'error'"
        :query="query"
        :display="display"
        :name="name"
        :kind-field="kindColumn?.field"
        :kind-entity="kindColumn?.kind"
        :can-edit="canEdit"
        :notice="notice"
        @update:query="setQuery"
        @create="openPanel('new')"
        @edit="openPanel('edit', $event)"
        @open="openPanel('view', $event)"
        @remove="askRemove"
        @retry="refresh()"
      />
    </InventoryTemplate>
    <EntitySlideover
      v-model:open="panel.open"
      :title="panelTitle"
      :type-label="typeLabel"
      :form-id="formId"
      :readonly="panel.mode === 'view'"
      :saving="panel.saving"
      :dirty="panel.dirty"
      :summary="panel.issues.summary.concat(Object.entries(panel.issues.fields)
        .flatMap(([path, messages]) => messages.map((message) => ({ path, message }))))"
      :state="panel.state"
      @reload="reload"
      @close-auto-focus="onCloseAutoFocus"
    >
      <component
        :is="form"
        v-if="form"
        :key="panel.key"
        :form-id="formId"
        :entity="panel.entity"
        :issues="panel.issues.fields"
        :readonly="panel.mode === 'view'"
        :references="references"
        @submit="save"
        @dirty="panel.dirty = $event"
      />
    </EntitySlideover>
    <DeleteEntityDialog
      v-model:open="removal.open"
      :name="removal.entity ? name(removal.entity) : ''"
      :busy="removal.busy"
      :failed="removal.failed"
      :in-use="removal.inUse"
      @confirm="remove"
      @close-auto-focus="onCloseAutoFocus"
    />
  </AppShell>
</template>
