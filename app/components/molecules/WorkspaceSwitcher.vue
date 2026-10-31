<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';

defineProps<{
  workspaces: { name: string; slug: string; role: WorkspaceRole }[] | null;
  current?: string;
  view: 'graph' | 'trace';
  canCreate?: boolean;
  collapsed?: boolean;
}>();
</script>

<template>
  <div />
</template>
