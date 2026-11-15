<script setup lang="ts">
/** A searchable select of the entities a field can refer to, by name; None when the field is nullable. */
defineProps<{
  /** The field's id, for the error summary's links. */
  id: string;
  label: string;
  modelValue: string | null;
  items: { id: string; label: string }[];
  nullable: boolean;
  required: boolean;
  errors: string[];
  readonly: boolean;
}>();
defineEmits<{ 'update:modelValue': [value: string | null] }>();
</script>

<template>
  <div />
</template>
