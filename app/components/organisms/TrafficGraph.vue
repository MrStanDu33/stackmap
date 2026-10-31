<script setup lang="ts">
import { Handle, Position, useVueFlow, VueFlow, getSmoothStepPath } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';

import { SIZES } from '../../utils/traffic-graph';
import { portLabel } from '../../utils/traffic-index';
import { relatedFlowIds } from '../../utils/traffic-selection';

import type { Traffic, TrafficFlow } from '#shared/contracts/traffic';
import type { TrafficLayout } from '../../utils/traffic-graph';
import type { Selection } from '../../utils/traffic-selection';
import type { EdgeProps } from '@vue-flow/core';

/** The traffic drawn as a read-only graph: hosts holding services, services with their ports, flows to ports. */
const props = defineProps<{
  traffic: Traffic;
  layout: TrafficLayout | null;
  error?: unknown;
  selection?: Selection | null;
}>();
const emit = defineEmits<{ select: [selection: Selection | null]; retry: [] }>();

const { t } = useI18n();
const flowId = useId();
const { zoomIn, zoomOut, fitView } = useVueFlow(flowId);

const TYPES: Record<string, Selection['type']> = {
  client: 'client', host: 'host', service: 'service', listener: 'listener', flow: 'flow',
};

/** `service:<id>` → `{ type: 'service', id }`. */
const selectionOf = (elementId: string): Selection | null => {
  const separator = elementId.indexOf(':');
  const type = TYPES[elementId.slice(0, separator)];
  return type ? { type, id: elementId.slice(separator + 1) } : null;
};

const related = computed(() => (props.selection ? relatedFlowIds(props.traffic, props.selection) : null));
const flowState = (flow: TrafficFlow) => {
  if (!related.value) {
    return 'normal';
  }
  return related.value.has(flow.id) ? 'highlighted' : 'dimmed';
};

const isSelected = (elementId: string) => {
  const selection = selectionOf(elementId);
  return selection?.type === props.selection?.type && selection?.id === props.selection?.id;
};

const nodes = computed(() => (props.layout?.nodes ?? []).map((node) => ({
  ...node,
  draggable: false,
  connectable: false,
  focusable: true,
  class: isSelected(node.id) ? 'is-selected' : undefined,
})));
const edges = computed(() => (props.layout?.edges ?? []).map((edge) => ({
  ...edge,
  type: 'traffic',
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
  resized?.disconnect();
});

const clientClass = 'flex h-full items-center justify-center rounded-full border border-default bg-elevated px-4 '
  + 'text-sm font-medium data-selected:ring-2 data-selected:ring-primary';

const edgePath = (edge: EdgeProps) => getSmoothStepPath(edge)[0];
const portTop = (index: number) => `${String(SIZES.service.header + index * SIZES.service.port + SIZES.service.port / 2)}px`;
</script>

<template>
  <div
    ref="root"
    class="relative flex h-full min-h-96 flex-col rounded-lg border border-default bg-default"
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
        {{ t('traffic.loading') }}
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
      v-else-if="layout.nodes.length === 0"
      class="m-auto flex flex-col items-center gap-1 p-6 text-center"
    >
      <p class="font-medium">
        {{ t('traffic.empty') }}
      </p>
      <p class="text-muted">
        {{ t('traffic.emptyHint') }}
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
        :aria-label="t('traffic.canvas')"
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
          @nodes-initialized="fit"
          @node-click="({ node }) => select(node.id)"
          @edge-click="({ edge }) => select(edge.id)"
          @pane-click="emit('select', null)"
        >
          <template #node-client="{ id, data }">
            <div
              :class="clientClass"
              :data-selected="isSelected(id) || undefined"
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

          <template #node-host="{ id, data }">
            <div
              class="h-full rounded-lg border border-dashed border-accented bg-muted/40 p-3"
              :class="{ 'ring-2 ring-primary': isSelected(id) }"
            >
              <p class="flex items-center gap-2 text-sm font-semibold">
                <UIcon
                  name="i-lucide-server"
                  class="size-4"
                  aria-hidden="true"
                />
                {{ data.host.name }}
              </p>
              <p class="text-xs text-muted">
                {{ data.host.kind }}
              </p>
            </div>
          </template>

          <template #node-service="{ id, data }">
            <div
              class="h-full overflow-hidden rounded-md border border-default bg-default text-sm shadow-sm"
              :class="{ 'ring-2 ring-primary': isSelected(id) }"
            >
              <div
                class="px-3 py-2"
                :style="{ height: `${String(SIZES.service.header)}px` }"
              >
                <p class="truncate font-semibold">
                  {{ data.service.name }}
                </p>
                <p class="truncate text-xs text-muted">
                  {{ data.service.kind }}
                </p>
              </div>
              <ul>
                <li
                  v-for="port in data.listeners"
                  :key="port.id"
                  class="flex items-center gap-2 border-t border-default px-3 text-xs"
                  :style="{ height: `${String(SIZES.service.port)}px` }"
                >
                  <span class="font-mono">{{ portLabel(port) }}</span>
                  <span
                    v-if="port.protocol"
                    class="text-muted"
                  >{{ port.protocol }}</span>
                </li>
              </ul>
            </div>
            <Handle
              v-for="(port, index) in data.listeners"
              :id="`listener:${port.id}`"
              :key="port.id"
              type="target"
              :position="Position.Left"
              :connectable="false"
              :style="{ top: portTop(Number(index)) }"
            />
            <Handle
              type="source"
              :position="Position.Right"
              :connectable="false"
            />
          </template>

          <template #edge-traffic="edge">
            <g
              :data-flow="edge.data.flow.id"
              :data-flow-state="flowState(edge.data.flow)"
            >
              <path
                :d="edgePath(edge)"
                fill="none"
                class="traffic-edge"
                :class="`is-${flowState(edge.data.flow)}`"
              />
            </g>
          </template>
        </VueFlow>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Highlighted flows are thicker and solid, dimmed ones thin and dashed: never color alone. */
.traffic-edge {
  stroke: var(--ui-text-muted);
  stroke-width: 1.5;
}

.traffic-edge.is-highlighted {
  stroke: var(--ui-primary);
  stroke-width: 3;
}

.traffic-edge.is-dimmed {
  opacity: 0.35;
  stroke-dasharray: 4 4;
}
</style>
