<script setup lang="ts">
/** An item of the orphans list, named by the page as the inventory names it. */
export interface OrphanItem {
  entity: string;
  id: string;
  name: string;
  type: string;
}

/** The hidden entities of a turned-off extension that connect to nothing: a count, and for admins delete or keep. */
defineProps<{
  extension: string;
  /** Null while loading. */
  items: OrphanItem[] | null;
  truncated: boolean;
  failed: boolean;
  canManage: boolean;
  /** The id of the entity being changed. */
  busy: string | null;
}>();
defineEmits<{ delete: [item: OrphanItem]; keep: [item: OrphanItem]; retry: [] }>();
</script>

<template>
  <div />
</template>
