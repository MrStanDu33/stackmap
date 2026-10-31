<script setup lang="ts">
defineProps<{ busy?: boolean; error?: 'taken' | 'network' | null }>();
defineEmits<{ submit: [workspace: { name: string; slug: string }] }>();
</script>

<template>
  <form />
</template>
