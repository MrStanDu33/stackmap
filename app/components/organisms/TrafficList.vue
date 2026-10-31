<script setup lang="ts">
import type { Traffic } from '#shared/contracts/traffic';
import type { Selection } from '../../utils/traffic-selection';

/** The traffic as tables, one per host: the accessible equivalent of the graph. */
defineProps<{ traffic: Traffic; selection?: Selection | null }>();
defineEmits<{ select: [selection: Selection] }>();
</script>

<template>
  <div />
</template>
