import { extensionLabels } from '../utils/extension-labels';

import type { InstalledExtension } from '../../shared/contracts/extensions';
import type { ExtensionLabels } from '../utils/extension-labels';

export { extensionLabels };
export type { ExtensionLabels, KindOption } from '../utils/extension-labels';

/**
 * The installed extensions, fetched once on the client and shared under the `extensions` state, which components
 * read through `useExtensionLabels`.
 */
export function useExtensions() {
  const installed = useState<InstalledExtension[]>('extensions', () => []);
  const { data, error, refresh } = useFetch<{ extensions: InstalledExtension[] }>('/api/extensions', {
    key: 'extensions', server: false,
  });
  watch(data, (value) => {
    if (value) {
      installed.value = value.extensions;
    }
  }, { immediate: true });
  /** Whether they could not be loaded, and a way to try again. */
  return { error, retry: () => refresh() };
}

/** The labels of the installed extensions in the current language; raw ids until the extensions are loaded. */
export function useExtensionLabels(): ExtensionLabels {
  const installed = useState<InstalledExtension[]>('extensions', () => []);
  const { t } = useI18n();
  // Read when called, so labels follow both the extensions once loaded and the locale.
  const labels = (): ExtensionLabels => extensionLabels(installed.value, (key, params) => t(key, params ?? {}));
  return {
    kindLabel: (...args) => labels().kindLabel(...args),
    kindOptions: (...args) => labels().kindOptions(...args),
    entityLabel: (...args) => labels().entityLabel(...args),
    entityPlural: (...args) => labels().entityPlural(...args),
    extensionName: (...args) => labels().extensionName(...args),
  };
}
