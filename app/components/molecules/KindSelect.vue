<script setup lang="ts">
import { useExtensionLabels } from '../../composables/useExtensions';

import type { KindEntity } from '@stackmap/extension-sdk';

/** A select of an entity's kinds from the active extensions, translated, with their icons. */
const props = defineProps<{
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
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const { t } = useI18n();
const labels = useExtensionLabels();
// The select refuses empty and null values: None is a value no kind id can be (kebab-case) inside, null outside.
const NONE = '(none)';
const options = computed(() => {
  const kinds = labels.kindOptions(props.entity);
  // A kind no enabled extension provides is kept, said unavailable under its name if known, so saving keeps it.
  const unavailable = props.modelValue && !kinds.some(({ value }) => value === props.modelValue)
    ? [{ value: props.modelValue, label: t('inventory.unavailable', { id: labels.kindLabel(props.entity, props.modelValue) }) }]
    : [];
  return [...(props.nullable ? [{ value: NONE, label: t('inventory.none') }] : []), ...kinds, ...unavailable];
});
const selected = computed({
  get: () => props.modelValue || (props.nullable ? NONE : undefined),
  set: (value: string | undefined) => { emit('update:modelValue', value === NONE || value === undefined ? null : value); },
});
</script>

<template>
  <EntityField
    :label="label"
    :required="required"
    :errors="errors"
  >
    <!-- Read-only, the kind's name as read-only text: reachable and at full contrast, unlike a disabled select. -->
    <UInput
      v-if="readonly"
      :id="id"
      :model-value="options.find(({ value }) => value === selected)?.label ?? ''"
      readonly
      class="w-full"
    />
    <USelect
      v-else
      :id="id"
      v-model="selected"
      :items="options"
      value-key="value"
      class="w-full"
    />
  </EntityField>
</template>
