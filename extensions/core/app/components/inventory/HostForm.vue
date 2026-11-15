<script setup lang="ts">
import type { HostInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

/** The host form of the inventory. */
defineProps<EntityFormProps>();
defineEmits<{ submit: [values: HostInput]; dirty: [dirty: boolean] }>();
</script>

<template>
  <div />
</template>
