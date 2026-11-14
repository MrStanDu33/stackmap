<script setup lang="ts">
import { APP_LOCALES } from '#shared/i18n/locales';

/**
 * Theme, contrast and language, kept in the browser's cookies; signed in, the preferences plugin also saves them to
 * the account, and this says how that went.
 */
type Contrast = 'standard' | 'strict';

/** `landmark: false` inside a page section that names it already (/settings): one landmark per name. */
const props = withDefaults(defineProps<{ landmark?: boolean }>(), { landmark: true });

const { t, locale } = useI18n();
const titleId = useId();
const { $i18n } = useNuxtApp();
const colorMode = useColorMode();
// Read by the contrast plugin, which applies it to <html> during SSR and after.
const cookie = useCookie<Contrast>('stackmap_contrast', { default: () => 'standard', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
const contrast = useState<Contrast>('stackmap:contrast', () => cookie.value);
// How the last save to the account went (app/composables/usePreferences.ts); null signed out or before any change.
const saveStatus = useState<'saved' | 'error' | null>('preferences.status', () => null);

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
  <component
    :is="props.landmark ? 'section' : 'div'"
    class="flex flex-col gap-3"
    :aria-labelledby="props.landmark ? titleId : undefined"
  >
    <!-- A named region rather than a heading: the sidebar comes before the page's h1. -->
    <p
      v-if="props.landmark"
      :id="titleId"
      class="text-sm font-semibold"
    >
      {{ t('preferences.title') }}
    </p>
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
    <UAlert
      v-if="saveStatus === 'error'"
      role="alert"
      color="error"
      variant="outline"
      :title="t('settings.saveError')"
    />
    <p
      role="status"
      class="text-sm text-muted"
    >
      {{ saveStatus === 'saved' ? t('settings.saved') : '' }}
    </p>
  </component>
</template>
