<script setup lang="ts">
/** The setup and sign-in pages: no navigation yet, the form in a card, and the display preferences. */
defineProps<{ title: string }>();
</script>

<template>
  <div class="flex min-h-dvh bg-default">
    <main class="m-auto flex w-full max-w-md flex-col gap-6 p-4">
      <UCard>
        <template #header>
          <h1 class="text-xl font-semibold">
            {{ title }}
          </h1>
        </template>
        <slot />
      </UCard>
      <DisplayPreferences />
    </main>
  </div>
</template>
