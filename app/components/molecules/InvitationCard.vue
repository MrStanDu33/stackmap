<script setup lang="ts">
import type { WorkspaceRole } from '#shared/contracts/contract';

defineProps<{
  /** Null when the link is unknown, expired or used. */
  invitation: {
    workspace: string;
    role: WorkspaceRole;
    email: string;
    invitedBy: string | null;
    expiresAt: string;
  } | null;
  state: 'signedOut' | 'registered' | 'accept' | 'wrongAccount';
  signedInAs?: string | null;
  signInTo: string;
  busy?: boolean;
  error?: string | null;
}>();
defineEmits<{ register: [account: { name: string; password: string }]; accept: []; signOut: [] }>();
</script>

<template>
  <div />
</template>
