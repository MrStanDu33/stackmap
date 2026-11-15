<script setup lang="ts">
import type { EntityLink } from '@stackmap/extension-sdk/entities';

export interface CommonValues {
  status: string;
  tags: string[];
  notes: string;
  links: EntityLink[];
}

/** The fields every entity has, in every inventory form: status, tags, notes and links; origin when imported. */
defineProps<{
  formId: string;
  modelValue: CommonValues;
  /** Translated messages by field path: `links.0.url`. */
  issues: Record<string, string[]>;
  readonly: boolean;
  origin: string;
  externalRef: string | null;
}>();
defineEmits<{ 'update:modelValue': [value: CommonValues] }>();
</script>

<template>
  <div />
</template>
