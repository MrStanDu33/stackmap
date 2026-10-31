<script setup lang="ts">
import { APP_LOCALES } from '#shared/i18n/locales';

/** Theme, contrast and language: stored in the browser until accounts save them per user (phase 4). */
type Contrast = 'standard' | 'strict';

const { t, locale } = useI18n();
const { $i18n } = useNuxtApp();
const colorMode = useColorMode();
// Read by the contrast plugin, which applies it to <html> during SSR and after.
const cookie = useCookie<Contrast>('stackmap_contrast', { default: () => 'standard', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
const contrast = useState<Contrast>('stackmap:contrast', () => cookie.value);

const theme = computed({
  get: () => (colorMode.preference === 'light' ? 'light' : 'dark'),
  set: (mode: string) => {
    colorMode.preference = mode;
  },
});

const strict = computed({
  get: () => contrast.value,
  set: (value: Contrast) => {
    contrast.value = value;
    cookie.value = value;
    if (value === 'strict') {
      document.documentElement.setAttribute('data-contrast', 'strict');
    } else {
      document.documentElement.removeAttribute('data-contrast');
    }
  },
});

const language = computed({
  get: () => locale.value,
  set: (code: string) => {
    void $i18n.setLocale(code as never);
  },
});

const themes = computed(() => [
  { label: t('preferences.midnight'), value: 'dark' },
  { label: t('preferences.light'), value: 'light' },
]);
const contrasts = computed(() => [
  { label: t('preferences.standard'), value: 'standard' },
  { label: t('preferences.strict'), value: 'strict' },
]);
const languages = APP_LOCALES.map(({ code, name }) => ({ label: name, value: code }));
</script>

<template>
  <section
    class="flex flex-col gap-3"
    aria-labelledby="display-preferences"
  >
    <h2
      id="display-preferences"
      class="text-sm font-semibold"
    >
      {{ t('preferences.title') }}
    </h2>
    <URadioGroup
      v-model="theme"
      :items="themes"
      :legend="t('preferences.theme')"
      :aria-label="t('preferences.theme')"
      orientation="horizontal"
      size="sm"
    />
    <URadioGroup
      v-model="strict"
      :items="contrasts"
      :legend="t('preferences.contrast')"
      :aria-label="t('preferences.contrast')"
      orientation="horizontal"
      size="sm"
    />
    <UFormField
      :label="t('preferences.language')"
      name="language"
      size="sm"
    >
      <USelect
        v-model="language"
        :items="languages"
        class="w-full"
      />
    </UFormField>
  </section>
</template>
