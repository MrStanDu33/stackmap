import { addCollection } from '@iconify/vue';
import { icons as lucide } from '@iconify-json/lucide';
import UApp from '@nuxt/ui/components/App.vue';
import ui from '@nuxt/ui/vue-plugin';
import { setup } from '@storybook/vue3-vite';
import { h } from 'vue';

import '../app/assets/css/main.css';
import { i18n, router } from './nuxt-shims';

import type { Locale } from './nuxt-shims';
import type { Decorator, Preview } from '@storybook/vue3-vite';

type Theme = 'midnight' | 'light';

// Icons come from the bundled Lucide collection, as in the app: stories never call the Iconify API.
addCollection(lucide);

setup((app) => {
  app.use(i18n);
  app.use(router);
  app.use(ui);
});

/** Applies the theme, strict-mode and locale toolbar globals to the document and the story. */
const withAppGlobals: Decorator = (story, context) => {
  const theme = (context.globals.theme ?? 'midnight') as Theme;
  const html = document.documentElement;

  html.classList.toggle('dark', theme === 'midnight');
  html.classList.toggle('light', theme === 'light');
  if (context.globals.contrast === 'strict') {
    html.setAttribute('data-contrast', 'strict');
  } else {
    html.removeAttribute('data-contrast');
  }
  i18n.global.locale.value = (context.globals.locale ?? 'en') as Locale;

  return () => h(UApp, null, { default: () => h(story()) });
};

const preview: Preview = {
  parameters: {
    // Axe violations fail the story tests.
    a11y: { test: 'error' },
    controls: { expanded: true },
  },
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [{ value: 'midnight', title: 'Midnight' }, { value: 'light', title: 'Light' }],
        dynamicTitle: true,
      },
    },
    contrast: {
      description: 'RGAA strict mode',
      toolbar: {
        title: 'Contrast',
        icon: 'contrast',
        items: [{ value: 'standard', title: 'Standard' }, { value: 'strict', title: 'RGAA strict' }],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Locale',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [{ value: 'en', title: 'English' }, { value: 'fr', title: 'Français' }],
        dynamicTitle: true,
      },
    },
  },
  // The story tests set these per Vitest project (vitest.config.ts) to cover every theme × contrast × locale.
  initialGlobals: {
    theme: import.meta.env.STORYBOOK_THEME ?? 'midnight',
    contrast: import.meta.env.STORYBOOK_CONTRAST ?? 'standard',
    locale: import.meta.env.STORYBOOK_LOCALE ?? 'en',
  },
  decorators: [withAppGlobals],
};

export default preview;
