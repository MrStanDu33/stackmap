<script setup lang="ts">
import type { Trace } from '#shared/contracts/traces';
import type { TraceSelection } from '../../utils/trace-index';

/** A trace as an ordered list of steps with their hops: the accessible equivalent of the graph. */
defineProps<{ trace: Trace; selection?: TraceSelection | null }>();
defineEmits<{ select: [selection: TraceSelection] }>();
</script>

<template>
  <div />
</template>
