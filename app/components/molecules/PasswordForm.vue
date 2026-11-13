<script setup lang="ts">
defineProps<{
  busy?: boolean;
  error?: 'wrong_password' | 'throttled' | 'network' | null;
  /** Seconds to wait, for `throttled`. */
  retryAfter?: number | null;
  /** The password was changed. */
  done?: boolean;
}>();
defineEmits<{ submit: [change: { currentPassword: string; newPassword: string }] }>();
</script>

<template>
  <div />
</template>
