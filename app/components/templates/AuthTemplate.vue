<script setup lang="ts">
/** The setup, sign-in and forced password pages: no navigation, the form in a card, and the display preferences. */
defineProps<{ title: string }>();
</script>

<template>
  <div class="flex min-h-dvh bg-default">
    <main class="m-auto flex w-full max-w-md flex-col gap-6 p-4">
      <UCard>
        <template #header>
          <!-- Focusable by script, for pages that start on it (the forced password change). -->
          <h1
            tabindex="-1"
            class="text-xl font-semibold outline-none focus-visible:outline-2 focus-visible:outline-primary"
          >
            {{ title }}
          </h1>
        </template>
        <slot />
      </UCard>
      <DisplayPreferences />
    </main>
  </div>
</template>
