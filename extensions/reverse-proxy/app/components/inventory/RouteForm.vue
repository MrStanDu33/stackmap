<script setup lang="ts">
import type { ProxyRouteInput } from '@stackmap/extension-reverse-proxy/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

/** The proxy route form of the inventory: proxy, hostnames, upstream listener, Force SSL and WebSockets. */
defineProps<EntityFormProps>();
defineEmits<{ submit: [values: ProxyRouteInput]; dirty: [dirty: boolean] }>();
</script>

<template>
  <form
    :id="formId"
    novalidate
  />
</template>
