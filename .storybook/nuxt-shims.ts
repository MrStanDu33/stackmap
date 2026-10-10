/*
 * Minimal stand-ins for the Nuxt runtime APIs that components use, so stories render with the plain Vue 3
 * framework (@storybook/vue3-vite). They are wired as auto-imports and aliases in main.ts. Keep them small:
 * a component that needs more of Nuxt belongs in a page or a container, not in a story.
 */
import { defineComponent, h, ref } from 'vue';
import { createI18n, useI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router';

import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';

import type { Ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

export type Locale = 'en' | 'fr';

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, fr },
});

export { useI18n };

export const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:path(.*)*', component: { render: () => null } }],
});

const state = new Map<string, Ref>();

export const useState = <T>(key: string, init?: () => T): Ref<T> => {
  if (!state.has(key)) {
    state.set(key, ref(init?.()));
  }
  return state.get(key) as Ref<T>;
};

export const clearNuxtState = (): void => {
  state.clear();
};

export const useRuntimeConfig = () => ({ app: { baseURL: '/' }, public: {} });

export const useNuxtApp = () => ({
  $i18n: {
    locale: i18n.global.locale,
    setLocale: (locale: Locale): Promise<void> => {
      i18n.global.locale.value = locale;
      return Promise.resolve();
    },
  },
});

export const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: [String, Object] as unknown as () => RouteLocationRaw, required: true } },
  setup(props, { slots }) {
    return () => h(RouterLink, { to: props.to }, slots);
  },
});
