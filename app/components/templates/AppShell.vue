<script setup lang="ts">
import { isMac, isPaletteShortcut } from '../../utils/palette-shortcut';

import type { WorkspaceRole } from '#shared/contracts/contract';

/** Every page's frame: the skip link, the sidebar and the main content, with the mobile navigation toggle. */
defineProps<{
  user?: { name: string } | null;
  /** The user's workspaces (null while they load) and the current one's slug, for the sidebar's switcher. */
  workspaces?: { name: string; slug: string; role: WorkspaceRole }[] | null;
  current?: string;
  canCreate?: boolean;
  view?: 'graph' | 'trace';
}>();
const emit = defineEmits<{ signOut: [] }>();

const { t } = useI18n();
const main = useTemplateRef<HTMLElement>('main');
// The page's one live region and alert: preference saves (shown by DisplayPreferences, maybe twice on a page) and a
// notice a page leaves for the next one (the forced password change) are announced here, once.
const saveStatus = useState<'saved' | 'error' | null>('preferences.status', () => null);
const notice = useState<string>('app.notice', () => '');
const announcement = computed(() => (saveStatus.value === 'saved' ? t('settings.saved') : notice.value));

// Hidden until focused, then shown over the page.
const skipLink = 'sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md '
  + 'focus:bg-default focus:px-3 focus:py-2';

const skipToMain = () => {
  main.value?.focus();
};

// The command palette, which app.vue renders with its groups: Cmd+K / Ctrl+K or the sidebar's Search button open it,
// on every page of the shell.
const paletteOpen = useState('palette.open', () => false);
const onKeydown = (event: KeyboardEvent) => {
  // Another dialog keeps the keyboard; the palette's own shortcut closes nothing.
  const dialogOpen = !paletteOpen.value && document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
  if (isPaletteShortcut(event, { mac: isMac(), dialogOpen })) {
    event.preventDefault();
    if (paletteOpen.value) {
      paletteOpen.value = false;
    } else {
      openPalette();
    }
  }
};
// What had the focus, or the button that opened it: the focus goes back there when it closes.
let opener: HTMLElement | null = null;
const openPalette = (from?: HTMLElement) => {
  opener = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  paletteOpen.value = true;
};
watch(paletteOpen, async (open) => {
  if (!open) {
    await nextTick();
    // Only when the dialog left it nowhere, as after a click in Safari.
    if (!document.activeElement || document.activeElement === document.body) {
      opener?.focus();
    }
  }
});
onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <UDashboardGroup>
    <a
      href="#main"
      :class="skipLink"
      @click.prevent="skipToMain"
    >{{ t('a11y.skipToContent') }}</a>
    <AppSidebar
      :user="user"
      :workspaces="workspaces"
      :current="current"
      :can-create="canCreate"
      :view="view"
      @sign-out="emit('signOut')"
      @search="openPalette"
    />
    <UDashboardPanel>
      <template #header>
        <!-- Narrow screens only: the navigation toggle in a header landmark. The page keeps the one h1. -->
        <UDashboardNavbar
          as="header"
          class="lg:hidden"
        >
          <template #left>
            <span class="font-semibold">{{ t('app.name') }}</span>
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <main
          id="main"
          ref="main"
          tabindex="-1"
          class="flex min-h-full flex-col gap-4 outline-none"
        >
          <slot />
        </main>
        <p
          role="status"
          class="sr-only"
        >
          {{ announcement }}
        </p>
        <!-- Only while there is one: an alert is announced when it appears, and an empty one would still be found. -->
        <p
          v-if="saveStatus === 'error'"
          role="alert"
          class="sr-only"
        >
          {{ t('settings.saveError') }}
        </p>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
