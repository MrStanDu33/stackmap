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

// One palette for every page of the shell, which opens it.
const palette = useCommandPalette();

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
    <CommandPalette
      v-model:open="palette.open.value"
      v-model:search-term="palette.searchTerm.value"
      v-model:filter="palette.filter.value"
      :groups="palette.groups.value"
      :loading="palette.loading.value"
      @select="palette.choose"
      @closed="palette.closed"
    />
  </UApp>
</template>
