<script setup lang="ts">
import { hopSentence, indexTrace, listenerName } from '../../utils/trace-index';
import { portLabel } from '../../utils/traffic-index';

import type { Trace, TraceStep } from '#shared/contracts/traces';
import type { TraceSelection } from '../../utils/trace-index';

/** A trace as an ordered list of steps with their hops: the accessible equivalent of the graph. */
const props = defineProps<{ trace: Trace; selection?: TraceSelection | null }>();
const emit = defineEmits<{ select: [selection: TraceSelection] }>();

const i18n = useI18n();
const { t } = i18n;
const index = computed(() => indexTrace(props.trace));
const exists = (key: string) => i18n.te(key);

const groups = computed(() => [
  { key: 'request', title: t('trace.request'), steps: index.value.request },
  ...index.value.dependencies.map(([depth, steps]) => ({ key: `level-${String(depth)}`, title: t('trace.level', { depth }), steps })),
]);

/** "From Internet to Nginx Proxy Manager, port 443/tcp": its group says whether it is a dependency. */
const name = (step: TraceStep) => {
  const target = index.value.listener(step.target);
  const source = step.source === 'client'
    ? t(`traffic.client.${props.trace.client}`)
    : index.value.listener(step.source)?.serviceName ?? '';
  return t('trace.step', { source, service: target?.serviceName ?? '', port: target ? portLabel(target) : '' });
};
const targetName = (step: TraceStep) => {
  const target = index.value.listener(step.target);
  return target ? listenerName(target) : '';
};

const root = useTemplateRef<HTMLElement>('root');
// A step selected from the panel may be out of view: bring it in, without moving the page more than needed.
watch(() => props.selection, async (selected) => {
  if (selected?.type !== 'step') {
    return;
  }
  await nextTick();
  root.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
});

const link = 'rounded-sm text-start underline-offset-2 hover:underline focus-visible:outline-2 '
  + 'focus-visible:outline-primary aria-[current=true]:font-semibold aria-[current=true]:text-primary';
</script>

<template>
  <div
    ref="root"
    class="flex flex-col gap-6"
  >
    <section
      v-for="group in groups"
      :key="group.key"
      :aria-labelledby="`trace-${group.key}`"
    >
      <h2
        :id="`trace-${group.key}`"
        class="mb-2 text-lg font-semibold"
      >
        {{ group.title }}
      </h2>
      <ol class="flex flex-col gap-3">
        <li
          v-for="step in group.steps"
          :key="step.id"
        >
          <button
            type="button"
            :class="link"
            :aria-current="selection?.type === 'step' && selection.id === step.id ? 'true' : undefined"
            @click="emit('select', { type: 'step', id: step.id })"
          >
            {{ name(step) }}
          </button>
          <p
            v-if="step.cycle"
            class="text-sm text-muted"
          >
            {{ t('trace.cycleNote', { target: targetName(step) }) }}
          </p>
          <ol
            v-if="step.hops.length > 0"
            :aria-label="t('trace.hops')"
            class="ms-4 mt-1 list-decimal ps-4 text-sm text-muted"
          >
            <li
              v-for="hop in step.hops"
              :key="`${hop.entity}:${hop.id}`"
            >
              {{ hopSentence(hop, t, exists) }}
            </li>
          </ol>
          <p
            v-else
            class="ms-4 mt-1 text-sm text-muted"
          >
            {{ t('trace.noHop') }}
          </p>
        </li>
      </ol>
    </section>
  </div>
</template>
