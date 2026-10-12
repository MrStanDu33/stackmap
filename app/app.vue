<script setup lang="ts">
import { en, fr } from '@nuxt/ui/locale';

import type { UiLocale } from '#shared/i18n/ui-locale';

const { locale } = useI18n();
const localeHead = useLocaleHead();

// Nuxt UI ships its own component strings; keep them in the same language as the app. The app's languages are
// bundled; a language from a locale pack loads Nuxt UI's closest one on demand (all of them weigh 44 kB gzipped).
const bundled: Record<string, UiLocale> = { en, fr };
const uiLocale = shallowRef<UiLocale>(bundled[locale.value] ?? en);
watch(locale, async (code) => {
  uiLocale.value = bundled[code] ?? (await import('#shared/i18n/ui-locale')).uiLocaleFor(code);
}, { immediate: true });

useHead({
  htmlAttrs: {
    lang: () => localeHead.value.htmlAttrs.lang,
    dir: () => localeHead.value.htmlAttrs.dir,
  },
});
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </UApp>
</template>
