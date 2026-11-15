<script setup lang="ts">
import type { ServiceInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

/** The service form of the inventory. */
defineProps<EntityFormProps>();
defineEmits<{ submit: [values: ServiceInput]; dirty: [dirty: boolean] }>();
</script>

<template>
  <div />
</template>
