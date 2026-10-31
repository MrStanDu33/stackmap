<script setup lang="ts">
/** Chooses between the graph and its accessible list. */
defineProps<{ modelValue: 'graph' | 'list' }>();
defineEmits<{ 'update:modelValue': [view: 'graph' | 'list'] }>();
</script>

<template>
  <div />
</template>
