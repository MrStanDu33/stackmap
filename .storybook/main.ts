import { fileURLToPath } from 'node:url';

import ui from '@nuxt/ui/vite';
import vue from '@vitejs/plugin-vue';
import remarkGfm from 'remark-gfm';
import { mergeConfig } from 'vite';

import { UI_COLORS } from '../shared/design/ui-colors';

import type { NuxtUIOptions } from '@nuxt/ui/vite';
import type { StorybookConfig } from '@storybook/vue3-vite';

type UIColors = NonNullable<NonNullable<NuxtUIOptions['ui']>['colors']>;

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const shims = path('./nuxt-shims.ts');

const config: StorybookConfig = {
  stories: ['./foundations/*.@(mdx|stories.ts)', '../app/components/**/*.@(mdx|stories.ts)'],
  // Files the stories load, such as an extension's image icon.
  staticDirs: ['./public'],
  addons: [
    {
      name: '@storybook/addon-docs',
      // GitHub-flavored Markdown (tables, task lists) in the MDX foundation pages.
      options: { mdxPluginOptions: { mdxCompileOptions: { remarkPlugins: [remarkGfm] } } },
    },
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
    '@storybook/addon-mcp',
  ],
  core: { disableTelemetry: true },
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  // Plain Vue + Vite build of the app's components: Nuxt UI through its Vite plugin, Nuxt APIs through shims.
  viteFinal: (viteConfig) => mergeConfig(viteConfig, {
    plugins: [
      vue(),
      ui({
        // Nuxt generates the app's type declarations; root d.ts files from this plugin would clash with them.
        dts: false,
        // The plugin types `neutral` as Tailwind's grays only; a custom palette (midnight) works at runtime.
        ui: { colors: UI_COLORS as unknown as UIColors },
        colorMode: false,
        router: true,
        autoImport: {
          // Vue's APIs (ref, computed…) are auto-imported in Nuxt too.
          imports: ['vue', { from: shims, imports: ['useI18n', 'useState', 'clearNuxtState', 'useRuntimeConfig', 'useNuxtApp', 'useColorMode', 'useCookie'] }],
        },
        components: {
          dirs: [path('../app/components')],
          directoryAsNamespace: false,
          resolvers: [(name: string) => (name === 'NuxtLink' ? { name: 'NuxtLink', from: shims } : undefined)],
        },
      }),
    ],
    resolve: {
      alias: {
        '#shared': path('../shared'),
        '~': path('../app'),
      },
    },
  }),
};

export default config;
