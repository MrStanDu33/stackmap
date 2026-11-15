<script setup lang="ts">
import type { InventoryQuery } from '../../utils/inventory-query';
import type { EntityRow } from '../../utils/inventory-rows';
import type { InventoryColumn, KindEntity } from '@stackmap/extension-sdk';

/**
 * One entity type's table: search, status and kind filters, sortable columns, pages of 50, and each row's actions
 * for editors. It sorts, searches and pages in the browser; the page holds the query in the URL.
 */
defineProps<{
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
  kindField?: string;
  kindEntity?: KindEntity;
  canEdit: boolean;
  /** An outcome to announce: "nas saved". */
  notice: string;
}>();
defineEmits<{
  'update:query': [query: InventoryQuery];
  create: [];
  open: [entity: EntityRow];
  edit: [entity: EntityRow];
  remove: [entity: EntityRow];
  retry: [];
}>();

defineExpose({ focusHeading: () => undefined, focusRow: (_id: string) => undefined, focusNew: () => undefined });
</script>

<template>
  <div />
</template>
