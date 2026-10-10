<script setup lang="ts">
import { en, fr } from '@nuxt/ui/locale';

const { locale } = useI18n();
const localeHead = useLocaleHead();

// Nuxt UI ships its own component strings; keep them in the same locale as the app.
const uiLocales = { en, fr };

useHead({
  htmlAttrs: {
    lang: () => localeHead.value.htmlAttrs.lang,
    dir: () => localeHead.value.htmlAttrs.dir,
  },
});
</script>

<template>
  <UApp :locale="uiLocales[locale]">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </UApp>
</template>
