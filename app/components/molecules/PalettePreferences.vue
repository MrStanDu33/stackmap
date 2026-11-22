<script setup lang="ts">
/** What the command palette lists and searches: a checkbox per group, all checked until one is hidden. */
defineProps<{ hidden: readonly string[] }>();
defineEmits<{ 'update:hidden': [hidden: string[]] }>();
</script>

<template>
  <div />
</template>
