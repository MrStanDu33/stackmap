<script setup lang="ts">
import type { Traffic } from '#shared/contracts/traffic';
import type { WorkspaceSummary } from '#shared/contracts/workspaces';
import type { Selection } from '~/utils/traffic-selection';

import { DEMO_WORKSPACE_SLUG } from '#shared/contracts/workspaces';
import { indexTraffic, selectionName } from '~/utils/traffic-index';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();

useHead({ title: () => `${t('traffic.title')} · ${t('app.name')}` });

const view = computed({
  get: () => (route.query.view === 'list' ? 'list' : 'graph'),
  set: (value: 'graph' | 'list') => {
    void router.replace({ query: { ...route.query, view: value === 'list' ? 'list' : undefined } });
  },
});

// On the client only: the graph is client-only anyway, and so a failing request can be shown and retried.
const {
  data: workspaces, error: workspaceError, refresh: refreshWorkspaces,
} = useFetch<{ workspaces: WorkspaceSummary[] }>('/api/workspaces', {
  query: { slug: DEMO_WORKSPACE_SLUG },
  server: false,
});
const workspace = computed(() => workspaces.value?.workspaces[0]);
const trafficUrl = computed(() => (workspace.value ? `/api/workspaces/${workspace.value.id}/traffic` : ''));
const { data: traffic, error: trafficError, refresh: refreshTraffic } = useFetch<Traffic>(trafficUrl, {
  server: false,
  immediate: false,
  watch: false,
});
// Fetched once the workspace is known, and again if it changes.
watch(trafficUrl, (url) => {
  if (url) {
    void refreshTraffic();
  }
}, { immediate: true });

const loaded = computed(() => traffic.value ?? undefined);
const { layout, error: layoutError, retry: relayout } = useTrafficLayout(loaded, { t });
// The nodes' accessible names are in the current language.
watch(locale, relayout);

const failed = computed(() => Boolean(workspaceError.value ?? trafficError.value));
const noWorkspace = computed(() => workspaces.value !== undefined && !workspace.value);
const heading = useTemplateRef<HTMLElement>('heading');
// The retry button goes away with the error: focus moves to the page's heading rather than being lost.
const focusHeading = async () => {
  await nextTick();
  heading.value?.focus();
};
const retry = async () => {
  await refreshWorkspaces();
  if (trafficUrl.value) {
    await refreshTraffic();
  }
  await focusHeading();
};
const retryLayout = async () => {
  relayout();
  await focusHeading();
};

const index = computed(() => (traffic.value ? indexTraffic(traffic.value) : undefined));
const selection = ref<Selection | null>(null);
// Where focus returns when the panel closes.
let opener: HTMLElement | null = null;

const select = (next: Selection | null) => {
  const same = next && selection.value?.type === next.type && selection.value.id === next.id;
  if (next && !selection.value) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  selection.value = same ? null : next;
};
const close = () => {
  selection.value = null;
  // The opener may be gone (the view was switched): the heading then takes the focus.
  if (opener?.isConnected) {
    opener.focus();
  } else {
    void focusHeading();
  }
  opener = null;
};
/** Escape closes the panel, unless another widget used it: a select, a menu, the sidebar drawer. */
const onKeydown = (event: KeyboardEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  const elsewhere = event.defaultPrevented
    || target?.closest('[role="combobox"], [role="listbox"], [role="menu"], [role="dialog"]');
  if (event.key === 'Escape' && selection.value && !elsewhere) {
    close();
  }
};
onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
});

// Events only, so a reader hears each once: the counts when the traffic arrives, then each selection.
const announcement = ref('');
watch(traffic, (loadedTraffic) => {
  if (!loadedTraffic) {
    return;
  }
  const { hosts, services, flows } = loadedTraffic;
  announcement.value = t('traffic.summary', {
    hosts: t('traffic.count.hosts', { count: hosts.length }, hosts.length),
    services: t('traffic.count.services', { count: services.length }, services.length),
    flows: t('traffic.count.flows', { count: flows.length }, flows.length),
  });
});
watch(selection, (selected) => {
  const name = selected && index.value ? selectionName(index.value, selected, t) : undefined;
  announcement.value = name ? t('traffic.selected', { name }) : '';
});
</script>

<template>
  <AppShell>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1
        ref="heading"
        tabindex="-1"
        class="text-2xl font-semibold outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        {{ t('traffic.title') }}
      </h1>
      <ViewToggle v-model="view" />
    </div>

    <p
      role="status"
      class="sr-only"
    >
      {{ announcement }}
    </p>

    <div
      v-if="failed"
      role="alert"
      class="flex flex-col items-start gap-3 rounded-md border border-error p-4"
    >
      <p>{{ t('traffic.error') }}</p>
      <UButton
        icon="i-lucide-refresh-cw"
        @click="retry"
      >
        {{ t('common.retry') }}
      </UButton>
    </div>

    <div
      v-else-if="noWorkspace"
      class="flex flex-col gap-1 rounded-md border border-default p-6"
    >
      <h2 class="text-lg font-semibold">
        {{ t('traffic.noWorkspace') }}
      </h2>
      <p class="text-muted">
        {{ t('traffic.noWorkspaceHint') }}
      </p>
    </div>

    <template v-else>
      <UAlert
        v-if="traffic?.truncated"
        color="warning"
        variant="subtle"
        :title="t('traffic.truncated')"
      />
      <div class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div class="min-w-0 flex-1">
          <p
            v-if="view === 'list' && !traffic"
            role="status"
            class="p-6 text-center text-muted"
          >
            {{ t('traffic.loading') }}
          </p>
          <TrafficList
            v-else-if="view === 'list' && traffic"
            :traffic="traffic"
            :selection="selection"
            @select="select"
          />
          <ClientOnly v-else-if="view === 'graph'">
            <!-- Capped on phones, so the page keeps room to scroll past the graph. -->
            <div class="h-[calc(100dvh-12rem)] min-h-96 max-lg:max-h-[70dvh]">
              <TrafficGraph
                :traffic="traffic ?? { hosts: [], services: [], listeners: [], flows: [], truncated: false }"
                :layout="traffic ? layout : null"
                :error="layoutError"
                :selection="selection"
                @select="select"
                @retry="retryLayout"
              />
            </div>
          </ClientOnly>
        </div>
        <TrafficDetailPanel
          v-if="selection && traffic && index && selectionName(index, selection, t)"
          class="w-full shrink-0 rounded-lg border border-default p-4 lg:w-96"
          :traffic="traffic"
          :selection="selection"
          @select="select"
          @close="close"
        />
      </div>
    </template>
  </AppShell>
</template>
