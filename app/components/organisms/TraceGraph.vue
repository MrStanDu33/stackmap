<script setup lang="ts">
import type { Trace } from '#shared/contracts/traces';
import type { TraceSelection } from '../../utils/trace-index';
import type { TrafficLayout } from '../../utils/traffic-graph';

/** A trace drawn as a read-only path: the client, the listeners it reaches, then the dependencies. */
defineProps<{ trace: Trace; layout: TrafficLayout | null; error?: unknown; selection?: TraceSelection | null }>();
defineEmits<{ select: [selection: TraceSelection | null]; retry: [] }>();
</script>

<template>
  <div />
</template>
