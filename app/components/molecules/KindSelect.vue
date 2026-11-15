<script setup lang="ts">
import type { KindEntity } from '@stackmap/extension-sdk';

/** A select of an entity's kinds from the active extensions, translated, with their icons. */
defineProps<{
  id: string;
  label: string;
  entity: KindEntity;
  modelValue: string | null;
  required: boolean;
  /** Offers None first, which sends `null`. */
  nullable?: boolean;
  errors: string[];
  readonly: boolean;
}>();
defineEmits<{ 'update:modelValue': [value: string | null] }>();
</script>

<template>
  <div />
</template>
