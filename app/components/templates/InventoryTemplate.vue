<script setup lang="ts">
export interface InventoryNavGroup {
  extension: string;
  /** The extension's translated name. */
  label: string;
  types: { key: string; label: string; to: string }[];
}

/** The inventory's layout: the type navigation, grouped by extension, beside the current type's table. */
defineProps<{
  groups: InventoryNavGroup[];
  /** `<extension>/<entity>` of the type shown. */
  current?: string;
  title: string;
  notFound: boolean;
  backTo: string;
}>();
</script>

<template>
  <div />
</template>
