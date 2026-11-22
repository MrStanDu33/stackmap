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
  const preferences = usePreferences();
  const { data } = useNuxtData<{ workspaces: MemberWorkspace[] }>('workspaces');
  const installed = useState<InstalledExtension[]>('extensions', () => []);
  // What the current page draws (Traffic, Trace): an entity there is selected rather than opened in the inventory.
  const drawn = useState<Record<string, string>>('palette.drawn', () => ({}));

  const workspaces = computed(() => data.value?.workspaces ?? []);
  const workspace = computed(() => workspaces.value.find(({ slug }) => slug === route.params.slug) ?? null);
  // What the user hid in Settings: a hidden group is neither listed nor, for entities, searched.
  const { session, signOut } = useAccount();
  const hidden = computed(() => session.value?.user.preferences.palette.hidden ?? []);
  const entities = usePaletteSearch(
    () => workspace.value?.id,
    () => (hidden.value.includes('group:entities') ? '' : searchTerm.value),
  );
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
    query: Object.fromEntries(Object.entries(route.query).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    drawn: drawn.value,
    hidden: hidden.value,
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

  // While the palette closes, the page is hidden from screen readers: a change on the same page waits for it to go,
  // or it would be made, and announced, where nobody hears it.
  let leaving: (() => void) | null = null;
  const closed = () => {
    leaving?.();
    leaving = null;
  };
  // The item chosen, for the page that selects it to name it (Trace selects a step for one of its hops).
  const chosen = useState('palette.chosen', () => '');
  // Counted each time the selection chosen is already the page's: it says it again.
  const reselected = useState('palette.reselected', () => 0);

  const choose = async ({ command, label }: PaletteItem) => {
    searchTerm.value = '';
    if (command?.kind === 'navigate') {
      // Another page's main content takes the focus; on the same page, the shell gives it back to the opener.
      const samePage = router.resolve(command.to).path === route.path;
      if (!samePage) {
        focusNextPage();
        open.value = false;
        await navigateTo(command.to);
        return;
      }
      const gone = new Promise<void>((resolve) => {
        leaving = resolve;
      });
      open.value = false;
      await gone;
      chosen.value = label;
      if (router.resolve(command.to).fullPath === route.fullPath) {
        reselected.value += 1;
      } else {
        await navigateTo(command.to);
      }
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

  return { open, searchTerm, groups, loading: computed(() => entities.value.state === 'loading'), choose, closed };
}
