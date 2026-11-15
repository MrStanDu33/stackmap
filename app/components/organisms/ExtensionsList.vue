<script setup lang="ts">
import type { WorkspaceExtension } from '../../../shared/contracts/extensions';

/** The workspace's extensions, on or off; admins turn them on and off with switches. */
defineProps<{
  /** Null while loading. */
  extensions: WorkspaceExtension[] | null;
  /** The list could not be loaded. */
  failed: boolean;
  canManage: boolean;
  /** The extension being saved. */
  busy: string | null;
}>();
defineEmits<{ toggle: [id: string, enabled: boolean]; retry: [] }>();
</script>

<template>
  <div />
</template>
