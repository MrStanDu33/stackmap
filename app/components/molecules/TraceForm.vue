<script setup lang="ts">
import type { TraceQuery } from '../../utils/trace-query';

/** The trace to show: a hostname, the client it comes from, and an optional port. */
defineProps<{ query?: TraceQuery | null; suggestions?: readonly string[] }>();
defineEmits<{ submit: [query: TraceQuery] }>();
</script>

<template>
  <div />
</template>
