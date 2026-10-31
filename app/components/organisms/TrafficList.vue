<script setup lang="ts">
import { indexTraffic, originLabel, portLabel, sourceOf } from '../../utils/traffic-index';

import type { Traffic, TrafficFlow } from '#shared/contracts/traffic';
import type { Selection } from '../../utils/traffic-selection';

/** The traffic as tables, one per host: the accessible equivalent of the graph. */
const props = defineProps<{ traffic: Traffic; selection?: Selection | null }>();
const emit = defineEmits<{ select: [selection: Selection] }>();

const { t } = useI18n();
const index = computed(() => indexTraffic(props.traffic));
const MAX_NAMES = 10;

const groups = computed(() => [
  ...props.traffic.hosts.map((host) =>
    ({ key: host.id, host, caption: host.name, services: index.value.servicesOf(host.id) })),
  ...(index.value.servicesOf(null).length > 0
    ? [{ key: 'external', host: null, caption: t('traffic.external'), services: index.value.servicesOf(null) }]
    : []),
]);

const current = (type: Selection['type'], id: string) =>
  (props.selection?.type === type && props.selection.id === id ? 'true' : undefined);

const select = (type: Selection['type'], id: string) => {
  emit('select', { type, id });
};

/** A port's rows: one per incoming flow, or one saying there is none. */
const rowsOf = (listenerId: string): (TrafficFlow | null)[] => {
  const flows = index.value.flowsInto(listenerId);
  return flows.length > 0 ? flows : [null];
};

const moreNames = (flow: TrafficFlow) => flow.hostnameCount - Math.min(flow.hostnames.length, MAX_NAMES);

const link = 'rounded-sm text-start underline-offset-2 hover:underline focus-visible:outline-2 '
  + 'focus-visible:outline-primary aria-[current=true]:font-semibold aria-[current=true]:text-primary';
</script>

<template>
  <section
    :aria-label="t('traffic.table.label')"
    class="flex flex-col gap-6"
  >
    <div
      v-if="groups.length === 0"
      class="flex flex-col items-center gap-1 p-6 text-center"
    >
      <p class="font-medium">
        {{ t('traffic.empty') }}
      </p>
      <p class="text-muted">
        {{ t('traffic.emptyHint') }}
      </p>
    </div>
    <div
      v-for="group in groups"
      :key="group.key"
      class="overflow-x-auto"
      role="region"
      tabindex="0"
      :aria-label="group.caption"
    >
      <!-- Fixed columns, so every host's table lines up with the others. -->
      <table class="w-full min-w-3xl table-fixed border-collapse text-sm">
        <colgroup>
          <col class="w-40">
          <col class="w-48">
          <col>
          <col class="w-64">
        </colgroup>
        <caption class="pb-2 text-start text-base font-semibold">
          <button
            v-if="group.host"
            type="button"
            :class="link"
            :aria-current="current('host', group.host.id)"
            @click="select('host', group.host.id)"
          >
            {{ group.caption }}
          </button>
          <template v-if="group.host">
            {{ ' ' }}<span class="ms-2 text-sm font-normal text-muted">{{ group.host.kind }}</span>
          </template>
          <template v-else>
            {{ group.caption }}
          </template>
        </caption>
        <thead>
          <tr class="border-b border-default text-start text-muted">
            <th
              scope="col"
              class="px-2 py-1 text-start font-medium"
            >
              {{ t('traffic.table.port') }}
            </th>
            <th
              scope="col"
              class="px-2 py-1 text-start font-medium"
            >
              {{ t('traffic.table.from') }}
            </th>
            <th
              scope="col"
              class="px-2 py-1 text-start font-medium"
            >
              {{ t('traffic.table.names') }}
            </th>
            <th
              scope="col"
              class="px-2 py-1 text-start font-medium"
            >
              {{ t('traffic.table.how') }}
            </th>
          </tr>
        </thead>
        <tbody v-if="group.services.length === 0">
          <tr>
            <td
              colspan="4"
              class="px-2 py-2 text-muted"
            >
              {{ t('traffic.table.noService') }}
            </td>
          </tr>
        </tbody>
        <tbody
          v-for="service in group.services"
          :key="service.id"
          class="border-b border-default"
        >
          <tr>
            <th
              scope="rowgroup"
              colspan="4"
              class="bg-elevated px-2 py-1 text-start"
            >
              <button
                type="button"
                :class="link"
                :aria-current="current('service', service.id)"
                @click="select('service', service.id)"
              >
                {{ service.name }}
              </button>
              <span class="ms-2 font-normal text-muted">{{ service.kind }}</span>
            </th>
          </tr>
          <template
            v-for="port in index.portsOf(service.id)"
            :key="port.id"
          >
            <tr
              v-for="(flow, row) in rowsOf(port.id)"
              :key="flow?.id ?? port.id"
              class="align-top"
            >
              <!-- A row header on every row: screen readers read a rowspan poorly. -->
              <th
                scope="row"
                class="px-2 py-1 text-start font-normal"
              >
                <button
                  v-if="row === 0"
                  type="button"
                  :class="link"
                  :aria-current="current('listener', port.id)"
                  @click="select('listener', port.id)"
                >
                  {{ portLabel(port) }}
                </button>
                <span
                  v-else
                  class="text-muted"
                >{{ portLabel(port) }}</span>
                <span
                  v-if="port.protocol && row === 0"
                  class="ms-1 text-muted"
                >{{ port.protocol }}</span>
              </th>
              <td
                v-if="flow === null"
                colspan="3"
                class="px-2 py-1 text-muted"
              >
                {{ t('traffic.table.noFlow') }}
              </td>
              <template v-else>
                <td class="px-2 py-1">
                  <button
                    type="button"
                    :class="link"
                    @click="emit('select', sourceOf(flow))"
                  >
                    {{ index.sourceName(flow, t) }}
                  </button>
                </td>
                <td class="px-2 py-1">
                  <ul class="flex flex-wrap gap-x-2">
                    <li
                      v-for="name in flow.hostnames.slice(0, MAX_NAMES)"
                      :key="name"
                    >
                      {{ name }}
                    </li>
                    <li
                      v-if="moreNames(flow) > 0"
                      class="text-muted"
                    >
                      {{ t('traffic.more', { count: moreNames(flow) }) }}
                    </li>
                  </ul>
                </td>
                <td class="px-2 py-1">
                  <button
                    type="button"
                    :class="link"
                    :aria-current="current('flow', flow.id)"
                    @click="select('flow', flow.id)"
                  >
                    {{ originLabel(flow, t) }}
                  </button>
                  <p
                    v-if="flow.purpose"
                    class="text-muted"
                  >
                    {{ flow.purpose }}
                  </p>
                </td>
              </template>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>
