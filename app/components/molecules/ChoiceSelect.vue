<script setup lang="ts">
/**
 * A select of fixed choices; read-only, the chosen label as read-only text, which stays reachable and at full
 * contrast where a disabled select would not.
 */
const props = defineProps<{
  id: string;
  modelValue: string;
  items: { value: string; label: string }[];
  readonly: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const label = computed(() => props.items.find(({ value }) => value === props.modelValue)?.label ?? props.modelValue);
</script>

<template>
  <UInput
    v-if="readonly"
    :id="id"
    :model-value="label"
    readonly
    class="w-full"
  />
  <USelect
    v-else
    :id="id"
    :model-value="modelValue"
    :items="items"
    value-key="value"
    class="w-full"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
