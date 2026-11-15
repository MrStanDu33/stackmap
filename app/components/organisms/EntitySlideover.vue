<script setup lang="ts">
/**
 * The slide-over an entity is created, edited or read in: its form in the slot, Save and Cancel below it, the error
 * summary and the save's refusals above it, and a question before discarding unsaved changes.
 */
defineProps<{
  open: boolean;
  title: string;
  typeLabel: string;
  /** The slot's form's id: Save submits it, and the summary links to its fields (`<formId>-<path>`). */
  formId: string;
  readonly: boolean;
  saving: boolean;
  dirty: boolean;
  summary: { path: string | null; message: string }[];
  state: 'changed' | 'gone' | 'network' | 'forbidden' | null;
}>();
defineEmits<{ 'update:open': [open: boolean]; reload: [] }>();
</script>

<template>
  <div />
</template>
