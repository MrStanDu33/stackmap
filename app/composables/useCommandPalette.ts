import type { InstalledExtension } from '#shared/contracts/extensions';
import type { MemberWorkspace } from '#shared/contracts/workspaces';
import type { PaletteItem } from '~/utils/palette';

import { NO_PREFERENCES } from '#shared/contracts/preferences';
import { usePaletteSearch } from '~/composables/usePaletteSearch';
import { inventoryTypes } from '~/extensions/inventory';
import { paletteGroups } from '~/utils/palette-groups';

/**
 * The command palette's state, groups and choices, for app.vue. It reads what the shell's pages loaded (the
 * workspaces, the current workspace's extensions) rather than fetching them again; only entities are searched here.
 */
export function useCommandPalette() {
  const open = useState('palette.open', () => false);
  const searchTerm = ref('');
  const route = useRoute();
  const { t } = useI18n();
  const { signOut } = useAccount();
  const preferences = usePreferences();
  const { data } = useNuxtData<{ workspaces: MemberWorkspace[] }>('workspaces');
  const installed = useState<InstalledExtension[]>('extensions', () => []);

  const workspaces = computed(() => data.value?.workspaces ?? []);
  const workspace = computed(() => workspaces.value.find(({ slug }) => slug === route.params.slug) ?? null);
  const entities = usePaletteSearch(() => workspace.value?.id, () => searchTerm.value);
  const types = computed(() => (workspace.value ? inventoryTypes(installed.value) : []).map((type) => ({
    extension: type.extension,
    entity: type.entity,
    name: t(type.label),
    plural: t(type.plural),
    icon: installed.value.find(({ id }) => id === type.extension)?.icon,
  })));

  const groups = computed(() => paletteGroups({
    q: searchTerm.value,
    t: (key, params) => t(key, params ?? {}),
    path: route.path,
    workspace: workspace.value,
    workspaces: workspaces.value,
    types: types.value,
    display: preferences.display(),
    entities: entities.value,
    query: {},
    drawn: {},
  }));

  // The palette's opener goes with the page it leaves: the new page's main content takes the focus once shown.
  const nuxtApp = useNuxtApp();
  let focusPending = false;
  const focusNextPage = () => {
    if (!focusPending) {
      focusPending = true;
      nuxtApp.hooks.hookOnce('page:finish', async () => {
        focusPending = false;
        await nextTick();
        // Reopened meanwhile: the palette keeps the focus.
        if (!open.value) {
          document.getElementById('main')?.focus();
        }
      });
    }
  };
  // Leaving the page while it is open (Back) closes it.
  const router = useRouter();
  router.afterEach((to, from) => {
    if (open.value && to.path !== from.path) {
      open.value = false;
      focusNextPage();
    }
  });

  const choose = async ({ command }: PaletteItem) => {
    searchTerm.value = '';
    if (command?.kind === 'navigate') {
      // Another page's main content takes the focus; on the same page, the shell gives it back to the opener.
      if (router.resolve(command.to).path !== route.path) {
        focusNextPage();
      }
      open.value = false;
      await navigateTo(command.to);
      return;
    }
    open.value = false;
    if (command?.kind === 'display') {
      // Applied as the account's own would be; the preferences plugin saves the change to the account.
      await preferences.apply({ ...NO_PREFERENCES, ...command.changes });
    } else if (command?.kind === 'signOut') {
      await signOut();
    }
  };

  return { open, searchTerm, groups, loading: computed(() => entities.value.state === 'loading'), choose };
}
