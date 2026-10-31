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
const retry = async () => {
  await refreshWorkspaces();
  if (trafficUrl.value) {
    await refreshTraffic();
  }
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
  opener?.focus();
  opener = null;
};
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && selection.value) {
    close();
  }
};
onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
});

const announcement = computed(() => {
  if (selection.value && index.value) {
    const name = selectionName(index.value, selection.value, t);
    return name ? t('traffic.selected', { name }) : '';
  }
  if (!traffic.value) {
    return '';
  }
  const { hosts, services, flows } = traffic.value;
  return t('traffic.summary', {
    hosts: t('traffic.count.hosts', { count: hosts.length }, hosts.length),
    services: t('traffic.count.services', { count: services.length }, services.length),
    flows: t('traffic.count.flows', { count: flows.length }, flows.length),
  });
});
</script>

<template>
  <AppShell>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">
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
          <TrafficList
            v-if="view === 'list' && traffic"
            :traffic="traffic"
            :selection="selection"
            @select="select"
          />
          <ClientOnly v-else-if="view === 'graph'">
            <div class="h-[calc(100dvh-12rem)] min-h-96">
              <TrafficGraph
                :traffic="traffic ?? { hosts: [], services: [], listeners: [], flows: [], truncated: false }"
                :layout="traffic ? layout : null"
                :error="layoutError"
                :selection="selection"
                @select="select"
                @retry="relayout"
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
