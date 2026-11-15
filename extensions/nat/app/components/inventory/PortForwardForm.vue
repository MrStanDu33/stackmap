<script setup lang="ts">
import type { PortForwardInput } from '@stackmap/extension-nat/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

/** The port forward form of the inventory: host, external address and port, transport, internal address and port. */
defineProps<EntityFormProps>();
defineEmits<{ submit: [values: PortForwardInput]; dirty: [dirty: boolean] }>();
</script>

<template>
  <form
    :id="formId"
    novalidate
  />
</template>
