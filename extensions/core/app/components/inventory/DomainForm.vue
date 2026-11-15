<script setup lang="ts">
import type { DomainInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

/** The domain form of the inventory. */
defineProps<EntityFormProps>();
defineEmits<{ submit: [values: DomainInput]; dirty: [dirty: boolean] }>();
</script>

<template>
  <div />
</template>
