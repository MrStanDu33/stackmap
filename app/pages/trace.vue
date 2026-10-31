<script setup lang="ts">
import type { Trace } from '#shared/contracts/traces';
import type { Traffic } from '#shared/contracts/traffic';
import type { WorkspaceSummary } from '#shared/contracts/workspaces';
import type { TraceSelection } from '~/utils/trace-index';
import type { TraceQuery } from '~/utils/trace-query';

import { MAX_TRACE_NODES, MAX_TRACE_STEPS } from '#shared/contracts/traces';
import { DEMO_WORKSPACE_SLUG } from '#shared/contracts/workspaces';
import { traceElkToVueFlow, traceToElk } from '~/utils/trace-graph';
import { indexTrace, listenerName, stepName } from '~/utils/trace-index';
import { parseTraceQuery } from '~/utils/trace-query';
import { parseSelected, selectedParam } from '~/utils/trace-selection';

const { t, n, locale } = useI18n();
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
const invalid = computed(() => Object.keys(parsed.value.errors).length > 0);

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
// Events only: the result when it arrives, then each selection.
const announcement = ref('');

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
// The old result goes as soon as another is asked for: it would otherwise pass for the new one while loading.
watch(traceUrl, (url) => {
  selection.value = null;
  announcement.value = '';
  clearTrace();
  if (url) {
    void refreshTrace();
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
const tryOther = async () => {
  if (query.value) {
    submit({ ...query.value, client: otherClient.value });
  }
  // The button goes with the old result: focus would be lost.
  await focusHeading();
};
const retryLayout = async () => {
  relayout();
  await focusHeading();
};

// With nothing traced yet, the form is where to start.
onMounted(() => {
  // With errors, the form focuses the first one itself.
  if (!raw.value.hostname && !invalid.value) {
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
    || target?.closest('form[role="search"], [role="combobox"], [role="listbox"], [role="menu"], [role="dialog"]');
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

watch(trace, (loaded) => {
  if (!loaded || !index.value) {
    return;
  }
  if (loaded.steps.length === 0) {
    announcement.value = t(`trace.nothing.${loaded.client}`, { hostname: loaded.hostname });
    return;
  }
  const { entries, request, dependencies } = index.value;
  const dependencyCount = dependencies.reduce((sum, [, steps]) => sum + steps.length, 0);
  // Named: a new result with the same counts is still told apart from the last one.
  announcement.value = t(`trace.summary.${loaded.client}`, {
    hostname: loaded.hostname,
    entries: t('trace.count.entries', { count: entries }, entries),
    steps: t('trace.count.steps', { count: request.length }, request.length),
    dependencies: t('trace.count.dependencies', { count: dependencyCount }, dependencyCount),
  });
});
// The selection is kept in the URL so a step can be linked; replaced, so Back leaves the page.
const writeSelected = (value: string | undefined) => {
  if (route.query.selected !== value) {
    void router.replace({ query: { ...route.query, selected: value } });
  }
};
// A linked selection is checked once its trace has arrived; one that is not in it is dropped.
let restored = false;
watch(index, (loaded) => {
  if (loaded && route.query.selected !== undefined) {
    restored = true;
    selection.value = parseSelected(route.query.selected, loaded);
    writeSelected(selectedParam(selection.value));
  }
});
watch(selection, (selected) => {
  if (index.value) {
    writeSelected(selectedParam(selected));
  }
  const name = selected ? selectionName(selected) : undefined;
  const position = selected?.type === 'step' ? index.value?.position(selected.id) : undefined;
  if (name && position) {
    const step = t('trace.walk.announce', { ...position, name });
    // Restored from a link: the result's summary, set in the same tick, is said first rather than replaced.
    announcement.value = restored ? `${announcement.value} ${step}` : step;
    restored = false;
    return;
  }
  restored = false;
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
      v-else-if="!query && !invalid"
      class="text-muted"
    >
      {{ t('trace.start') }}
    </p>

    <p
      v-else-if="query && !trace"
      class="p-6 text-center text-muted"
    >
      {{ t('trace.loading', { hostname: query.hostname }) }}
    </p>

    <div
      v-else-if="trace && trace.steps.length === 0"
      class="flex flex-col items-start gap-3 rounded-md border border-default p-6"
    >
      <p>{{ t(`trace.nothing.${trace.client}`, { hostname: trace.hostname }) }}</p>
      <UButton
        variant="outline"
        @click="tryOther"
      >
        {{ t(`trace.tryOther.${otherClient}`) }}
      </UButton>
    </div>

    <template v-else-if="trace">
      <!-- Above the results, after the form: in reading order, before what it switches. -->
      <ViewToggle
        v-model="view"
        class="self-start"
      />
      <!-- For the whole page, either view: the status says it once when the result arrives. -->
      <UAlert
        v-if="trace.truncated"
        role="status"
        color="warning"
        variant="outline"
        :title="t('trace.truncated', { nodes: n(MAX_TRACE_NODES), steps: n(MAX_TRACE_STEPS) })"
      />
      <div
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
    </template>
  </AppShell>
</template>
