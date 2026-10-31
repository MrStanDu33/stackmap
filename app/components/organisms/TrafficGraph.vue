<script setup lang="ts">
import type { Traffic } from '#shared/contracts/traffic';
import type { TrafficLayout } from '../../utils/traffic-graph';
import type { Selection } from '../../utils/traffic-selection';

/** The traffic drawn as a read-only graph: hosts holding services, services with their ports, flows to ports. */
defineProps<{
  traffic: Traffic;
  layout: TrafficLayout | null;
  error?: unknown;
  selection?: Selection | null;
}>();
defineEmits<{ select: [selection: Selection | null]; retry: [] }>();
</script>

<template>
  <div />
</template>
