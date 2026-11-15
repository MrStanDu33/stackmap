<script setup lang="ts">
import type { SiteInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

/** The site form of the inventory. */
defineProps<EntityFormProps>();
defineEmits<{ submit: [values: SiteInput]; dirty: [dirty: boolean] }>();
</script>

<template>
  <div />
</template>
