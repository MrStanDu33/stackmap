<script setup lang="ts">
/** A searchable select of the entities a field can refer to, by name; None when the field is nullable. */
const props = defineProps<{
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
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const { t } = useI18n();
// The menu refuses empty and null values: None is a value no id can be (ids are UUIDs) inside, null outside.
const NONE = '(none)';
// Labelled, not only with a placeholder (Nuxt UI types no aria-label on it; it is passed through).
const searchInput = computed(() => ({ placeholder: t('inventory.search'), 'aria-label': t('inventory.search') }));
const options = computed(() => [
  ...(props.nullable ? [{ label: t('inventory.none'), value: NONE }] : []),
  ...props.items.map(({ id: value, label }) => ({ label, value })),
]);
const selected = computed({
  get: () => props.modelValue ?? (props.nullable ? NONE : undefined),
  set: (value: string | undefined) => { emit('update:modelValue', value === NONE || value === undefined ? null : value); },
});
</script>

<template>
  <EntityField
    :label="label"
    :required="required"
    :errors="errors"
  >
    <!-- A button that opens a searchable list: a combobox, as the select fields are (ARIA 1.2 select-only pattern). -->
    <USelectMenu
      :id="id"
      v-model="selected"
      role="combobox"
      :items="options"
      value-key="value"
      :disabled="readonly"
      :search-input="searchInput"
      class="w-full"
    />
  </EntityField>
</template>
