<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';

defineProps<{
  roles: WorkspaceRole[];
  busy?: boolean;
  error?: 'already_member' | 'network' | null;
  created?: { url: string; email: string } | null;
}>();
defineEmits<{ submit: [invitation: { email: string; role: WorkspaceRole }] }>();
</script>

<template>
  <form />
</template>
