<script setup lang="ts">
/** Every page's frame: the skip link, the sidebar and the main content, with the mobile navigation toggle. */
const { t } = useI18n();
const main = useTemplateRef<HTMLElement>('main');

// Hidden until focused, then shown over the page.
const skipLink = 'sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md '
  + 'focus:bg-default focus:px-3 focus:py-2';

const skipToMain = () => {
  main.value?.focus();
};
</script>

<template>
  <UDashboardGroup>
    <a
      href="#main"
      :class="skipLink"
      @click.prevent="skipToMain"
    >{{ t('a11y.skipToContent') }}</a>
    <AppSidebar />
    <UDashboardPanel>
      <template #header>
        <!-- Narrow screens only: the navigation toggle in a header landmark. The page keeps the one h1. -->
        <UDashboardNavbar
          as="header"
          class="lg:hidden"
        >
          <template #left>
            <span class="font-semibold">{{ t('app.name') }}</span>
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <main
          id="main"
          ref="main"
          tabindex="-1"
          class="flex min-h-full flex-col gap-4 outline-none"
        >
          <slot />
        </main>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
