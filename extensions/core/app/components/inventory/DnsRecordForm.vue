<script setup lang="ts">
import type { DnsRecordInput } from '@stackmap/extension-core/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

/** The DNS record form of the inventory. */
defineProps<EntityFormProps>();
defineEmits<{ submit: [values: DnsRecordInput]; dirty: [dirty: boolean] }>();
</script>

<template>
  <div />
</template>
