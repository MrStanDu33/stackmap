<script setup lang="ts">
import type { ExtensionImpact } from '../../../shared/contracts/extensions';

/** Confirms turning an extension on or off, with what changes with it. */
defineProps<{
  open: boolean;
  extension: string;
  /** The state asked for. */
  enabled: boolean;
  /** What the server says would change, the asked extension first. */
  changes: ExtensionImpact[];
}>();
defineEmits<{ confirm: []; 'update:open': [open: boolean] }>();
</script>

<template>
  <div />
</template>
