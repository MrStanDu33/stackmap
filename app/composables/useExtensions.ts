import { extensionLabels } from '../utils/extension-labels';

import type { InstalledExtension } from '../extensions/inventory';
import type { ExtensionLabels } from '../utils/extension-labels';

export { extensionLabels };
export type { ExtensionLabels, KindOption } from '../utils/extension-labels';

/**
 * The installed extensions, fetched once on the client and shared under the `extensions` state, which components
 * read through `useExtensionLabels`. With a workspace, its list says which are turned off there; it is fetched once
 * the workspace's id is known.
 */
export function useExtensions(workspaceId?: MaybeRefOrGetter<string | undefined>) {
  const installed = useState<InstalledExtension[]>('extensions', () => []);
  const url = computed(() => {
    const id = toValue(workspaceId);
    return id ? `/api/workspaces/${id}/extensions` : '/api/extensions';
  });
  const { data, error, execute } = useFetch<{ extensions: InstalledExtension[] }>(url, {
    server: false, immediate: false, watch: false,
  });
  const load = () => (workspaceId !== undefined && !toValue(workspaceId) ? Promise.resolve() : execute());
  watch(url, load, { immediate: true });
  watch(data, (value) => {
    if (value) {
      installed.value = value.extensions;
    }
  }, { immediate: true });
  /** This call's list (null until loaded), whether it could not be loaded, and a way to try again. */
  return { extensions: computed(() => data.value?.extensions ?? null), error, retry: load };
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
