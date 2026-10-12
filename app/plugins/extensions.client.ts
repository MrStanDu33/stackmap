import { createHookBus } from '@stackmap/extension-sdk';

import { BUILTIN_EXTENSION_CLIENTS } from '../extensions/builtin';

import type { Extension } from '../../shared/contracts/extensions';
import type { ClientHooks } from '@stackmap/extension-sdk';
import type { z } from 'zod';

/** `localStorage['stackmap:debug'] = 'extensions'` traces every client hook call in the console. */
const tracing = () => {
  try {
    return localStorage.getItem('stackmap:debug')?.split(',').includes('extensions') ?? false;
  } catch {
    return false;
  }
};

/**
 * Runs the built-in extensions' browser code: forwards the app's lifecycle events (mounted, navigation, language
 * switch) to the active extensions' client hooks.
 */
export default defineNuxtPlugin((nuxtApp) => {
  // The server knows which extensions failed; their browser code does not run. Fetched without delaying the app.
  const bus = $fetch<{ extensions: z.output<typeof Extension>[] }>('/api/extensions')
    .catch(() => ({ extensions: [] }))
    .then(({ extensions }) => {
      const active = new Set(extensions.filter(({ state }) => state === 'active').map(({ id }) => id));
      return createHookBus<ClientHooks>(BUILTIN_EXTENSION_CLIENTS.filter(({ extension }) => active.has(extension)), {
        onError: (error, { extension, hook }) => {
          console.error(`[extension:${extension}] ${hook} failed`, error);
        },
        trace: tracing()
          ? (line) => {
              console.debug(`[extensions] ${line}`);
            }
          : undefined,
        checkPayloads: import.meta.dev,
      });
    });
  const callHook = async <K extends keyof ClientHooks>(name: K, payload: ClientHooks[K]) => {
    await (await bus).callHook(name, payload);
  };

  nuxtApp.hook('app:mounted', () => callHook('app:mounted', {}));
  nuxtApp.hook('page:finish', () => callHook('route:changed', { path: nuxtApp.$router.currentRoute.value.path }));
  nuxtApp.hook('i18n:localeSwitched', ({ newLocale }) => callHook('locale:changed', { locale: newLocale }));
});
