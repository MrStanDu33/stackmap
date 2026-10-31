<script setup lang="ts">
import { Handle, Position, useVueFlow, VueFlow, getSmoothStepPath } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';

import { listenerPort } from '../../utils/trace-graph';

import type { Trace, TraceStep } from '#shared/contracts/traces';
import type { TraceSelection } from '../../utils/trace-index';
import type { TrafficLayout } from '../../utils/traffic-graph';
import type { EdgeProps, Node } from '@vue-flow/core';

/** A trace drawn as a read-only path: the client, the listeners it reaches, then the dependencies. */
const props = defineProps<{
  trace: Trace;
  layout: TrafficLayout | null;
  error?: unknown;
  selection?: TraceSelection | null;
}>();
const emit = defineEmits<{ select: [selection: TraceSelection | null]; retry: [] }>();

const { t } = useI18n();
const flowId = useId();
const { zoomIn, zoomOut, fitView, viewport, setCenter, findNode, dimensions } = useVueFlow(flowId);

const TYPES: Record<string, TraceSelection['type']> = { client: 'client', listener: 'listener', step: 'step' };

/** `listener:<id>` → `{ type: 'listener', id }`; the client node is `client`. */
const selectionOf = (elementId: string): TraceSelection | null => {
  if (elementId === 'client') {
    return { type: 'client', id: 'client' };
  }
  const separator = elementId.indexOf(':');
  const type = TYPES[elementId.slice(0, separator)];
  return type ? { type, id: elementId.slice(separator + 1) } : null;
};

/** The steps a selection lights up: the step itself, or every step in or out of the node. */
const related = computed(() => {
  const selected = props.selection;
  if (!selected) {
    return null;
  }
  return new Set(props.trace.steps.filter((step) => (selected.type === 'step'
    ? step.id === selected.id
    : step.source === selected.id || step.target === selected.id)).map(({ id }) => id));
});
const stepState = (step: TraceStep) => {
  if (!related.value) {
    return 'normal';
  }
  return related.value.has(step.id) ? 'highlighted' : 'dimmed';
};

/** A node is pressed when it is selected, or is an end of the selected step. */
const isSelected = (elementId: string) => {
  const selection = selectionOf(elementId);
  const selected = props.selection;
  if (!selection || !selected) {
    return false;
  }
  if (selected.type === 'step') {
    const step = props.trace.steps.find(({ id }) => id === selected.id);
    return step !== undefined && [step.source, step.target].includes(selection.id);
  }
  return selection.type === selected.type && selection.id === selected.id;
};

const nodes = computed(() => (props.layout?.nodes ?? []).map((node): Node => ({
  ...node,
  draggable: false,
  connectable: false,
  focusable: true,
  // The selected state is exposed, not only drawn.
  domAttributes: { ...node.domAttributes, 'aria-pressed': isSelected(node.id) ? 'true' : 'false' },
})));
const edges = computed(() => (props.layout?.edges ?? []).map((edge) => ({
  ...edge,
  type: 'trace',
  focusable: false,
  selectable: false,
})));

/** No animation when the user asks for reduced motion, or in RGAA strict mode. */
const duration = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches
  || document.documentElement.getAttribute('data-contrast') === 'strict'
  ? 0
  : 200);

const fit = () => {
  void fitView({ duration: duration(), padding: 0.1 });
};

const select = (elementId: string) => {
  emit('select', selectionOf(elementId));
};

/** Enter or Space on a focused node selects it, as a click does. */
/**
 * A node that gets focus outside the canvas is brought into view by panning, keeping the zoom: focus is never hidden,
 * and Tab is a way to move around the graph. The browser's own scrolling of the clipped canvas is undone first, since
 * it would shift the graph under the pointer.
 */
const onFocusin = (event: FocusEvent) => {
  const element = event.target instanceof HTMLElement ? event.target : null;
  const canvas = element?.closest<HTMLElement>('.vue-flow');
  const node = element?.dataset.id ? findNode(element.dataset.id) : undefined;
  if (!element || !canvas || !node) {
    return;
  }
  canvas.scrollTo(0, 0);
  const shown = element.getBoundingClientRect();
  const room = canvas.getBoundingClientRect();
  if (shown.left >= room.left && shown.right <= room.right && shown.top >= room.top && shown.bottom <= room.bottom) {
    return;
  }
  const { x, y } = node.computedPosition;
  void setCenter(x + node.dimensions.width / 2, y + node.dimensions.height / 2, {
    zoom: viewport.value.zoom,
    duration: duration(),
  });
};

const nodeIdOf = (end: string) => (end === 'client' ? 'client' : `listener:${end}`);

// A step selected from the panel or the list may be out of view: pan to its middle, keeping the zoom.
watch(() => props.selection, (selected) => {
  const step = selected?.type === 'step' ? props.trace.steps.find(({ id }) => id === selected.id) : undefined;
  const ends = step ? [findNode(nodeIdOf(step.source)), findNode(nodeIdOf(step.target))] : [];
  if (ends.length === 0 || ends.some((node) => !node)) {
    return;
  }
  const centres = ends.map((node) => ({
    x: node!.computedPosition.x + node!.dimensions.width / 2,
    y: node!.computedPosition.y + node!.dimensions.height / 2,
  }));
  const x = (centres[0]!.x + centres[1]!.x) / 2;
  const y = (centres[0]!.y + centres[1]!.y) / 2;
  const { zoom } = viewport.value;
  const shownX = x * zoom + viewport.value.x;
  const shownY = y * zoom + viewport.value.y;
  if (shownX >= 0 && shownX <= dimensions.value.width && shownY >= 0 && shownY <= dimensions.value.height) {
    return;
  }
  // Linear: the default smooth path zooms out and back in on the way, which a pan keeping the zoom should not.
  void setCenter(x, y, { zoom, duration: duration(), interpolate: 'linear' });
});

const onKeydown = (event: KeyboardEvent) => {
  const element = event.target instanceof HTMLElement ? event.target : null;
  const nodeId = element?.classList.contains('vue-flow__node') ? element.dataset.id : undefined;
  if (nodeId && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    select(nodeId);
  }
};

// Nodes are focusable; the listener sits on the root, which is always rendered.
const root = useTemplateRef<HTMLElement>('root');
// The view fits again when its room changes: the detail panel opens, the window is resized.
let resized: ResizeObserver | undefined;
onMounted(() => {
  root.value?.addEventListener('keydown', onKeydown);
  root.value?.addEventListener('focusin', onFocusin);
  // Debounced: after Vue Flow has measured its new size, and once per resize rather than per frame.
  let pending: ReturnType<typeof setTimeout> | undefined;
  resized = new ResizeObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      if (props.layout?.nodes.length) {
        fit();
      }
    }, 100);
  });
  if (root.value) {
    resized.observe(root.value);
  }
});
onBeforeUnmount(() => {
  root.value?.removeEventListener('keydown', onKeydown);
  root.value?.removeEventListener('focusin', onFocusin);
  resized?.disconnect();
});

const clientClass = 'flex h-full items-center justify-center rounded-full border border-default bg-elevated px-4 '
  + 'text-sm font-medium';

const edgePath = (edge: EdgeProps) => getSmoothStepPath(edge)[0];
const listenerClass = 'flex h-full flex-col justify-center overflow-hidden rounded-md border border-default bg-default px-3 '
  + 'text-sm shadow-sm';

// Line styles tell the steps apart, never color alone: dependencies dashed, cycles round dots.
const DASHES: Record<string, string | undefined> = { request: undefined, dependency: '6 4', cycle: '0 5' };
const LEGEND = ['request', 'dependency', 'cycle'] as const;
const legendClass = 'absolute start-2 bottom-2 z-10 flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-default '
  + 'bg-default px-3 py-1.5 text-xs';
</script>

<template>
  <div
    ref="root"
    class="relative flex h-full min-h-96 flex-col rounded-lg border border-default bg-default"
    :style="{ '--graph-zoom': String(viewport.zoom) }"
  >
    <div
      v-if="error"
      role="alert"
      class="m-auto flex flex-col items-center gap-3 p-6 text-center"
    >
      <p>{{ t('traffic.layoutError') }}</p>
      <UButton
        icon="i-lucide-refresh-cw"
        @click="emit('retry')"
      >
        {{ t('common.retry') }}
      </UButton>
    </div>

    <div
      v-else-if="!layout"
      class="m-auto flex w-full max-w-md flex-col gap-3 p-6"
    >
      <p
        role="status"
        class="text-center text-muted"
      >
        {{ t('trace.loading', { hostname: trace.hostname }) }}
      </p>
      <!-- Placeholders only: the status above says what is happening. -->
      <div
        class="h-24 w-full animate-pulse rounded-md bg-elevated motion-reduce:animate-none"
        aria-hidden="true"
      />
      <div
        class="h-24 w-3/4 animate-pulse rounded-md bg-elevated motion-reduce:animate-none"
        aria-hidden="true"
      />
    </div>

    <div
      v-else-if="trace.steps.length === 0"
      class="m-auto flex flex-col items-center gap-1 p-6 text-center"
    >
      <p class="font-medium">
        {{ t(`trace.nothing.${trace.client}`, { hostname: trace.hostname }) }}
      </p>
    </div>

    <template v-else>
      <div class="absolute end-2 top-2 z-10 flex gap-1">
        <UButton
          icon="i-lucide-zoom-in"
          color="neutral"
          variant="outline"
          :aria-label="t('traffic.zoomIn')"
          @click="zoomIn({ duration: duration() })"
        />
        <UButton
          icon="i-lucide-zoom-out"
          color="neutral"
          variant="outline"
          :aria-label="t('traffic.zoomOut')"
          @click="zoomOut({ duration: duration() })"
        />
        <UButton
          icon="i-lucide-scan"
          color="neutral"
          variant="outline"
          :aria-label="t('traffic.fit')"
          @click="fit"
        />
      </div>
      <div
        class="min-h-0 flex-1"
        role="region"
        :aria-label="t('trace.canvas')"
      >
        <VueFlow
          :id="flowId"
          :nodes="nodes"
          :edges="edges"
          :nodes-draggable="false"
          :nodes-connectable="false"
          :elements-selectable="false"
          :disable-keyboard-a11y="true"
          :min-zoom="0.2"
          :zoom-on-scroll="false"
          :prevent-scrolling="false"
          @nodes-initialized="fit"
          @node-click="({ node }) => select(node.id)"
          @edge-click="({ edge }) => select(edge.id)"
          @pane-click="emit('select', null)"
        >
          <template #node-client="{ data }">
            <div
              :class="clientClass"
            >
              <UIcon
                :name="data.client === 'public' ? 'i-lucide-globe' : 'i-lucide-house'"
                class="me-2 size-4"
                aria-hidden="true"
              />
              {{ t(`traffic.client.${data.client}`) }}
            </div>
            <Handle
              type="source"
              :position="Position.Right"
              :connectable="false"
            />
          </template>

          <template #node-listener="{ data }">
            <div :class="listenerClass">
              <p class="truncate font-semibold">
                {{ data.listener.serviceName }}
              </p>
              <!-- Spaces between the parts: the accessible name must contain the text as read (WCAG 2.5.3). -->
              {{ ' ' }}
              <p class="truncate font-mono text-xs">
                {{ listenerPort(data.listener) }}
              </p>
              {{ ' ' }}
              <p class="truncate text-xs text-muted">
                {{ data.where }}
              </p>
            </div>
            <Handle
              type="target"
              :position="Position.Left"
              :connectable="false"
            />
            <Handle
              type="source"
              :position="Position.Right"
              :connectable="false"
            />
          </template>

          <template #edge-trace="edge">
            <g
              :data-step="edge.data.step.id"
              :data-step-kind="edge.data.kind"
              :data-step-state="stepState(edge.data.step)"
            >
              <path
                :d="edgePath(edge)"
                fill="none"
                vector-effect="non-scaling-stroke"
                :stroke-dasharray="DASHES[edge.data.kind]"
                :stroke-linecap="edge.data.kind === 'cycle' ? 'round' : undefined"
                class="trace-edge"
                :class="`is-${stepState(edge.data.step)}`"
              />
            </g>
          </template>
        </VueFlow>
      </div>
      <ul
        :class="legendClass"
        :aria-label="t('trace.legend.title')"
      >
        <li
          v-for="kind in LEGEND"
          :key="kind"
          class="flex items-center gap-2"
        >
          <svg
            width="24"
            height="6"
            aria-hidden="true"
          >
            <line
              x1="2"
              y1="3"
              x2="22"
              y2="3"
              class="trace-edge"
              :stroke-dasharray="DASHES[kind]"
              :stroke-linecap="kind === 'cycle' ? 'round' : undefined"
            />
          </svg>
          {{ t(`trace.legend.${kind}`) }}
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
/* Highlighted steps are thicker, dimmed ones faded; their dashes come from their kind. */
.trace-edge {
  stroke: var(--ui-text-muted);
  stroke-width: 1.5;
}

.trace-edge.is-highlighted {
  stroke: var(--ui-primary);
  stroke-width: 3;
}

.trace-edge.is-dimmed {
  /* Still 3:1 against the background: dimmed steps carry information too. */
  opacity: 0.6;
}

/*
 * Focus and selection are outlines, which forced-colors mode keeps (a ring is a shadow, which it drops). The nodes are
 * scaled with the zoom, so the outline is divided by it to keep its width on screen.
 */
:deep([data-id][role='button']:focus-visible) {
  outline: calc(3px / var(--graph-zoom, 1)) solid var(--ui-primary);
  outline-offset: calc(2px / var(--graph-zoom, 1));
}

:deep([data-id][aria-pressed='true']) {
  outline: calc(2px / var(--graph-zoom, 1)) solid var(--ui-primary);
  outline-offset: calc(2px / var(--graph-zoom, 1));
}

:deep([data-id][aria-pressed='true']:focus-visible) {
  outline-width: calc(4px / var(--graph-zoom, 1));
}
</style>
