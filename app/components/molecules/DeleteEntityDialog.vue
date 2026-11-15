<script setup lang="ts">
/** Asks before deleting an entity; after a refusal, lists what still uses it instead. */
defineProps<{
  open: boolean;
  name: string;
  busy: boolean;
  /** The dependents a refusal named, `unknown` when it named none, `null` before any refusal. */
  inUse: { label: string; count: number }[] | 'unknown' | null;
}>();
defineEmits<{ 'update:open': [open: boolean]; confirm: [] }>();
</script>

<template>
  <div />
</template>
