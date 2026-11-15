<script setup lang="ts">
import { MAX_HOSTNAMES } from '@stackmap/extension-reverse-proxy/entities';

import type { ProxyRouteInput } from '@stackmap/extension-reverse-proxy/entities';
import type { EntityFormProps } from '~/composables/useEntityForm';

import { COMMON_EMPTY, useInventoryForm } from '~/composables/useEntityForm';

/** The proxy route form of the inventory: proxy, hostnames, upstream listener, Force SSL and WebSockets. */
const props = defineProps<EntityFormProps>();
const emit = defineEmits<{ submit: [values: ProxyRouteInput]; dirty: [dirty: boolean] }>();

const { t } = useI18n();
const label = (field: string, params: Record<string, unknown> = {}) => t(`extensions.reverse-proxy.fields.route.${field}`, params);
const cleaned = (hostnames: readonly string[]) => hostnames.map((name) => name.trim()).filter((name) => name !== '');
const { values, common, id, issue, submit } = useInventoryForm(props, {
  proxyServiceId: null as string | null,
  hostnames: [''] as string[],
  upstreamListenerId: null as string | null,
  forceSsl: false,
  websockets: false,
  ...COMMON_EMPTY,
}, {
  submit: (input) => {
    emit('submit', { ...input, hostnames: cleaned(input.hostnames) } as ProxyRouteInput);
  },
  dirty: (dirty) => {
    emit('dirty', dirty);
  },
});

const proxies = computed(() => {
  const services = props.references['core/service'] ?? [];
  const current = services.find((option) => option.id === values.value.proxyServiceId);
  // A service that is no longer a reverse proxy is kept, said unavailable, so that saving does not drop it.
  const unavailable = current && current.entity.kind !== 'reverse-proxy'
    ? [{ ...current, label: t('inventory.unavailable', { id: current.label }) }]
    : [];
  return [...services.filter((option) => option.entity.kind === 'reverse-proxy'), ...unavailable];
});
const proxyHint = computed(() => (proxies.value.length === 0 ? label('noProxy') : undefined));

const root = useTemplateRef<HTMLElement>('root');
const focus = async (selector: string) => {
  await nextTick();
  root.value?.querySelector<HTMLElement>(selector)?.focus();
};
const addHostname = async () => {
  values.value.hostnames = [...values.value.hostnames, ''];
  await focus(`#${id(`hostnames.${String(values.value.hostnames.length - 1)}`)}`);
};
// The removed row's button had the focus: the row now in its place, else the one before, else Add a hostname.
const removeHostname = async (index: number) => {
  const left = values.value.hostnames.length - 1;
  values.value.hostnames = values.value.hostnames.filter((_, at) => at !== index);
  await focus(left === 0 ? '[data-add-hostname]' : `[data-remove-hostname="${String(Math.min(index, left - 1))}"]`);
};

// Text mode edits the same value, one hostname per line; it lasts while the form is open.
const asText = ref(false);
const text = ref('');
const textId = computed(() => id('hostnamesText'));
const setText = (value: string) => {
  text.value = value;
  values.value.hostnames = value.split('\n');
};
const editAsText = async () => {
  text.value = cleaned(values.value.hostnames).join('\n');
  asText.value = true;
  await focus(`#${textId.value}`);
};
const editOneByOne = async () => {
  const rows = cleaned(text.value.split('\n'));
  values.value.hostnames = rows.length > 0 ? rows : [''];
  asText.value = false;
  await focus(`#${id('hostnames.0')}`);
};
const lineIssues = computed(() => values.value.hostnames.flatMap((_, index) =>
  issue(`hostnames.${String(index)}`).map((message) => label('line', { number: index + 1, message }))));
const groupError = computed(() => issue('hostnames').join(' '));
</script>

<template>
  <form
    :id="formId"
    ref="root"
    novalidate
    class="flex flex-col gap-4"
    @submit.prevent="submit"
  >
    <ReferenceSelect
      :id="id('proxyServiceId')"
      v-model="values.proxyServiceId"
      :label="label('proxyServiceId')"
      :items="proxies"
      :nullable="false"
      required
      :hint="proxyHint"
      :errors="issue('proxyServiceId')"
      :readonly="readonly"
    />
    <fieldset
      :id="id('hostnames')"
      tabindex="-1"
      :aria-describedby="groupError ? `${id('hostnames')}-error` : undefined"
      class="flex flex-col gap-3"
    >
      <legend class="text-sm font-medium">
        {{ label('hostnames') }}<span class="sr-only"> {{ t('inventory.required') }}</span>
      </legend>
      <p
        v-if="groupError"
        :id="`${id('hostnames')}-error`"
        class="text-sm text-error"
      >
        {{ groupError }}
      </p>
      <EntityField
        v-if="asText && !readonly"
        :label="label('hostnamesText')"
        :errors="lineIssues"
      >
        <UTextarea
          :id="textId"
          :model-value="text"
          :rows="Math.min(Math.max(values.hostnames.length, 2), 12)"
          autocomplete="off"
          spellcheck="false"
          class="w-full"
          @update:model-value="setText(String($event))"
        />
      </EntityField>
      <template v-else>
        <div
          v-for="(_, index) in values.hostnames"
          :key="index"
          class="flex items-start gap-2"
        >
          <EntityField
            :label="label('hostnameNumbered', { number: index + 1 })"
            :errors="issue(`hostnames.${index}`)"
            class="flex-1"
          >
            <UInput
              :id="id(`hostnames.${index}`)"
              v-model="values.hostnames[index]"
              :readonly="readonly"
              autocomplete="off"
              spellcheck="false"
              class="w-full"
            />
          </EntityField>
          <UButton
            v-if="!readonly"
            :data-remove-hostname="index"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            class="mt-6"
            :aria-label="label('removeHostname', { number: index + 1 })"
            @click="removeHostname(index)"
          />
        </div>
      </template>
      <div
        v-if="!readonly"
        class="flex flex-wrap items-center gap-2"
      >
        <template v-if="!asText">
          <UButton
            v-if="values.hostnames.length < MAX_HOSTNAMES"
            data-add-hostname
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            @click="addHostname"
          >
            {{ label('addHostname') }}
          </UButton>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ label('hostnamesLimit') }}
          </p>
        </template>
        <UButton
          color="neutral"
          variant="ghost"
          @click="asText ? editOneByOne() : editAsText()"
        >
          {{ label(asText ? 'editOneByOne' : 'editAsText') }}
        </UButton>
      </div>
    </fieldset>
    <ReferenceSelect
      :id="id('upstreamListenerId')"
      v-model="values.upstreamListenerId"
      :label="label('upstreamListenerId')"
      :items="references['core/listener'] ?? []"
      :nullable="false"
      required
      :errors="issue('upstreamListenerId')"
      :readonly="readonly"
    />
    <EntityField
      v-for="name in ['forceSsl', 'websockets'] as const"
      :key="name"
      :label="label(name)"
      :errors="issue(name)"
    >
      <!-- Read-only, yes or no as read-only text: reachable and at full contrast, unlike a disabled switch. -->
      <UInput
        v-if="readonly"
        :id="id(name)"
        :model-value="t(values[name] ? 'inventory.yes' : 'inventory.no')"
        readonly
        class="w-full"
      />
      <USwitch
        v-else
        :id="id(name)"
        v-model="values[name]"
      />
    </EntityField>
    <CommonFields
      v-model="common"
      :form-id="formId"
      :issues="issues"
      :readonly="readonly"
      :origin="String(entity?.origin ?? 'manual')"
      :external-ref="(entity?.externalRef as string | null | undefined) ?? null"
    />
  </form>
</template>
