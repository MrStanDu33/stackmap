<script setup lang="ts">
import type { FlowInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

/** The flow form of the inventory. */
defineProps<EntityFormProps>();
defineEmits<{ submit: [values: FlowInput]; dirty: [dirty: boolean] }>();
</script>

<template>
  <div />
</template>
