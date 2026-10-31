<script setup lang="ts">
import type { Trace } from '#shared/contracts/traces';
import type { Traffic } from '#shared/contracts/traffic';
import type { WorkspaceSummary } from '#shared/contracts/workspaces';
import type { TraceSelection } from '~/utils/trace-index';
import type { TraceQuery } from '~/utils/trace-query';

import { DEMO_WORKSPACE_SLUG } from '#shared/contracts/workspaces';
import { traceElkToVueFlow, traceToElk } from '~/utils/trace-graph';
import { indexTrace, listenerName, stepName } from '~/utils/trace-index';
import { parseTraceQuery } from '~/utils/trace-query';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();

useHead({ title: () => `${t('trace.title')} · ${t('app.name')}` });

// The URL is the source of truth: the form writes it, and it decides what is traced.
const raw = computed(() => ({
  hostname: typeof route.query.hostname === 'string' ? route.query.hostname : undefined,
  client: typeof route.query.client === 'string' ? route.query.client : undefined,
  port: typeof route.query.port === 'string' ? route.query.port : undefined,
}));
const parsed = computed(() => parseTraceQuery(raw.value));
const query = computed(() => parsed.value.query);

const view = computed({
  get: () => (route.query.view === 'list' ? 'list' : 'graph'),
  set: (value: 'graph' | 'list') => {
    void router.replace({ query: { ...route.query, view: value === 'list' ? 'list' : undefined } });
  },
});

const submit = (next: TraceQuery) => {
  void router.push({
    query: {
      hostname: next.hostname,
      client: next.client,
      port: next.port === null ? undefined : String(next.port),
      view: route.query.view,
    },
  });
};

// On the client only, as the Traffic view.
const {
  data: workspaces, error: workspaceError, refresh: refreshWorkspaces,
} = useFetch<{ workspaces: WorkspaceSummary[] }>('/api/workspaces', {
  query: { slug: DEMO_WORKSPACE_SLUG },
  server: false,
});
const workspace = computed(() => workspaces.value?.workspaces[0]);

// The workspace's names, suggested in the form; if they cannot be read, the form works without them.
const trafficUrl = computed(() => (workspace.value ? `/api/workspaces/${workspace.value.id}/traffic` : ''));
const { data: traffic, refresh: refreshTraffic } = useFetch<Traffic>(trafficUrl, {
  server: false, immediate: false, watch: false,
});
watch(trafficUrl, (url) => {
  if (url) {
    void refreshTraffic();
  }
}, { immediate: true });
const suggestions = computed(() => [...new Set((traffic.value?.flows ?? []).flatMap(({ hostnames }) => hostnames))]
  .filter((name) => !name.startsWith('*.'))
  .toSorted());

const selection = ref<TraceSelection | null>(null);

const traceUrl = computed(() => {
  if (!workspace.value || !query.value) {
    return '';
  }
  const search = new URLSearchParams({ hostname: query.value.hostname, client: query.value.client });
  if (query.value.port !== null) {
    search.set('port', String(query.value.port));
  }
  return `/api/workspaces/${workspace.value.id}/trace?${search.toString()}`;
});
const { data: trace, error: traceError, refresh: refreshTrace, clear: clearTrace } = useFetch<Trace>(traceUrl, {
  server: false, immediate: false, watch: false,
});
watch(traceUrl, (url) => {
  selection.value = null;
  if (url) {
    void refreshTrace();
  } else {
    clearTrace();
  }
}, { immediate: true });

const shown = computed(() => trace.value ?? undefined);
const { layout, error: layoutError, retry: relayout } = useElkLayout(shown, {
  t, toElk: traceToElk, toFlow: traceElkToVueFlow,
});
watch(locale, relayout);

const failed = computed(() => Boolean(workspaceError.value ?? traceError.value));
const noWorkspace = computed(() => workspaces.value !== undefined && !workspace.value);
const otherClient = computed(() => (query.value?.client === 'public' ? 'internal' : 'public'));

const heading = useTemplateRef<HTMLElement>('heading');
const focusHeading = async () => {
  await nextTick();
  heading.value?.focus();
};
const retry = async () => {
  await refreshWorkspaces();
  if (traceUrl.value) {
    await refreshTrace();
  }
  await focusHeading();
};
const retryLayout = async () => {
  relayout();
  await focusHeading();
};

// With nothing traced yet, the form is where to start.
onMounted(() => {
  if (!raw.value.hostname) {
    document.querySelector<HTMLInputElement>('form[role="search"] [name="hostname"]')?.focus();
  }
});

const index = computed(() => (trace.value ? indexTrace(trace.value) : undefined));
let opener: HTMLElement | null = null;

const select = (next: TraceSelection | null) => {
  const same = next && selection.value?.type === next.type && selection.value.id === next.id;
  if (next && !selection.value) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  selection.value = same ? null : next;
};
const close = () => {
  selection.value = null;
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

const clientName = (client: 'public' | 'internal') => t(`traffic.client.${client}`);
const selectionName = (selected: TraceSelection) => {
  if (!trace.value || !index.value) {
    return undefined;
  }
  if (selected.type === 'client') {
    return clientName(trace.value.client);
  }
  if (selected.type === 'listener') {
    const listener = index.value.listener(selected.id);
    return listener && listenerName(listener);
  }
  const step = index.value.step(selected.id);
  return step && stepName(index.value, trace.value, step, t);
};

// Events only: the result when it arrives, then each selection.
const announcement = ref('');
watch(trace, (loaded) => {
  if (!loaded || !index.value) {
    return;
  }
  if (loaded.steps.length === 0) {
    announcement.value = t('trace.nothing', { hostname: loaded.hostname, client: clientName(loaded.client) });
    return;
  }
  const { entries, request, dependencies } = index.value;
  const dependencyCount = dependencies.reduce((sum, [, steps]) => sum + steps.length, 0);
  announcement.value = t('trace.summary', {
    entries: t('trace.count.entries', { count: entries }, entries),
    steps: t('trace.count.steps', { count: request.length }, request.length),
    dependencies: t('trace.count.dependencies', { count: dependencyCount }, dependencyCount),
  });
});
watch(selection, (selected) => {
  const name = selected ? selectionName(selected) : undefined;
  announcement.value = name ? t('trace.selected', { name }) : '';
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
        {{ t('trace.title') }}
      </h1>
      <ViewToggle
        v-if="trace && trace.steps.length > 0"
        v-model="view"
      />
    </div>

    <TraceForm
      :query="raw"
      :errors="parsed.errors"
      :suggestions="suggestions"
      @submit="submit"
    />

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
      <p>{{ t('trace.error') }}</p>
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

    <p
      v-else-if="!query"
      class="text-muted"
    >
      {{ t('trace.start') }}
    </p>

    <p
      v-else-if="!trace"
      class="p-6 text-center text-muted"
    >
      {{ t('trace.loading', { hostname: query.hostname }) }}
    </p>

    <div
      v-else-if="trace.steps.length === 0"
      class="flex flex-col items-start gap-3 rounded-md border border-default p-6"
    >
      <p>{{ t('trace.nothing', { hostname: trace.hostname, client: clientName(trace.client) }) }}</p>
      <UButton
        variant="outline"
        @click="submit({ ...query, client: otherClient })"
      >
        {{ t('trace.tryOther', { client: clientName(otherClient) }) }}
      </UButton>
    </div>

    <div
      v-else
      class="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row"
    >
      <div class="min-w-0 flex-1">
        <TraceSteps
          v-if="view === 'list'"
          :trace="trace"
          :selection="selection"
          @select="select"
        />
        <ClientOnly v-else>
          <div class="h-[calc(100dvh-16rem)] min-h-96 max-lg:max-h-[70dvh]">
            <TraceGraph
              :trace="trace"
              :layout="layout"
              :error="layoutError"
              :selection="selection"
              @select="select"
              @retry="retryLayout"
            />
          </div>
        </ClientOnly>
      </div>
      <TraceDetailPanel
        v-if="selection && selectionName(selection)"
        class="w-full shrink-0 rounded-lg border border-default p-4 lg:w-96"
        :trace="trace"
        :selection="selection"
        @select="select"
        @close="close"
      />
    </div>
  </AppShell>
</template>
