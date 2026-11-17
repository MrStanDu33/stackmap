<script setup lang="ts">
import type { PaletteGroup, PaletteItem } from '../../utils/palette';

/** The command palette: a search field over groups of results, in a dialog. */
defineProps<{
  open: boolean;
  groups: PaletteGroup[];
  /** Results are being fetched. */
  loading?: boolean;
}>();
defineEmits<{ 'update:open': [open: boolean]; select: [item: PaletteItem, group: PaletteGroup] }>();
defineModel<string>('searchTerm', { default: '' });
</script>

<template>
  <div />
</template>
