<script setup lang="ts">
/** Chooses between the graph and its accessible list. */
defineProps<{ modelValue: 'graph' | 'list' }>();
defineEmits<{ 'update:modelValue': [view: 'graph' | 'list'] }>();

const { t } = useI18n();
const items = computed(() => [
  { label: t('traffic.graph'), value: 'graph' },
  { label: t('traffic.list'), value: 'list' },
]);
</script>

<template>
  <URadioGroup
    :model-value="modelValue"
    :items="items"
    :aria-label="t('traffic.view')"
    orientation="horizontal"
    variant="table"
    size="sm"
    @update:model-value="$emit('update:modelValue', $event as 'graph' | 'list')"
  />
</template>
