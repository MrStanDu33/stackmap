<script setup lang="ts">
import type { Traffic } from '#shared/contracts/traffic';
import type { Selection } from '../../utils/traffic-selection';

/** What is selected in the Traffic view, with what it is linked to. */
defineProps<{ traffic: Traffic; selection: Selection }>();
defineEmits<{ select: [selection: Selection]; close: [] }>();
</script>

<template>
  <div />
</template>
