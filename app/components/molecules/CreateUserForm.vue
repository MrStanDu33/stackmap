<script setup lang="ts">
defineProps<{
  busy?: boolean;
  error?: 'email_taken' | 'network' | null;
  created?: { email: string } | null;
}>();
defineEmits<{ submit: [account: { name: string; email: string; password: string }] }>();
</script>

<template>
  <div />
</template>
