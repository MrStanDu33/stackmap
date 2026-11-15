<script setup lang="ts">
import type { ListenerInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

/** The listener form of the inventory. */
defineProps<EntityFormProps>();
defineEmits<{ submit: [values: ListenerInput]; dirty: [dirty: boolean] }>();
</script>

<template>
  <div />
</template>
