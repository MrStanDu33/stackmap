<script setup lang="ts">
defineProps<{ busy?: boolean }>();
defineEmits<{ submit: [account: { name: string; email: string; password: string; demo: boolean }] }>();
</script>

<template>
  <form />
</template>
