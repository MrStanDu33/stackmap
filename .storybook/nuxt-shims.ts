/*
 * Minimal stand-ins for the Nuxt runtime APIs that components use, so stories render with the plain Vue 3
 * framework (@storybook/vue3-vite). They are wired as auto-imports and aliases in main.ts. Keep them small:
 * a component that needs more of Nuxt belongs in a page or a container, not in a story.
 */
import { defineComponent, h, ref } from 'vue';
import { createI18n, useI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router';

import i18nConfig from '../i18n/i18n.config';
import { MESSAGES } from '../tests/support/i18n';

import type { Ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

export type Locale = 'en' | 'fr';

export const i18n = createI18n({
  ...i18nConfig(),
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  // With the built-in extensions' strings, as the app merges them: trace hops are their sentences.
  messages: MESSAGES,
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

/** Nuxt color mode, as the app configures it: `dark` (midnight) or `light`, applied as a class on `<html>`. */
export const useColorMode = () => {
  const html = document.documentElement;
  return {
    get preference(): string {
      return html.classList.contains('light') ? 'light' : 'dark';
    },
    set preference(mode: string) {
      html.classList.toggle('dark', mode === 'dark');
      html.classList.toggle('light', mode === 'light');
    },
    get value(): string {
      return this.preference;
    },
  };
};

const cookies = new Map<string, Ref>();

/** Cookies kept in memory: stories have no server to send them to. */
export const useCookie = <T>(name: string, options: { default?: () => T } = {}): Ref<T> => {
  if (!cookies.has(name)) {
    cookies.set(name, ref(options.default?.()));
  }
  return cookies.get(name) as Ref<T>;
};
