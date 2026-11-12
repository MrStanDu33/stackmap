<script setup lang="ts">
import type { UserAccount } from '#shared/contracts/users';

defineProps<{
  users: UserAccount[];
  me: string;
  error?: { code: 'last_admin' | 'network' } | { code: 'last_owner'; name: string; workspaces: string[] } | null;
}>();
defineEmits<{
  changeRole: [userId: string, role: UserAccount['role']];
  remove: [userId: string];
  resetPassword: [userId: string];
}>();
</script>

<template>
  <div />
</template>
