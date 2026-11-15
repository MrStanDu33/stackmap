<script setup lang="ts">
import { ENTITY_STATUSES } from '@stackmap/extension-sdk/entities';

import { useExtensionLabels } from '../../composables/useExtensions';
import { DEFAULT_INVENTORY_QUERY } from '../../utils/inventory-query';
import { inventoryRows } from '../../utils/inventory-rows';

import type { InventoryQuery } from '../../utils/inventory-query';
import type { EntityRow } from '../../utils/inventory-rows';
import type { InventoryColumn, KindEntity } from '@stackmap/extension-sdk';
import type { EntityStatus } from '@stackmap/extension-sdk/entities';

/**
 * One entity type's table: search, status and kind filters, sortable columns, pages of 50, and each row's actions
 * for editors. It sorts, searches and pages in the browser; the page holds the query in the URL.
 */
const props = defineProps<{
  typeLabel: string;
  pluralLabel: string;
  columns: readonly InventoryColumn[];
  /** `null` while loading. */
  entities: EntityRow[] | null;
  /** How many the workspace has: more than the entities when over the 1000 loaded. */
  total: number;
  error: boolean;
  query: InventoryQuery;
  display: (entity: EntityRow, column: InventoryColumn) => string;
  /** An entity's name in actions and announcements; its first column's text by default. */
  name?: (entity: EntityRow) => string;
  kindField?: string;
  kindEntity?: KindEntity;
  canEdit: boolean;
  /** An outcome to announce: "nas saved". */
  notice: string;
}>();
const emit = defineEmits<{
  'update:query': [query: InventoryQuery];
  create: [];
  open: [entity: EntityRow];
  edit: [entity: EntityRow];
  remove: [entity: EntityRow];
  retry: [];
}>();

const { t, locale } = useI18n();
const labels = useExtensionLabels();
const root = useTemplateRef<HTMLElement>('root');

const ALL = '(all)';
const nameOf = (entity: EntityRow) => {
  const [first] = props.columns;
  return props.name?.(entity) ?? (first ? props.display(entity, first) : entity.id);
};
const sortField = computed(() => props.query.sort ?? props.columns[0]?.field ?? null);
const filtering = computed(() => Boolean(props.query.q)
  || props.query.status.length > 0
  || props.query.kind.length > 0);
const result = computed(() => inventoryRows(props.entities ?? [], {
  columns: props.columns,
  query: props.query,
  locale: locale.value,
  display: props.display,
  ...(props.kindField ? { kindField: props.kindField } : {}),
}));

const set = (change: Partial<InventoryQuery>) => {
  emit('update:query', { ...props.query, page: 1, ...change });
};
const sortBy = (field: string) => {
  set(field === sortField.value
    ? { sort: field, dir: props.query.dir === 'asc' ? 'desc' : 'asc' }
    : { sort: field, dir: 'asc' });
};
const ariaSort = (field: string) => {
  if (field !== sortField.value) {
    return undefined;
  }
  return props.query.dir === 'desc' ? 'descending' : 'ascending';
};

const statusItems = computed(() => [
  { value: ALL, label: t('inventory.all') },
  ...ENTITY_STATUSES.map((value) => ({ value, label: t(`inventory.status.${value}`) })),
]);
const kindItems = computed(() => (props.kindEntity
  ? [{ value: ALL, label: t('inventory.all') }, ...labels.kindOptions(props.kindEntity)]
  : []));
const status = computed({
  get: () => props.query.status[0] ?? ALL,
  set: (value: string) => { set({ status: value === ALL ? [] : [value as EntityStatus] }); },
});
const kind = computed({
  get: () => props.query.kind[0] ?? ALL,
  set: (value: string) => { set({ kind: value === ALL ? [] : [value] }); },
});

const updated = (entity: EntityRow) => {
  const date = typeof entity.updatedAt === 'string' ? new Date(entity.updatedAt) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '';
};
const count = (value: number) => new Intl.NumberFormat(locale.value).format(value);
// An outcome is said once: a search afterwards announces its results, not the outcome again.
const notice = ref(props.notice);
watch(() => props.notice, (value) => {
  notice.value = value;
});
watch(() => props.query, () => {
  notice.value = '';
}, { deep: true });
const announcement = computed(() => [
  notice.value,
  filtering.value && props.entities
    ? t('inventory.results', { count: count(result.value.matching) }, result.value.matching)
    : '',
].filter(Boolean).join(' '));

const focusSearch = () => root.value?.querySelector<HTMLElement>('input[type="search"]')?.focus();
// Clear goes away with what it cleared: the focus goes to the search.
const clear = async () => {
  emit('update:query', { ...DEFAULT_INVENTORY_QUERY });
  await nextTick();
  focusSearch();
};

defineExpose({
  /** The row's Edit button, after its edit was saved. */
  focusRow: (id: string) => {
    const row = root.value?.querySelector<HTMLElement>(`[data-edit="${CSS.escape(id)}"]`);
    // Not shown (another page, filtered out): New, or the search for viewers, rather than nowhere.
    const fallback = root.value?.querySelector<HTMLElement>('[data-new]');
    if (row) {
      row.focus();
    } else if (fallback) {
      fallback.focus();
    } else {
      focusSearch();
    }
  },
  /** The toolbar's New button, after a creation. */
  focusNew: () => root.value?.querySelector<HTMLElement>('[data-new]')?.focus(),
});
</script>

<template>
  <div
    ref="root"
    class="flex flex-col gap-4"
  >
    <div
      role="status"
      class="sr-only"
    >
      {{ announcement }}
    </div>
    <div class="flex flex-wrap items-end gap-3">
      <UFormField
        :label="t('inventory.search')"
        class="min-w-48 flex-1"
      >
        <UInput
          type="search"
          icon="i-lucide-search"
          :model-value="query.q"
          class="w-full"
          @update:model-value="set({ q: String($event) })"
        />
      </UFormField>
      <UFormField :label="t('inventory.filterStatus')">
        <USelect
          v-model="status"
          :items="statusItems"
          value-key="value"
          class="min-w-36"
        />
      </UFormField>
      <UFormField
        v-if="kindEntity"
        :label="t('inventory.filterKind')"
      >
        <USelect
          v-model="kind"
          :items="kindItems"
          value-key="value"
          class="min-w-40"
        />
      </UFormField>
      <!-- Without entities, the empty state offers it instead. -->
      <UButton
        v-if="canEdit && entities?.length !== 0"
        data-new
        icon="i-lucide-plus"
        @click="emit('create')"
      >
        {{ t('inventory.new', { type: typeLabel }) }}
      </UButton>
    </div>

    <div
      v-if="error"
      role="alert"
      class="flex flex-wrap items-center gap-3"
    >
      <p>{{ t('inventory.loadFailed') }}</p>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        @click="emit('retry')"
      >
        {{ t('inventory.retry') }}
      </UButton>
    </div>
    <div
      v-else-if="entities === null"
      class="flex flex-col gap-2"
    >
      <span class="sr-only">{{ t('inventory.loading', { type: pluralLabel }) }}</span>
      <USkeleton
        v-for="line in 4"
        :key="line"
        class="h-8 w-full"
      />
    </div>
    <div
      v-else-if="entities.length === 0"
      class="flex flex-col items-start gap-3"
    >
      <p>{{ t('inventory.empty', { type: pluralLabel }) }}</p>
      <UButton
        v-if="canEdit"
        icon="i-lucide-plus"
        @click="emit('create')"
      >
        {{ t('inventory.new', { type: typeLabel }) }}
      </UButton>
    </div>
    <div
      v-else-if="result.matching === 0"
      class="flex flex-col items-start gap-3"
    >
      <p>{{ t('inventory.noMatch') }}</p>
      <UButton
        color="neutral"
        variant="outline"
        @click="clear"
      >
        {{ t('inventory.clear') }}
      </UButton>
    </div>
    <template v-else>
      <p
        v-if="total > entities.length"
        class="text-sm text-muted"
      >
        {{ t('inventory.truncated', { shown: count(entities.length), total: count(total) }) }}
      </p>
      <!-- Scrolls on its own on narrow screens; focusable and named so that keyboard users can scroll it. -->
      <div
        class="overflow-x-auto"
        tabindex="0"
        role="region"
        :aria-label="pluralLabel"
      >
        <table class="w-full border-collapse text-sm">
          <caption class="sr-only">
            {{ pluralLabel }}
          </caption>
          <thead>
            <tr class="border-b border-default text-start">
              <th
                v-for="column in columns"
                :key="column.field"
                scope="col"
                :aria-sort="ariaSort(column.field)"
                class="px-2 py-2 text-start font-medium"
              >
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-sm hover:text-primary
                    focus-visible:outline-2 focus-visible:outline-primary"
                  @click="sortBy(column.field)"
                >
                  {{ t(column.label) }}
                  <UIcon
                    v-if="ariaSort(column.field)"
                    :name="query.dir === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up'"
                    aria-hidden="true"
                  />
                </button>
              </th>
              <th
                scope="col"
                class="px-2 py-2 text-start font-medium"
              >
                {{ t('inventory.lastUpdated') }}
              </th>
              <th
                scope="col"
                class="px-2 py-2 text-start font-medium"
              >
                {{ t('inventory.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entity in result.rows"
              :key="entity.id"
              class="border-b border-default"
            >
              <td
                v-for="column in columns"
                :key="column.field"
                class="max-w-80 px-2 py-2 [overflow-wrap:anywhere]"
              >
                {{ display(entity, column) }}
              </td>
              <td class="px-2 py-2 whitespace-nowrap text-muted">
                {{ updated(entity) }}
              </td>
              <td class="px-2 py-1 whitespace-nowrap">
                <template v-if="canEdit">
                  <UButton
                    :data-edit="entity.id"
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    :aria-label="t('inventory.edit', { name: nameOf(entity) })"
                    @click="emit('edit', entity)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    :aria-label="t('inventory.delete', { name: nameOf(entity) })"
                    @click="emit('remove', entity)"
                  />
                </template>
                <UButton
                  v-else
                  icon="i-lucide-eye"
                  color="neutral"
                  variant="ghost"
                  :aria-label="t('inventory.view', { name: nameOf(entity) })"
                  @click="emit('open', entity)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <UPagination
        v-if="result.pages > 1"
        :page="result.page"
        :total="result.matching"
        :items-per-page="50"
        :aria-label="t('inventory.pagination')"
        @update:page="emit('update:query', { ...query, page: $event })"
      />
    </template>
  </div>
</template>
