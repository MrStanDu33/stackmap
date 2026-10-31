<script setup lang="ts">
import type { Trace } from '#shared/contracts/traces';
import type { TraceSelection } from '../../utils/trace-index';

/** A selected step with its hops in order, or a listener with the steps in and out of it. */
defineProps<{ trace: Trace; selection: TraceSelection }>();
defineEmits<{ select: [selection: TraceSelection]; close: [] }>();
</script>

<template>
  <div />
</template>
