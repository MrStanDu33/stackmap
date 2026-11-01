<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';
import type { Member, PendingInvitation } from '#shared/contracts/members';

defineProps<{
  members: Member[];
  invitations?: PendingInvitation[];
  me: string;
  myRole: WorkspaceRole;
  error?: 'last_owner' | 'network' | null;
}>();
defineEmits<{
  changeRole: [userId: string, role: WorkspaceRole];
  remove: [userId: string];
  revoke: [invitationId: string];
}>();
</script>

<template>
  <div />
</template>
