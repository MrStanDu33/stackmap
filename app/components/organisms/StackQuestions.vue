<script setup lang="ts">
import type { WorkspaceExtension } from '../../../shared/contracts/extensions';

/** "What's in your stack?": a plain question per optional extension, all unchecked; the page turns on those chosen. */
defineProps<{
  /** Null while loading. */
  extensions: WorkspaceExtension[] | null;
  /** The choice is being saved. */
  busy: boolean;
  /** Why the last save failed: the workspace already has data, or anything else. */
  error: 'not-empty' | 'failed' | null;
  /** Where the Extensions page of the workspace is. */
  extensionsPath: string;
}>();
defineEmits<{ submit: [ids: string[]]; skip: [] }>();
</script>

<template>
  <div />
</template>
