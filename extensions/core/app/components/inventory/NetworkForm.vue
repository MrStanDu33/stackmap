<script setup lang="ts">
import type { NetworkInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

/** The network form of the inventory. */
defineProps<EntityFormProps>();
defineEmits<{ submit: [values: NetworkInput]; dirty: [dirty: boolean] }>();
</script>

<template>
  <div />
</template>
