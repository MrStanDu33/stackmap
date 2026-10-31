<script setup lang="ts">
import { hopSentence, indexTrace, listenerName } from '../../utils/trace-index';
import { originLabel, portLabel } from '../../utils/traffic-index';

import type { Trace, TraceStep } from '#shared/contracts/traces';
import type { TraceSelection } from '../../utils/trace-index';

/** A selected step with its hops in order, or a listener (or the client) with the steps in and out of it. */
const props = defineProps<{ trace: Trace; selection: TraceSelection }>();
const emit = defineEmits<{ select: [selection: TraceSelection]; close: [] }>();

const i18n = useI18n();
const { t } = i18n;
const exists = (key: string) => i18n.te(key);
const index = computed(() => indexTrace(props.trace));

const step = computed(() => (props.selection.type === 'step' ? index.value.step(props.selection.id) : undefined));
const listener = computed(() => (props.selection.type === 'listener'
  ? index.value.listener(props.selection.id)
  : undefined));
const clientName = computed(() => t(`traffic.client.${props.trace.client}`));

/** Where a step starts or ends: the client, or a listener's service and port. */
const endName = (id: string) => {
  if (id === 'client') {
    return clientName.value;
  }
  const end = index.value.listener(id);
  return end ? listenerName(end) : '';
};
const stepName = (item: TraceStep) => {
  const target = index.value.listener(item.target);
  const source = item.source === 'client' ? clientName.value : index.value.listener(item.source)?.serviceName ?? '';
  return t('trace.step', { source, service: target?.serviceName ?? '', port: target ? portLabel(target) : '' });
};
const endOf = (id: string): TraceSelection => (id === 'client' ? { type: 'client', id } : { type: 'listener', id });

const title = computed(() => {
  if (step.value) {
    return stepName(step.value);
  }
  if (listener.value) {
    return listenerName(listener.value);
  }
  return clientName.value;
});
const nodeId = computed(() => (props.selection.type === 'client' ? 'client' : props.selection.id));
const into = computed(() => (step.value ? [] : index.value.stepsInto(nodeId.value)));
const out = computed(() => (step.value ? [] : index.value.stepsFrom(nodeId.value)));

const groups = computed(() => [
  { key: 'in', title: t('detail.incoming'), steps: into.value },
  { key: 'out', title: t('detail.outgoing'), steps: out.value },
]);
const roleName = (item: TraceStep) =>
  (item.role === 'request' ? t('trace.role.request') : t('trace.role.dependency', { depth: item.depth }));

const yesNo = (value: boolean | null) => {
  if (value === null) {
    return t('detail.unknown');
  }
  return value ? t('detail.yes') : t('detail.no');
};

const position = computed(() => (step.value ? index.value.position(step.value.id) : undefined));

const root = useTemplateRef<HTMLElement>('root');
const heading = useTemplateRef<HTMLElement>('heading');
let walking = false;
// Following a link inside the panel replaces what holds the focus: move it to the new title rather than lose it.
// Previous and Next stay where they are, so they can be pressed again.
watch(() => props.selection, async () => {
  const inside = root.value?.contains(document.activeElement) ?? false;
  await nextTick();
  if (inside && !walking) {
    heading.value?.focus();
  }
  walking = false;
});

const walk = async (direction: 'previous' | 'next') => {
  const id = position.value?.[direction];
  if (!id) {
    return;
  }
  walking = true;
  emit('select', { type: 'step', id });
  await nextTick();
  // At either end the pressed button is disabled, which drops the focus: hand it to the other one.
  const buttons = root.value?.querySelectorAll<HTMLButtonElement>('[data-walk]') ?? [];
  const pressed = [...buttons].find((button) => button.dataset.walk === direction);
  if (pressed?.disabled) {
    [...buttons].find((button) => button !== pressed)?.focus();
  }
};

const link = 'rounded-sm text-start underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary';
</script>

<template>
  <aside
    ref="root"
    aria-labelledby="trace-detail-title"
    class="flex flex-col gap-4"
  >
    <div class="flex items-start justify-between gap-2">
      <h2
        id="trace-detail-title"
        ref="heading"
        tabindex="-1"
        class="text-lg font-semibold outline-none focus-visible:outline-2 focus-visible:outline-primary"
      >
        {{ title }}
      </h2>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        :aria-label="t('detail.close')"
        @click="emit('close')"
      />
    </div>

    <template v-if="step">
      <nav
        v-if="position && position.total > 1"
        :aria-label="t('trace.walk.label')"
        class="flex flex-wrap items-center justify-between gap-2"
      >
        <p class="text-sm text-muted">
          {{ t('trace.walk.position', { position: position.position, total: position.total }) }}
        </p>
        <div class="flex gap-2">
          <UButton
            data-walk="previous"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="outline"
            :disabled="!position.previous"
            @click="walk('previous')"
          >
            {{ t('trace.walk.previous') }}
          </UButton>
          <UButton
            data-walk="next"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="outline"
            :disabled="!position.next"
            @click="walk('next')"
          >
            {{ t('trace.walk.next') }}
          </UButton>
        </div>
      </nav>
      <p
        v-else-if="position"
        class="text-sm text-muted"
      >
        {{ t('trace.walk.position', { position: position.position, total: position.total }) }}
      </p>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt class="text-muted">
          {{ t('detail.from') }}
        </dt>
        <dd>
          <button
            type="button"
            :class="link"
            @click="emit('select', endOf(step.source))"
          >
            {{ endName(step.source) }}
          </button>
        </dd>
        <dt class="text-muted">
          {{ t('detail.to') }}
        </dt>
        <dd>
          <button
            type="button"
            :class="link"
            @click="emit('select', endOf(step.target))"
          >
            {{ endName(step.target) }}
          </button>
        </dd>
        <dt class="text-muted">
          {{ t('detail.kind') }}
        </dt>
        <dd>{{ roleName(step) }}</dd>
        <dt class="text-muted">
          {{ t('detail.origin') }}
        </dt>
        <dd>{{ originLabel(step.flow, t) }}</dd>
        <dt class="text-muted">
          {{ t('detail.protocol') }}
        </dt>
        <dd>{{ step.flow.protocol ?? t('detail.unknown') }}</dd>
        <dt class="text-muted">
          {{ t('detail.encrypted') }}
        </dt>
        <dd>{{ yesNo(step.flow.encrypted) }}</dd>
        <template v-if="step.flow.purpose">
          <dt class="text-muted">
            {{ t('detail.purpose') }}
          </dt>
          <dd>{{ step.flow.purpose }}</dd>
        </template>
      </dl>
      <p
        v-if="step.cycle"
        class="text-sm text-muted"
      >
        {{ t('trace.cycleNote', { target: endName(step.target) }) }}
      </p>
      <section>
        <h3 class="font-medium">
          {{ t('trace.hops') }}
        </h3>
        <ol
          v-if="step.hops.length > 0"
          :aria-label="t('trace.hops')"
          class="flex flex-col gap-1 text-sm"
        >
          <i18n-t
            v-for="hop in step.hops"
            :key="`${hop.entity}:${hop.id}`"
            keypath="trace.hopWithStage"
            tag="li"
            scope="global"
          >
            <template #stage>
              <span class="font-medium">{{ t(`trace.stage.${hop.stage}`) }}</span>
            </template>
            <template #sentence>
              <span>{{ hopSentence(hop, t, exists) }}</span>
            </template>
          </i18n-t>
        </ol>
        <p
          v-else
          class="text-sm text-muted"
        >
          {{ t('trace.noHop') }}
        </p>
      </section>
    </template>

    <template v-else>
      <dl
        v-if="listener"
        class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
      >
        <dt class="text-muted">
          {{ t('detail.host') }}
        </dt>
        <dd>{{ listener.hostName ?? t('traffic.external') }}</dd>
        <dt class="text-muted">
          {{ t('detail.protocol') }}
        </dt>
        <dd>{{ listener.protocol ?? t('detail.unknown') }}</dd>
        <dt class="text-muted">
          {{ t('detail.publishedPort') }}
        </dt>
        <dd>{{ listener.publishedPort ?? t('detail.none') }}</dd>
      </dl>
      <section
        v-for="group in groups"
        :key="group.key"
      >
        <h3 class="font-medium">
          {{ group.title }}
        </h3>
        <ul class="flex flex-col gap-1 text-sm">
          <li
            v-for="item in group.steps"
            :key="item.id"
          >
            <button
              type="button"
              :class="link"
              @click="emit('select', { type: 'step', id: item.id })"
            >
              {{ stepName(item) }}
            </button>
          </li>
          <li
            v-if="group.steps.length === 0"
            class="text-muted"
          >
            {{ t('detail.none') }}
          </li>
        </ul>
      </section>
    </template>
  </aside>
</template>
