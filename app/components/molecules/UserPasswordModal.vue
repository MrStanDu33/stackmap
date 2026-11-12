<script setup lang="ts">
defineProps<{ open: boolean; name: string; busy?: boolean; done?: boolean }>();
defineEmits<{ submit: [password: string]; 'update:open': [open: boolean] }>();
</script>

<template>
  <div />
</template>
