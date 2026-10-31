<script setup lang="ts">
defineProps<{ busy?: boolean; error?: 'invalid' | 'throttled' | 'network' | null; retryAfter?: number | null }>();
defineEmits<{ submit: [credentials: { email: string; password: string }] }>();
</script>

<template>
  <form />
</template>
