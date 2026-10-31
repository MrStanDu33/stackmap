<script setup lang="ts">
import { indexTraffic, originLabel, portLabel, selectionName, targetName } from '../../utils/traffic-index';

import type { Traffic } from '#shared/contracts/traffic';
import type { Selection } from '../../utils/traffic-selection';

/** What is selected in the Traffic view, with what it is linked to. */
const props = defineProps<{ traffic: Traffic; selection: Selection }>();
const emit = defineEmits<{ select: [selection: Selection]; close: [] }>();

const { t } = useI18n();
const index = computed(() => indexTraffic(props.traffic));

const host = computed(() => (props.selection.type === 'host' ? index.value.host(props.selection.id) : undefined));
const service = computed(() => (props.selection.type === 'service' ? index.value.service(props.selection.id) : undefined));
const port = computed(() => (props.selection.type === 'listener' ? index.value.port(props.selection.id) : undefined));
const flow = computed(() => (props.selection.type === 'flow' ? index.value.flow(props.selection.id) : undefined));
const client = computed(() => (props.selection.type === 'client' ? props.selection.id : undefined));

const title = computed(() => selectionName(index.value, props.selection, t) ?? '');

const incoming = computed(() => (service.value
  ? index.value.portsOf(service.value.id).flatMap(({ id }) => index.value.flowsInto(id))
  : []));
const outgoing = computed(() => (service.value || client.value
  ? index.value.flowsFrom(props.selection)
  : []));

const yesNo = (value: boolean | null) => {
  if (value === null) {
    return t('detail.unknown');
  }
  return value ? t('detail.yes') : t('detail.no');
};

const select = (type: Selection['type'], id: string) => {
  emit('select', { type, id });
};

const link = 'rounded-sm text-start underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary';
</script>

<template>
  <aside
    aria-labelledby="traffic-detail-title"
    class="flex flex-col gap-4"
  >
    <div class="flex items-start justify-between gap-2">
      <h2
        id="traffic-detail-title"
        class="text-lg font-semibold"
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

    <dl
      v-if="host"
      class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
    >
      <dt class="text-muted">
        {{ t('detail.kind') }}
      </dt>
      <dd>{{ host.kind }}</dd>
    </dl>
    <section v-if="host">
      <h3 class="font-medium">
        {{ t('detail.services') }}
      </h3>
      <ul class="text-sm">
        <li
          v-for="item in index.servicesOf(host.id)"
          :key="item.id"
        >
          <button
            type="button"
            :class="link"
            @click="select('service', item.id)"
          >
            {{ item.name }}
          </button>
        </li>
        <li
          v-if="index.servicesOf(host.id).length === 0"
          class="text-muted"
        >
          {{ t('detail.none') }}
        </li>
      </ul>
    </section>

    <template v-if="service">
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt class="text-muted">
          {{ t('detail.kind') }}
        </dt>
        <dd>{{ service.kind }}</dd>
        <dt class="text-muted">
          {{ t('detail.host') }}
        </dt>
        <dd>
          <button
            v-if="service.hostId"
            type="button"
            :class="link"
            @click="select('host', service.hostId)"
          >
            {{ index.host(service.hostId)?.name }}
          </button>
          <template v-else>
            {{ t('traffic.external') }}
          </template>
        </dd>
      </dl>
      <section>
        <h3 class="font-medium">
          {{ t('detail.ports') }}
        </h3>
        <ul class="text-sm">
          <li
            v-for="item in index.portsOf(service.id)"
            :key="item.id"
          >
            <button
              type="button"
              :class="link"
              @click="select('listener', item.id)"
            >
              {{ portLabel(item) }}
              <span
                v-if="item.protocol"
                class="ms-1 text-muted"
              >{{ item.protocol }}</span>
            </button>
          </li>
        </ul>
      </section>
    </template>

    <dl
      v-if="port"
      class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
    >
      <dt class="text-muted">
        {{ t('detail.service') }}
      </dt>
      <dd>
        <button
          type="button"
          :class="link"
          @click="select('service', port.serviceId)"
        >
          {{ index.service(port.serviceId)?.name }}
        </button>
      </dd>
      <dt class="text-muted">
        {{ t('detail.protocol') }}
      </dt>
      <dd>{{ port.protocol ?? t('detail.unknown') }}</dd>
      <dt class="text-muted">
        {{ t('detail.publishedPort') }}
      </dt>
      <dd>{{ port.publishedPort ?? t('detail.none') }}</dd>
    </dl>

    <section v-if="service || port">
      <h3 class="font-medium">
        {{ t('detail.incoming') }}
      </h3>
      <ul class="flex flex-col gap-1 text-sm">
        <li
          v-for="item in port ? index.flowsInto(port.id) : incoming"
          :key="item.id"
        >
          <button
            type="button"
            :class="link"
            @click="select('flow', item.id)"
          >
            <span>{{ index.sourceName(item, t) }}</span> → {{ portLabel(index.port(item.targetListenerId) ?? port!) }}
          </button>
          <span
            v-if="item.hostnames.length > 0"
            class="ms-2 text-muted"
          >{{ item.hostnames.join(', ') }}</span>
        </li>
        <li
          v-if="(port ? index.flowsInto(port.id) : incoming).length === 0"
          class="text-muted"
        >
          {{ t('detail.none') }}
        </li>
      </ul>
    </section>

    <section v-if="service || client">
      <h3 class="font-medium">
        {{ t('detail.outgoing') }}
      </h3>
      <ul class="flex flex-col gap-1 text-sm">
        <li
          v-for="item in outgoing"
          :key="item.id"
        >
          <button
            type="button"
            :class="link"
            @click="select('service', index.serviceOfPort(item.targetListenerId)?.id ?? '')"
          >
            {{ index.serviceOfPort(item.targetListenerId)?.name }}
          </button>
          <span class="ms-1 text-muted">{{ portLabel(index.port(item.targetListenerId)!) }}</span>
        </li>
        <li
          v-if="outgoing.length === 0"
          class="text-muted"
        >
          {{ t('detail.none') }}
        </li>
      </ul>
    </section>

    <dl
      v-if="flow"
      class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
    >
      <dt class="text-muted">
        {{ t('detail.from') }}
      </dt>
      <dd>
        <button
          v-if="flow.source.type === 'service'"
          type="button"
          :class="link"
          @click="select('service', flow.source.serviceId)"
        >
          {{ index.sourceName(flow, t) }}
        </button>
        <template v-else>
          {{ index.sourceName(flow, t) }}
        </template>
      </dd>
      <dt class="text-muted">
        {{ t('detail.to') }}
      </dt>
      <dd>
        <button
          type="button"
          :class="link"
          @click="select('listener', flow.targetListenerId)"
        >
          {{ targetName(index, flow) }}
        </button>
      </dd>
      <dt class="text-muted">
        {{ t('detail.origin') }}
      </dt>
      <dd>{{ originLabel(flow, t) }}</dd>
      <dt class="text-muted">
        {{ t('detail.protocol') }}
      </dt>
      <dd>{{ flow.protocol ?? t('detail.unknown') }}</dd>
      <dt class="text-muted">
        {{ t('detail.encrypted') }}
      </dt>
      <dd>{{ yesNo(flow.encrypted) }}</dd>
      <template v-if="flow.purpose">
        <dt class="text-muted">
          {{ t('detail.purpose') }}
        </dt>
        <dd>{{ flow.purpose }}</dd>
      </template>
      <template v-if="flow.hostnameCount > 0">
        <dt class="text-muted">
          {{ t('detail.names') }}
        </dt>
        <dd>
          <ul>
            <li
              v-for="name in flow.hostnames"
              :key="name"
            >
              {{ name }}
            </li>
            <li
              v-if="flow.hostnameCount > flow.hostnames.length"
              class="text-muted"
            >
              {{ t('detail.moreNames', { count: flow.hostnameCount - flow.hostnames.length }) }}
            </li>
          </ul>
        </dd>
      </template>
    </dl>
  </aside>
</template>
